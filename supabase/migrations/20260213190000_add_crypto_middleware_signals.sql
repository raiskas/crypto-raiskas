CREATE TABLE IF NOT EXISTS crypto_middleware_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  stage VARCHAR(10) NOT NULL CHECK (stage IN ('WAIT', 'SMALL', 'MEDIUM', 'FULL')),
  score DECIMAL(5, 2) NOT NULL,
  price DECIMAL(18, 8) NOT NULL,
  rsi_1h DECIMAL(6, 2) NOT NULL,
  ema_50_1h DECIMAL(18, 8) NOT NULL,
  ema_200_1h DECIMAL(18, 8) NOT NULL,
  trend_4h VARCHAR(10) NOT NULL CHECK (trend_4h IN ('bull', 'bear')),
  trend_1w VARCHAR(10) NOT NULL CHECK (trend_1w IN ('bull', 'bear')),
  macro_badge VARCHAR(20) NOT NULL CHECK (macro_badge IN ('risk_on', 'neutro', 'risk_off')),
  macro_score DECIMAL(5, 2) NOT NULL,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crypto_middleware_signals_usuario_id
  ON crypto_middleware_signals(usuario_id);

CREATE INDEX IF NOT EXISTS idx_crypto_middleware_signals_symbol
  ON crypto_middleware_signals(symbol);

CREATE INDEX IF NOT EXISTS idx_crypto_middleware_signals_criado_em
  ON crypto_middleware_signals(criado_em DESC);

INSERT INTO permissoes (nome, descricao, modulo)
VALUES
  ('crypto_middleware_visualizar', 'Visualizar sinais do Crypto Middleware', 'crypto_middleware'),
  ('crypto_middleware_executar', 'Executar o motor do Crypto Middleware', 'crypto_middleware')
ON CONFLICT (nome) DO NOTHING;
