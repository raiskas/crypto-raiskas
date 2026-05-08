ALTER TABLE public.price_alerts
  ALTER COLUMN direction TYPE VARCHAR(5);

ALTER TABLE public.price_alerts
  DROP CONSTRAINT IF EXISTS price_alerts_direction_check;

ALTER TABLE public.price_alerts
  ADD CONSTRAINT price_alerts_direction_check
  CHECK (direction IN ('gte', 'lte', 'cross'));

ALTER TABLE public.price_alerts
  ADD COLUMN IF NOT EXISTS repeat_mode VARCHAR(10) NOT NULL DEFAULT 'always';

ALTER TABLE public.price_alerts
  DROP CONSTRAINT IF EXISTS price_alerts_repeat_mode_check;

ALTER TABLE public.price_alerts
  ADD CONSTRAINT price_alerts_repeat_mode_check
  CHECK (repeat_mode IN ('once', 'always'));

UPDATE public.price_alerts
SET
  direction = 'cross',
  repeat_mode = 'always',
  is_triggered = FALSE,
  next_eligible_at = NULL,
  updated_at = NOW()
WHERE direction IS DISTINCT FROM 'cross'
   OR repeat_mode IS DISTINCT FROM 'always'
   OR is_triggered IS DISTINCT FROM FALSE
   OR next_eligible_at IS NOT NULL;
