-- SparkyRivals: consented competitions; canonical health data remains in check-ins.
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 100),
  metric text NOT NULL DEFAULT 'steps' CHECK (metric IN ('steps')),
  scoring_mode text NOT NULL DEFAULT 'sum' CHECK (scoring_mode IN ('sum')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  timezone text NOT NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenges_date_range CHECK (end_date >= start_date AND end_date - start_date < 366)
);
CREATE INDEX challenges_creator_idx ON public.challenges (creator_user_id, created_at DESC, id);

CREATE TABLE public.challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'left')),
  invited_by_user_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id),
  CONSTRAINT challenge_participant_timestamps CHECK (
    (status = 'pending' AND accepted_at IS NULL AND declined_at IS NULL AND left_at IS NULL) OR
    (status = 'accepted' AND accepted_at IS NOT NULL AND declined_at IS NULL AND left_at IS NULL) OR
    (status = 'declined' AND accepted_at IS NULL AND declined_at IS NOT NULL AND left_at IS NULL) OR
    (status = 'left' AND accepted_at IS NOT NULL AND declined_at IS NULL AND left_at IS NOT NULL)
  )
);
CREATE INDEX challenge_participants_user_idx ON public.challenge_participants (user_id, status, challenge_id);

-- Guards also protect direct app-role SQL. SECURITY DEFINER only for bounded
-- parent locking / consent checks, with qualified objects and a fixed search path.
CREATE FUNCTION public.guard_challenge_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE today date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone)
     OR NEW.timezone ~ '^(posix|right)/' THEN
    RAISE EXCEPTION 'Invalid challenge timezone' USING ERRCODE = '23514';
  END IF;
  today := (CURRENT_TIMESTAMP AT TIME ZONE NEW.timezone)::date;
  IF TG_OP = 'INSERT' THEN
    IF NEW.start_date < today OR NEW.start_date > today + 366 OR NEW.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Challenge must start today or within the next 366 days' USING ERRCODE = '23514';
    END IF;
    NEW.created_at := now();
  ELSE
    IF ROW(NEW.id, NEW.creator_user_id, NEW.metric, NEW.scoring_mode, NEW.start_date, NEW.end_date, NEW.timezone, NEW.created_at)
       IS DISTINCT FROM ROW(OLD.id, OLD.creator_user_id, OLD.metric, OLD.scoring_mode, OLD.start_date, OLD.end_date, OLD.timezone, OLD.created_at) THEN
      RAISE EXCEPTION 'Challenge rules are immutable' USING ERRCODE = '23514';
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
CREATE TRIGGER challenge_write_guard BEFORE INSERT OR UPDATE ON public.challenges
FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_write();

CREATE FUNCTION public.guard_challenge_participant_write() RETURNS trigger
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
       OR c.cancelled_at IS NOT NULL OR today > c.end_date THEN
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
    NEW.invited_at := now(); NEW.created_at := now(); NEW.declined_at := NULL; NEW.left_at := NULL;
  ELSE
    IF ROW(NEW.challenge_id, NEW.user_id, NEW.invited_by_user_id, NEW.invited_at, NEW.created_at)
       IS DISTINCT FROM ROW(OLD.challenge_id, OLD.user_id, OLD.invited_by_user_id, OLD.invited_at, OLD.created_at)
       OR actor <> OLD.user_id OR actor = c.creator_user_id THEN
      RAISE EXCEPTION 'Membership identity is immutable' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined') THEN
      IF NEW.status = 'accepted' AND (c.cancelled_at IS NOT NULL OR today > c.end_date) THEN
        RAISE EXCEPTION 'Invitation is closed' USING ERRCODE = '23514';
      END IF;
      NEW.accepted_at := CASE WHEN NEW.status = 'accepted' THEN now() END;
      NEW.declined_at := CASE WHEN NEW.status = 'declined' THEN now() END;
      NEW.left_at := NULL;
    ELSIF OLD.status = 'accepted' AND NEW.status = 'left' THEN
      NEW.accepted_at := OLD.accepted_at; NEW.declined_at := NULL; NEW.left_at := now();
    ELSE
      RAISE EXCEPTION 'Invalid membership transition' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER challenge_participant_write_guard BEFORE INSERT OR UPDATE ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_participant_write();

CREATE FUNCTION public.add_challenge_creator() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.challenge_participants (challenge_id, user_id, status, invited_by_user_id)
  VALUES (NEW.id, NEW.creator_user_id, 'accepted', NEW.creator_user_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER challenge_creator_participation AFTER INSERT ON public.challenges
FOR EACH ROW EXECUTE FUNCTION public.add_challenge_creator();

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
