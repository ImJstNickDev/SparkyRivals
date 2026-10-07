-- Allow creator removal only before a goal lobby locks. No historical migration is changed.
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
      ELSIF actor = c.creator_user_id AND OLD.user_id <> actor
        AND OLD.status = 'accepted' AND NEW.status = 'left'
        AND c.scoring_mode <> 'sum' AND c.locked_at IS NULL AND c.cancelled_at IS NULL THEN
        -- Creator removal is a departure, preserving consent history. It never
        -- grants the creator permission to choose another participant's target.
        NEW.left_at := now();
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
