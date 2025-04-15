# Guia do Banco de Dados - Crypto Raiskas

Este guia fornece informações sobre o banco de dados PostgreSQL usado no projeto Crypto Raiskas, incluindo instruções para configuração, migrações e melhores práticas.

## Visão Geral

O projeto utiliza PostgreSQL hospedado no Supabase como banco de dados principal. O banco de dados tem duas camadas:

1. **Auth**: Esquema gerenciado pelo Supabase para autenticação de usuários
2. **Public**: Esquema customizado para dados da aplicação (empresas, usuários, permissões, etc.)

## Estrutura do Banco de Dados

O banco de dados segue uma arquitetura multi-tenant, onde cada empresa possui seus próprios usuários, grupos, permissões e registros de vendas.

### Diagrama de Entidade-Relacionamento (ER)

```
empresas
  ├── id (PK)
  ├── nome
  ├── cnpj
  ├── email
  ├── telefone
  ├── criado_em
  └── atualizado_em
     │
     │    ┌─── auth.users
     │    │      └── id
     ▼    │
usuarios ─┘
  ├── id (PK)
  ├── auth_id (FK -> auth.users.id)
  ├── nome
  ├── email
  ├── empresa_id (FK -> empresas.id)
  ├── ativo
  ├── criado_em
  └── atualizado_em
     │
     │
     ▼
grupos
  ├── id (PK)
  ├── nome
  ├── descricao
  ├── empresa_id (FK -> empresas.id)
  ├── criado_em
  └── atualizado_em
     │
     │
     ▼
permissoes
  ├── id (PK)
  ├── nome
  ├── descricao
  ├── modulo
  ├── criado_em
  └── atualizado_em

usuarios_grupos
  ├── usuario_id (PK/FK -> usuarios.id)
  ├── grupo_id (PK/FK -> grupos.id)
  └── criado_em

grupos_permissoes
  ├── grupo_id (PK/FK -> grupos.id)
  ├── permissao_id (PK/FK -> permissoes.id)
  └── criado_em

vendas
  ├── id (PK)
  ├── numero
  ├── cliente
  ├── valor_total
  ├── data_venda
  ├── status
  ├── empresa_id (FK -> empresas.id)
  ├── usuario_id (FK -> usuarios.id)
  ├── criado_em
  └── atualizado_em
```

## Configuração Inicial

O arquivo `supabase-schema.sql` contém todas as definições de tabelas e dados iniciais. Para configurar o banco de dados pela primeira vez:

1. **Acesse o painel do Supabase**
2. **Vá para o Editor SQL**
3. **Cole o conteúdo do arquivo `supabase-schema.sql`**
4. **Execute o script**

Alternativamente, use o utilitário de linha de comando:

```bash
pnpm db:init
```

Este comando irá:
- Conectar-se ao Supabase utilizando as credenciais de ambiente
- Executar o script SQL para criar as tabelas
- Inserir dados iniciais (permissões padrão)

## Migrações de Banco de Dados

Para realizar alterações no banco de dados, siga estas etapas:

### 1. Criando uma Nova Migração

1. **Crie um arquivo SQL na pasta `scripts/migrations/`** com um nome descritivo:

   ```bash
   touch scripts/migrations/YYYYMMDD_descricao_migracao.sql
   ```

2. **Defina as alterações no arquivo SQL**:

   ```sql
   -- Descrição da migração
   -- Data: YYYY-MM-DD
   
   -- Criar nova tabela
   CREATE TABLE IF NOT EXISTS nova_tabela (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     nome VARCHAR(255) NOT NULL,
     empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
     criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Adicionar índice
   CREATE INDEX idx_nova_tabela_empresa_id ON nova_tabela(empresa_id);
   
   -- Adicionar dados iniciais
   INSERT INTO nova_tabela (nome, empresa_id) 
   SELECT 'Exemplo', id FROM empresas;
   ```

3. **Atualize o arquivo `supabase-schema.sql`** com as alterações para manter o esquema atualizado.

### 2. Aplicando a Migração

1. **Execução Manual**:
   - Acesse o Editor SQL no Supabase
   - Cole e execute o conteúdo do arquivo de migração

2. **Execução Automatizada**:
   ```bash
   pnpm db:migrate
   ```

### 3. Verificação

Após aplicar uma migração:

1. **Verifique se as alterações foram aplicadas**:
   ```sql
   -- Por exemplo, para uma nova tabela
   SELECT * FROM nova_tabela LIMIT 5;
   ```

2. **Verifique integridade do banco**:
   ```sql
   -- Verificar chaves estrangeiras
   SELECT 
     conrelid::regclass AS tabela,
     conname AS restricao,
     pg_get_constraintdef(oid) AS definicao
   FROM pg_constraint
   WHERE contype = 'f' AND connamespace = 'public'::regnamespace
   ORDER BY conrelid::regclass::text, conname;
   ```

## Restauração e Backup

### Criando um Backup

No painel do Supabase:

1. Vá para **Configurações do Projeto** > **Banco de Dados**
2. Clique em **Backup de Banco de Dados**
3. Siga as instruções para criar um backup

Via CLI Supabase:

```bash
supabase db dump -f backup.sql
```

### Restaurando um Backup

Para restaurar um backup:

1. Vá para **Configurações do Projeto** > **Banco de Dados** > **Restaurar**
2. Carregue o arquivo de backup
3. Siga as instruções para restauração

## Índices e Performance

O esquema inclui índices para otimizar consultas comuns:

```sql
CREATE INDEX idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX idx_grupos_empresa_id ON grupos(empresa_id);
CREATE INDEX idx_vendas_empresa_id ON vendas(empresa_id);
CREATE INDEX idx_vendas_usuario_id ON vendas(usuario_id);
```

### Diretrizes para Índices

- Crie índices para campos usados em:
  - Cláusulas WHERE
  - Junções (JOIN)
  - Cláusulas ORDER BY frequentes

- Evite índices desnecessários para tabelas pequenas ou raramente consultadas
- Considere índices compostos para consultas que filtram por múltiplas colunas

### Monitoramento de Performance

Para identificar consultas lentas:

```sql
SELECT
  query,
  calls,
  total_time,
  min_time,
  max_time,
  mean_time,
  stddev_time,
  rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;
```

## Acesso a Dados via API

O projeto acessa o banco de dados por meio de:

1. **Cliente Supabase Cliente**: Para operações no navegador
2. **Cliente Supabase Servidor**: Para operações server-side com maior privilégio

### Exemplo de Cliente de Navegador

```typescript
// src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Exemplo de Cliente de Servidor

```typescript
// src/lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

export async function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  return createClient(supabaseUrl, supabaseServiceKey);
}
```

## Transações

Para operações que modificam múltiplas tabelas, utilize transações para garantir a integridade dos dados.

```typescript
const { error } = await supabase.rpc('update_usuario_transacao', {
  p_usuario_id: userId,
  p_nome: nome,
  p_email: email,
  // Outros parâmetros...
});
```

Função RPC no Supabase:

```sql
CREATE OR REPLACE FUNCTION update_usuario_transacao(
  p_usuario_id UUID,
  p_nome VARCHAR,
  p_email VARCHAR
) RETURNS VOID AS $$
BEGIN
  -- Iniciar transação
  BEGIN
    -- Atualizar usuário
    UPDATE usuarios
    SET 
      nome = p_nome,
      email = p_email,
      atualizado_em = NOW()
    WHERE id = p_usuario_id;
    
    -- Log de atividade (exemplo)
    INSERT INTO logs_atividade (
      usuario_id,
      acao,
      detalhes
    ) VALUES (
      p_usuario_id,
      'update',
      jsonb_build_object('nome', p_nome, 'email', p_email)
    );
    
    -- Se tudo ocorrer bem, a transação será confirmada
  EXCEPTION
    WHEN OTHERS THEN
      -- Em caso de erro, a transação será revertida
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
```

## Políticas de Segurança de Linha (RLS)

O Supabase utiliza políticas de segurança no nível de linha para proteger os dados.

### Exemplo de Políticas RLS

Para a tabela `usuarios`:

```sql
-- Habilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Criar política para SELECT
CREATE POLICY "Usuários podem ver apenas usuários da mesma empresa"
  ON usuarios
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT u.auth_id 
      FROM usuarios u 
      WHERE u.empresa_id = usuarios.empresa_id
    )
  );

-- Criar política para INSERT
CREATE POLICY "Apenas usuários com permissão podem inserir"
  ON usuarios
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissoes p
      JOIN grupos_permissoes gp ON p.id = gp.permissao_id
      JOIN usuarios_grupos ug ON gp.grupo_id = ug.grupo_id
      JOIN usuarios u ON ug.usuario_id = u.id
      WHERE u.auth_id = auth.uid()
      AND p.nome = 'usuario_criar'
    )
  );
```

## Melhores Práticas

1. **Sempre use transações** para operações que modificam múltiplas tabelas
2. **Crie índices apropriados** para consultas frequentes
3. **Aplique políticas RLS** para segurança no nível de linha
4. **Mantenha o esquema atualizado** no arquivo `supabase-schema.sql`
5. **Documente migrações** em arquivos separados com timestamps
6. **Use tipos específicos** (como UUID, TIMESTAMP WITH TIME ZONE)
7. **Aplique restrições de chaves estrangeiras** com ON DELETE CASCADE quando apropriado
8. **Adicione comentários** para tabelas e colunas complexas:
   ```sql
   COMMENT ON TABLE usuarios IS 'Armazena informações de usuários da plataforma';
   COMMENT ON COLUMN usuarios.auth_id IS 'ID do usuário no sistema de autenticação do Supabase';
   ```

## Troubleshooting

### Problemas Comuns

1. **Erro de violação de chave estrangeira**:
   - Verifique se o registro referenciado existe
   - Verifique se está tentando excluir um registro que tem dependências

2. **Erro de violação de chave única**:
   - Verifique se já existe um registro com o mesmo valor em uma coluna com restrição UNIQUE

3. **Erro de conexão ao Supabase**:
   - Verifique as variáveis de ambiente
   - Verifique se as chaves do Supabase estão ativas

### Consultas Úteis para Diagnóstico

```sql
-- Verificar tabelas existentes
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verificar estrutura de uma tabela
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'usuarios' 
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT * FROM pg_policies;
```

---

Documentação criada em: 09/04/2024 