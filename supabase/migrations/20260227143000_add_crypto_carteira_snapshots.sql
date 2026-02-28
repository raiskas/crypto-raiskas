-- Snapshots diários da carteira (leve e escalável)
CREATE TABLE IF NOT EXISTS crypto_carteira_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carteira_id UUID NOT NULL REFERENCES crypto_carteiras(id) ON DELETE CASCADE,
  data_ref DATE NOT NULL,
  aporte_liquido DECIMAL(18, 2) NOT NULL DEFAULT 0,
  saldo_caixa DECIMAL(18, 2) NOT NULL DEFAULT 0,
  valor_ativos DECIMAL(18, 2) NOT NULL DEFAULT 0,
  patrimonio_total DECIMAL(18, 2) NOT NULL DEFAULT 0,
  fonte_preco VARCHAR(30) NOT NULL DEFAULT 'ops_last_price',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_crypto_carteira_snapshots UNIQUE (carteira_id, data_ref)
);

CREATE INDEX IF NOT EXISTS idx_crypto_carteira_snapshots_carteira_data
  ON crypto_carteira_snapshots(carteira_id, data_ref);

