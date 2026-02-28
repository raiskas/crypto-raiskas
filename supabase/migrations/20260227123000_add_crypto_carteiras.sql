-- Carteiras de investimento (caixa + ativos)
CREATE TABLE IF NOT EXISTS crypto_carteiras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL DEFAULT 'Carteira Principal',
  valor_inicial DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_crypto_carteiras_valor_inicial_non_negative CHECK (valor_inicial >= 0)
);

CREATE INDEX IF NOT EXISTS idx_crypto_carteiras_usuario_id
  ON crypto_carteiras(usuario_id);

CREATE INDEX IF NOT EXISTS idx_crypto_carteiras_usuario_ativo
  ON crypto_carteiras(usuario_id, ativo);

-- Garante uma carteira principal para cada usuário existente
INSERT INTO crypto_carteiras (usuario_id, nome, valor_inicial, ativo)
SELECT u.id, 'Carteira Principal', 0, TRUE
FROM usuarios u
WHERE NOT EXISTS (
  SELECT 1
  FROM crypto_carteiras c
  WHERE c.usuario_id = u.id
    AND c.ativo = TRUE
);

-- Relaciona operações a carteira (opcional para compatibilidade)
ALTER TABLE crypto_operacoes
  ADD COLUMN IF NOT EXISTS carteira_id UUID;

-- Backfill de operações antigas para a carteira principal do usuário
UPDATE crypto_operacoes co
SET carteira_id = (
  SELECT c.id
  FROM crypto_carteiras c
  WHERE c.usuario_id = co.usuario_id
    AND c.ativo = TRUE
  ORDER BY c.criado_em ASC
  LIMIT 1
)
WHERE co.carteira_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_crypto_operacoes_carteira'
  ) THEN
    ALTER TABLE crypto_operacoes
      ADD CONSTRAINT fk_crypto_operacoes_carteira
      FOREIGN KEY (carteira_id) REFERENCES crypto_carteiras(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crypto_operacoes_carteira_id
  ON crypto_operacoes(carteira_id);

