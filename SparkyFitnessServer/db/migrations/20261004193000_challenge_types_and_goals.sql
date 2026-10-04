-- Additive Challenge types and personal goals. Existing sum rows retain their rules.
ALTER TABLE public.challenges DROP CONSTRAINT challenges_metric_check;
ALTER TABLE public.challenges DROP CONSTRAINT challenges_scoring_mode_check;
ALTER TABLE public.challenges ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE public.challenges ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE public.challenges ADD COLUMN duration_days integer;
ALTER TABLE public.challenges ADD COLUMN start_next_day boolean NOT NULL DEFAULT false;
ALTER TABLE public.challenges ADD COLUMN locked_at timestamptz;
ALTER TABLE public.challenges DISABLE TRIGGER challenge_write_guard;
UPDATE public.challenges SET duration_days = end_date - start_date + 1;
ALTER TABLE public.challenges ENABLE TRIGGER challenge_write_guard;
ALTER TABLE public.challenges ALTER COLUMN duration_days SET NOT NULL;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_duration CHECK (duration_days BETWEEN 1 AND 366);
ALTER TABLE public.challenges ADD CONSTRAINT challenges_metric_check CHECK (metric IN
  ('steps','distance','active_calories','workout_time','workout_calories','workout_distance','hydration'));
ALTER TABLE public.challenges ADD CONSTRAINT challenges_scoring_mode_check CHECK (scoring_mode IN ('sum','goal_progress','goal_days'));
ALTER TABLE public.challenges ADD CONSTRAINT challenges_type_check CHECK (
  (metric <> 'hydration' OR scoring_mode <> 'sum') AND (metric <> 'workout_distance' OR scoring_mode = 'sum'));
ALTER TABLE public.challenges ADD CONSTRAINT challenges_activation_check CHECK (
  (scoring_mode = 'sum' AND start_date IS NOT NULL AND end_date IS NOT NULL AND NOT start_next_day AND locked_at IS NULL)
  OR (scoring_mode <> 'sum' AND ((locked_at IS NULL AND start_date IS NULL AND end_date IS NULL)
    OR (locked_at IS NOT NULL AND start_date IS NOT NULL AND end_date = start_date + duration_days - 1))));

ALTER TABLE public.challenge_participants ADD COLUMN target_value numeric(16,6);
ALTER TABLE public.challenge_participants ADD COLUMN ready_at timestamptz;
ALTER TABLE public.challenge_participants ADD COLUMN target_revision integer NOT NULL DEFAULT 0 CHECK (target_revision >= 0);
ALTER TABLE public.challenge_participants ADD COLUMN withdrawn_at timestamptz;
ALTER TABLE public.challenge_participants ADD CONSTRAINT challenge_target_valid CHECK (target_value IS NULL OR (target_value > 0 AND target_value <= 1000000000));
ALTER TABLE public.challenge_participants DROP CONSTRAINT challenge_participants_status_check;
ALTER TABLE public.challenge_participants ADD CONSTRAINT challenge_participants_status_check CHECK (status IN ('pending','accepted','declined','left','withdrawn'));
ALTER TABLE public.challenge_participants DROP CONSTRAINT challenge_participant_timestamps;
ALTER TABLE public.challenge_participants ADD CONSTRAINT challenge_participant_timestamps CHECK (
  (status = 'pending' AND accepted_at IS NULL AND declined_at IS NULL AND left_at IS NULL AND withdrawn_at IS NULL) OR
  (status = 'accepted' AND accepted_at IS NOT NULL AND declined_at IS NULL AND left_at IS NULL AND withdrawn_at IS NULL) OR
  (status = 'declined' AND accepted_at IS NULL AND declined_at IS NOT NULL AND left_at IS NULL AND withdrawn_at IS NULL) OR
  (status = 'left' AND accepted_at IS NOT NULL AND declined_at IS NULL AND left_at IS NOT NULL AND withdrawn_at IS NULL) OR
  (status = 'withdrawn' AND accepted_at IS NULL AND declined_at IS NULL AND left_at IS NULL AND withdrawn_at IS NOT NULL));

ALTER TABLE public.user_goals
  ADD COLUMN steps_goal numeric(16,6) CHECK (steps_goal > 0 AND steps_goal <= 1000000000),
  ADD COLUMN distance_goal_meters numeric(16,6) CHECK (distance_goal_meters > 0 AND distance_goal_meters <= 1000000000),
  ADD COLUMN active_calories_goal numeric(16,6) CHECK (active_calories_goal > 0 AND active_calories_goal <= 1000000000);
ALTER TABLE public.goal_presets
  ADD COLUMN steps_goal numeric(16,6) CHECK (steps_goal > 0 AND steps_goal <= 1000000000),
  ADD COLUMN distance_goal_meters numeric(16,6) CHECK (distance_goal_meters > 0 AND distance_goal_meters <= 1000000000),
  ADD COLUMN active_calories_goal numeric(16,6) CHECK (active_calories_goal > 0 AND active_calories_goal <= 1000000000);

CREATE OR REPLACE FUNCTION public.guard_challenge_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE today date; activating boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone)
     OR NEW.timezone ~ '^(posix|right)/' THEN
    RAISE EXCEPTION 'Invalid challenge timezone' USING ERRCODE = '23514';
  END IF;
  today := (CURRENT_TIMESTAMP AT TIME ZONE NEW.timezone)::date;
  IF TG_OP = 'INSERT' THEN
    IF NEW.scoring_mode NOT IN ('sum','goal_progress','goal_days') THEN
      RAISE EXCEPTION 'Invalid scoring mode' USING ERRCODE = '23514';
    END IF;
    IF NEW.cancelled_at IS NOT NULL OR NEW.locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'New challenge must not be cancelled or locked' USING ERRCODE = '23514';
    END IF;
    IF NEW.scoring_mode = 'sum' THEN
      IF NEW.start_date IS NULL OR NEW.start_date < today OR NEW.start_date > today + 366 THEN
        RAISE EXCEPTION 'Challenge must start today or within the next 366 days' USING ERRCODE = '23514';
      END IF;
      NEW.duration_days := NEW.end_date - NEW.start_date + 1;
    END IF;
    NEW.created_at := now();
  ELSE
    activating := OLD.scoring_mode <> 'sum' AND OLD.locked_at IS NULL AND NEW.locked_at IS NOT NULL;
    IF ROW(NEW.id, NEW.creator_user_id, NEW.metric, NEW.scoring_mode, NEW.timezone, NEW.created_at, NEW.duration_days, NEW.start_next_day)
      IS DISTINCT FROM ROW(OLD.id, OLD.creator_user_id, OLD.metric, OLD.scoring_mode, OLD.timezone, OLD.created_at, OLD.duration_days, OLD.start_next_day) THEN
      RAISE EXCEPTION 'Challenge rules are immutable' USING ERRCODE = '23514';
    END IF;
    IF activating THEN
      IF (SELECT count(*) FROM public.challenge_participants WHERE challenge_id=OLD.id AND status='accepted') < 2
        OR EXISTS (SELECT 1 FROM public.challenge_participants WHERE challenge_id=OLD.id
          AND (status='pending' OR (status='accepted' AND (target_value IS NULL OR ready_at IS NULL)))) THEN
        RAISE EXCEPTION 'Challenge is not ready' USING ERRCODE = '23514';
      END IF;
      NEW.locked_at := now();
      NEW.start_date := today + CASE WHEN OLD.start_next_day THEN 1 ELSE 0 END;
      NEW.end_date := NEW.start_date + OLD.duration_days - 1;
    ELSIF ROW(NEW.start_date,NEW.end_date,NEW.locked_at) IS DISTINCT FROM ROW(OLD.start_date,OLD.end_date,OLD.locked_at) THEN
      RAISE EXCEPTION 'Challenge dates and lock are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.cancelled_at IS NOT NULL OR today > OLD.end_date
       OR (NEW.name IS DISTINCT FROM OLD.name AND today >= OLD.start_date) THEN
      RAISE EXCEPTION 'Challenge cannot be changed in this lifecycle' USING ERRCODE = '23514';
    END IF;
    IF NEW.cancelled_at IS NOT NULL THEN NEW.cancelled_at := now(); END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.guard_challenge_participant_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.challenges; actor uuid; today date;
BEGIN
  actor := public.authenticated_user_id();
  IF actor IS NULL OR actor IS DISTINCT FROM public.current_user_id() THEN
    RAISE EXCEPTION 'Challenge participation requires self context' USING ERRCODE = '42501';
  END IF;
  -- All membership transitions serialize on the parent, including capacity checks.
  SELECT * INTO c FROM public.challenges WHERE id = NEW.challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge unavailable' USING ERRCODE = '42501'; END IF;
  today := (CURRENT_TIMESTAMP AT TIME ZONE c.timezone)::date;
  IF TG_OP = 'INSERT' THEN
    IF actor <> c.creator_user_id OR NEW.invited_by_user_id <> actor
       OR c.cancelled_at IS NOT NULL OR today > c.end_date OR c.locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE = '42501';
    END IF;
    IF NEW.user_id = actor THEN
      IF NEW.status <> 'accepted' THEN RAISE EXCEPTION 'Creator must participate' USING ERRCODE = '23514'; END IF;
      NEW.accepted_at := now();
    ELSE
      IF NEW.status <> 'pending' OR NOT EXISTS (
        SELECT 1 FROM public.family_access fa
        WHERE ((fa.owner_user_id = actor AND fa.family_user_id = NEW.user_id)
           OR (fa.family_user_id = actor AND fa.owner_user_id = NEW.user_id))
          AND fa.is_active AND fa.status = 'active'
          AND fa.access_start_date <= now()
          AND (fa.access_end_date IS NULL OR fa.access_end_date > now())
      ) THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE = '42501'; END IF;
      NEW.accepted_at := NULL;
    END IF;
    IF (SELECT count(*) FROM public.challenge_participants WHERE challenge_id = c.id) >= 100 THEN
      RAISE EXCEPTION 'Challenge participant limit reached' USING ERRCODE = '23514';
    END IF;
    NEW.target_value := NULL; NEW.ready_at := NULL; NEW.target_revision := 0; NEW.withdrawn_at := NULL;
    NEW.invited_at := now(); NEW.created_at := now(); NEW.declined_at := NULL; NEW.left_at := NULL;
  ELSE
    IF ROW(NEW.challenge_id, NEW.user_id, NEW.invited_by_user_id, NEW.invited_at, NEW.created_at)
       IS DISTINCT FROM ROW(OLD.challenge_id, OLD.user_id, OLD.invited_by_user_id, OLD.invited_at, OLD.created_at) THEN
      RAISE EXCEPTION 'Membership identity is immutable' USING ERRCODE = '42501';
    END IF;
    NEW.accepted_at := OLD.accepted_at; NEW.declined_at := OLD.declined_at;
    NEW.left_at := OLD.left_at; NEW.withdrawn_at := OLD.withdrawn_at;
    NEW.target_revision := OLD.target_revision;
    IF NEW.status = OLD.status THEN
      IF actor <> OLD.user_id OR OLD.status <> 'accepted' OR c.scoring_mode = 'sum'
        OR c.locked_at IS NOT NULL OR c.cancelled_at IS NOT NULL THEN
        RAISE EXCEPTION 'Target and readiness are locked or unavailable' USING ERRCODE = '42501';
      END IF;
      IF NEW.target_value IS DISTINCT FROM OLD.target_value THEN
        NEW.ready_at := NULL;
        NEW.target_revision := OLD.target_revision + 1;
      ELSIF NEW.ready_at IS NOT NULL THEN
        IF NEW.target_value IS NULL THEN RAISE EXCEPTION 'Choose a target first' USING ERRCODE = '23514'; END IF;
        NEW.ready_at := COALESCE(OLD.ready_at, now());
      END IF;
    ELSE
      IF ROW(NEW.target_value, NEW.ready_at) IS DISTINCT FROM ROW(OLD.target_value, OLD.ready_at) THEN
        RAISE EXCEPTION 'Membership transition cannot set target or readiness' USING ERRCODE = '42501';
      END IF;
      IF actor = c.creator_user_id AND OLD.status = 'pending' AND NEW.status = 'withdrawn'
        AND c.scoring_mode <> 'sum' AND c.locked_at IS NULL AND c.cancelled_at IS NULL THEN
        NEW.withdrawn_at := now();
      ELSIF actor <> OLD.user_id OR actor = c.creator_user_id THEN
        RAISE EXCEPTION 'Only the participant may respond' USING ERRCODE = '42501';
      ELSIF OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined') THEN
        IF NEW.status = 'accepted' AND (c.cancelled_at IS NOT NULL OR today > c.end_date OR c.locked_at IS NOT NULL) THEN
          RAISE EXCEPTION 'Invitation is closed' USING ERRCODE = '23514';
        END IF;
        NEW.accepted_at := CASE WHEN NEW.status = 'accepted' THEN now() END;
        NEW.declined_at := CASE WHEN NEW.status = 'declined' THEN now() END;
      ELSIF OLD.status = 'accepted' AND NEW.status = 'left' THEN
        NEW.left_at := now();
      ELSE
        RAISE EXCEPTION 'Invalid membership transition' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Every participant write already locks the parent before this trigger evaluates
-- the final roster. The lock/transition is durable and shared by all replicas.
CREATE FUNCTION public.activate_ready_challenge() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.challenges;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id=NEW.challenge_id FOR UPDATE;
  IF c.scoring_mode <> 'sum' AND c.locked_at IS NULL AND c.cancelled_at IS NULL
    AND (SELECT count(*) FROM public.challenge_participants WHERE challenge_id=c.id AND status='accepted') >= 2
    AND NOT EXISTS (SELECT 1 FROM public.challenge_participants WHERE challenge_id=c.id
      AND (status='pending' OR (status='accepted' AND (target_value IS NULL OR ready_at IS NULL)))) THEN
    UPDATE public.challenges SET locked_at=now() WHERE id=c.id AND locked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER challenge_ready_activation AFTER INSERT OR UPDATE ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.activate_ready_challenge();

-- Return types gain configuration fields; startup recreates the narrow functions.
DROP FUNCTION IF EXISTS public.challenge_roster(uuid);
DROP FUNCTION IF EXISTS public.challenge_workout_points(uuid);
