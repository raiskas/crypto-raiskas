CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  asset_symbol VARCHAR(20) NOT NULL,
  provider_asset_id VARCHAR(100),
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('gte', 'lte')),
  target_price NUMERIC(24, 8) NOT NULL CHECK (target_price > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  cooldown_minutes INTEGER NOT NULL DEFAULT 0 CHECK (cooldown_minutes >= 0),
  last_price NUMERIC(24, 8),
  last_triggered_at TIMESTAMPTZ,
  next_eligible_at TIMESTAMPTZ,
  triggered_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios')),
  token TEXT NOT NULL,
  apns_environment VARCHAR(20) NOT NULL DEFAULT 'production' CHECK (apns_environment IN ('sandbox', 'production')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_device_tokens_usuario_token UNIQUE (usuario_id, token)
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_usuario_id
  ON public.price_alerts(usuario_id);

CREATE INDEX IF NOT EXISTS idx_price_alerts_engine_lookup
  ON public.price_alerts(enabled, is_triggered, next_eligible_at, asset_symbol);

CREATE INDEX IF NOT EXISTS idx_device_tokens_usuario_platform
  ON public.device_tokens(usuario_id, platform, ativo);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_alerts_updated_at ON public.price_alerts;
CREATE TRIGGER trg_price_alerts_updated_at
BEFORE UPDATE ON public.price_alerts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER trg_device_tokens_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_alerts_select_own ON public.price_alerts;
CREATE POLICY price_alerts_select_own
ON public.price_alerts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = price_alerts.usuario_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS price_alerts_insert_own ON public.price_alerts;
CREATE POLICY price_alerts_insert_own
ON public.price_alerts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = price_alerts.usuario_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS price_alerts_update_own ON public.price_alerts;
CREATE POLICY price_alerts_update_own
ON public.price_alerts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = price_alerts.usuario_id
      AND u.auth_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = price_alerts.usuario_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS price_alerts_delete_own ON public.price_alerts;
CREATE POLICY price_alerts_delete_own
ON public.price_alerts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = price_alerts.usuario_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS device_tokens_select_own ON public.device_tokens;
CREATE POLICY device_tokens_select_own
ON public.device_tokens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = device_tokens.usuario_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS device_tokens_insert_own ON public.device_tokens;
CREATE POLICY device_tokens_insert_own
ON public.device_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = device_tokens.usuario_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS device_tokens_update_own ON public.device_tokens;
CREATE POLICY device_tokens_update_own
ON public.device_tokens
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = device_tokens.usuario_id
      AND u.auth_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = device_tokens.usuario_id
      AND u.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS device_tokens_delete_own ON public.device_tokens;
CREATE POLICY device_tokens_delete_own
ON public.device_tokens
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = device_tokens.usuario_id
      AND u.auth_id = auth.uid()
  )
);
