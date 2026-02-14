-- Schema for Crypto Raiskas Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- EMPRESAS (Companies)
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  email VARCHAR(255),
  telefone VARCHAR(20),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USUARIOS (Users)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE NOT NULL, -- Reference to Supabase Auth user
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GRUPOS (Groups)
CREATE TABLE IF NOT EXISTS grupos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(nome, empresa_id)
);

-- PERMISSOES (Permissions)
CREATE TABLE IF NOT EXISTS permissoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  modulo VARCHAR(100) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GRUPOS_PERMISSOES (Groups Permissions - Many-to-Many)
CREATE TABLE IF NOT EXISTS grupos_permissoes (
  grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
  permissao_id UUID REFERENCES permissoes(id) ON DELETE CASCADE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (grupo_id, permissao_id)
);

-- USUARIOS_GRUPOS (Users Groups - Many-to-Many)
CREATE TABLE IF NOT EXISTS usuarios_grupos (
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (usuario_id, grupo_id)
);

-- VENDAS (Sales Module Example)
CREATE TABLE IF NOT EXISTS vendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(50) NOT NULL,
  cliente VARCHAR(255) NOT NULL,
  valor_total DECIMAL(10, 2) NOT NULL,
  data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pendente',
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRYPTO_OPERACOES (Cryptocurrency Operations)
CREATE TABLE IF NOT EXISTS crypto_operacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  moeda_id VARCHAR(100) NOT NULL, -- ID da criptomoeda (bitcoin, ethereum, etc)
  simbolo VARCHAR(20) NOT NULL, -- Símbolo da moeda (BTC, ETH, etc)
  nome VARCHAR(100) NOT NULL, -- Nome da moeda (Bitcoin, Ethereum, etc)
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('compra', 'venda')),
  quantidade DECIMAL(24, 8) NOT NULL, -- Quantidade da moeda (permite frações pequenas)
  preco_unitario DECIMAL(18, 2) NOT NULL, -- Preço unitário em USD
  valor_total DECIMAL(18, 2) NOT NULL, -- Valor total da operação em USD
  taxa DECIMAL(18, 2) NOT NULL DEFAULT 0, -- Taxa da operação em USD
  data_operacao TIMESTAMP WITH TIME ZONE NOT NULL, -- Data da operação
  exchange VARCHAR(100), -- Exchange onde foi realizada a operação
  notas TEXT, -- Notas adicionais
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRYPTO_MIDDLEWARE_SIGNALS (Sinais do motor tatico/macro)
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

-- Create indexes for table crypto_operacoes
CREATE INDEX idx_crypto_operacoes_usuario_id ON crypto_operacoes(usuario_id);
CREATE INDEX idx_crypto_operacoes_moeda_id ON crypto_operacoes(moeda_id);
CREATE INDEX idx_crypto_operacoes_data ON crypto_operacoes(data_operacao);
CREATE INDEX idx_crypto_middleware_signals_usuario_id ON crypto_middleware_signals(usuario_id);
CREATE INDEX idx_crypto_middleware_signals_symbol ON crypto_middleware_signals(symbol);
CREATE INDEX idx_crypto_middleware_signals_criado_em ON crypto_middleware_signals(criado_em DESC);

-- Insert default permissions
INSERT INTO permissoes (nome, descricao, modulo) VALUES
  ('usuario_visualizar', 'Visualizar usuários', 'usuarios'),
  ('usuario_criar', 'Criar usuários', 'usuarios'),
  ('usuario_editar', 'Editar usuários', 'usuarios'),
  ('usuario_excluir', 'Excluir usuários', 'usuarios'),
  ('grupo_visualizar', 'Visualizar grupos', 'grupos'),
  ('grupo_criar', 'Criar grupos', 'grupos'),
  ('grupo_editar', 'Editar grupos', 'grupos'),
  ('grupo_excluir', 'Excluir grupos', 'grupos'),
  ('venda_visualizar', 'Visualizar vendas', 'vendas'),
  ('venda_criar', 'Criar vendas', 'vendas'),
  ('venda_editar', 'Editar vendas', 'vendas'),
  ('venda_excluir', 'Excluir vendas', 'vendas'),
  ('crypto_visualizar', 'Visualizar operações de criptomoedas', 'crypto'),
  ('crypto_criar', 'Criar operações de criptomoedas', 'crypto'),
  ('crypto_editar', 'Editar operações de criptomoedas', 'crypto'),
  ('crypto_excluir', 'Excluir operações de criptomoedas', 'crypto'),
  ('crypto_middleware_visualizar', 'Visualizar sinais do Crypto Middleware', 'crypto_middleware'),
  ('crypto_middleware_executar', 'Executar o motor do Crypto Middleware', 'crypto_middleware');

-- Create indexes for performance
CREATE INDEX idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX idx_grupos_empresa_id ON grupos(empresa_id);
CREATE INDEX idx_vendas_empresa_id ON vendas(empresa_id);
CREATE INDEX idx_vendas_usuario_id ON vendas(usuario_id); 
