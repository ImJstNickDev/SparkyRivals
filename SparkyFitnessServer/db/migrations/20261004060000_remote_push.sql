-- Delivery state only: no health history, scores, participant names or credentials.
CREATE TABLE public.push_installations (
  installation_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  platform text CHECK (platform IN ('ios', 'android')),
  token_hash text UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  token_ciphertext text,
  token_iv text,
  token_tag text,
  account_guard uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  CHECK (NOT enabled OR (platform IS NOT NULL AND token_hash IS NOT NULL AND token_ciphertext IS NOT NULL AND token_iv IS NOT NULL AND token_tag IS NOT NULL))
);
CREATE INDEX push_installations_recipient ON public.push_installations(user_id, expires_at) WHERE enabled;

CREATE TABLE public.push_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'challenge_invitation' CHECK (event_type = 'challenge_invitation'),
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, event_type),
  FOREIGN KEY (challenge_id, user_id) REFERENCES public.challenge_participants(challenge_id, user_id) ON DELETE CASCADE
);
CREATE INDEX push_events_cleanup ON public.push_events(created_at);
CREATE TABLE public.push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.push_events(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES public.push_installations(installation_id) ON DELETE CASCADE,
  account_guard uuid NOT NULL,
  token_hash text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ticket','delivered','suppressed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  receipt_attempts integer NOT NULL DEFAULT 0 CHECK (receipt_attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ticket_id text,
  ticket_at timestamptz,
  error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, installation_id)
);
CREATE INDEX push_deliveries_due ON public.push_deliveries(next_attempt_at) WHERE state IN ('pending', 'ticket');
ALTER TABLE public.push_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

-- Capture opt-in recipients at invitation creation, never backfill old invitations
-- when somebody subsequently enables notifications. The external push service is
-- deliberately absent from the invitation transaction.
CREATE FUNCTION public.enqueue_challenge_invitation_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE event_id uuid;
BEGIN
  IF NEW.status <> 'pending' OR NOT EXISTS (SELECT 1 FROM public.push_installations
    WHERE user_id=NEW.user_id AND enabled AND expires_at>now()) THEN RETURN NEW; END IF;
  INSERT INTO public.push_events(challenge_id, user_id)
    VALUES (NEW.challenge_id, NEW.user_id)
    ON CONFLICT DO NOTHING RETURNING id INTO event_id;
  IF event_id IS NOT NULL THEN
    INSERT INTO public.push_deliveries(event_id, installation_id, account_guard, token_hash)
      SELECT event_id, i.installation_id, i.account_guard, i.token_hash
      FROM public.push_installations i
      WHERE i.user_id=NEW.user_id AND i.enabled AND i.expires_at > now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER challenge_invitation_push AFTER INSERT ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.enqueue_challenge_invitation_push();
