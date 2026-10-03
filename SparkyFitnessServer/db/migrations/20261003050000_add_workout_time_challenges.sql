-- Additive metric; existing consent/rules/participant rows are preserved.
ALTER TABLE public.challenges DROP CONSTRAINT challenges_metric_check;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_metric_check
  CHECK (metric IN ('steps', 'workout_time'));
