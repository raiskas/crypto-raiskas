-- Aportes futuros na carteira
CREATE TABLE IF NOT EXISTS crypto_carteira_aportes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carteira_id UUID NOT NULL REFERENCES crypto_carteiras(id) ON DELETE CASCADE,
  valor DECIMAL(18, 2) NOT NULL,
  data_aporte TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  descricao TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_crypto_carteira_aportes_valor_positive CHECK (valor > 0)
);

CREATE INDEX IF NOT EXISTS idx_crypto_carteira_aportes_carteira_id
  ON crypto_carteira_aportes(carteira_id);

CREATE INDEX IF NOT EXISTS idx_crypto_carteira_aportes_data
  ON crypto_carteira_aportes(data_aporte);

