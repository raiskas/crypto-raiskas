# Documentação Completa - Crypto Raiskas

Este documento contém a documentação completa do projeto Crypto Raiskas, um sistema de gerenciamento empresarial com foco em gestão de usuários, controle de permissões e módulo de vendas.

## Sumário

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Tecnologias Utilizadas](#2-tecnologias-utilizadas)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Banco de Dados](#4-banco-de-dados)
5. [Sistema de Autenticação e Permissões](#5-sistema-de-autenticação-e-permissões)
6. [Guia de Desenvolvimento](#6-guia-de-desenvolvimento)
7. [Módulo de Criptomoedas](#7-módulo-de-criptomoedas)
8. [Fluxo de Trabalho Git](#8-fluxo-de-trabalho-git)
9. [Implantação](#9-implantação)
10. [Troubleshooting](#10-troubleshooting)
11. [Módulo de Gerenciamento de Usuários](#11-módulo-de-gerenciamento-de-usuários)
12. [Contato e Suporte](#12-contato-e-suporte)

---

## 1. Visão Geral do Projeto

O Crypto Raiskas é uma aplicação web moderna para gerenciamento empresarial, focando em:
- Gestão de usuários com diferentes níveis de acesso
- Sistema robusto de permissões baseado em grupos
- Arquitetura multi-tenant para suportar múltiplas empresas
- Módulo de vendas como exemplo funcional
- **Módulo de gerenciamento de operações de criptomoedas com cálculo de performance FIFO.**
- Interface administrativa para gestão de usuários

A plataforma foi desenvolvida com foco em segurança, escalabilidade e facilidade de manutenção, utilizando tecnologias modernas do ecossistema JavaScript/TypeScript.

## 2. Tecnologias Utilizadas

### Frontend
- **Next.js 15** (React 19) com App Router e Turbopack
- **Tailwind CSS v4** para estilização moderna e responsiva
- Sistema de componentes personalizados baseados na biblioteca shadcn/ui
- **React Hook Form** para gerenciamento de formulários
- **Zod** para validação de tipo em tempo de execução
- Suporte a tema claro/escuro via `next-themes`
- **date-fns** para manipulação e formatação de datas

### Backend
- **Supabase Authentication** para autenticação segura e sem estado
- **PostgreSQL** (via Supabase) para armazenamento persistente de dados
- **Next.js API Routes** para endpoints da API
- **Radix UI** para componentes acessíveis (Dialog, DropdownMenu, etc.)

## 3. Estrutura do Projeto

```
src/
├── app/                     # Páginas e rotas da aplicação (Next.js App Router)
│   ├── (auth)/              # Grupo de rotas para autenticação
│   │   ├── signin/          # Página de login
│   │   └── signup/          # Página de cadastro
│   ├── (dashboard)/         # Grupo de rotas protegidas (painel administrativo)
│   │   ├── admin/           # Área administrativa
│   │   │   ├── page.tsx     # Painel principal admin
│   │   │   └── usuarios/    # Gerenciamento de usuários
│   │   ├── crypto/          # <<< Módulo de Criptomoedas
│   │   │   └── page.tsx     # <<< Página principal do módulo
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── home/            # Página inicial após login
│   │   └── vendas/          # Módulo de vendas
│   ├── api/                 # Rotas da API (Server-side)
│   │   ├── auth/            # Endpoints de autenticação
│   │   │   ├── register/    # Registro de usuários
│   │   │   └── debug/       # Ferramentas de depuração
│   │   ├── admin/           # Endpoints administrativos
│   │   │   └── users/       # Gerenciamento de usuários (CRUD)
│   │   ├── crypto/          # <<< Endpoints do módulo de cripto
│   │   │   ├── operacoes/   # <<< CRUD de operações cripto
│   │   │   ├── performance/ # <<< Cálculo de performance FIFO
│   │   │   ├── relevant-coin-ids/ # <<< Busca IDs de moedas relevantes
│   │   │   └── market-data/ # <<< Busca dados de mercado (CoinGecko via lib)
│   │   └── preco/           # Endpoint para preço do Bitcoin (cacheado) - OBS: Revisar se ainda relevante
│   └── page.tsx             # Página inicial (redireciona para home ou login)
├── components/              # Componentes reutilizáveis
│   ├── crypto/              # <<< Componentes específicos do módulo crypto (OperacaoModal, etc)
│   ├── layouts/             # Componentes de layout
│   ├── ui/                  # Componentes de interface do usuário
│   └── theme-toggle.tsx     # Alternador de tema claro/escuro
├── lib/                     # Funções utilitárias e bibliotecas
│   ├── context/             # <<< Context API Providers
│   │   └── PriceContext.tsx # <<< Contexto para preços de criptomoedas
│   ├── crypto/              # <<< Lógica específica de cripto
│   │   └── fifoCalculations.ts # <<< Implementação do cálculo FIFO
│   ├── hooks/               # React hooks personalizados
│   │   ├── use-auth.ts      # Hook para gerenciamento de autenticação
│   │   ├── use-user-data.ts # Hook para dados do usuário
│   │   └── usePrice.ts      # <<< Hook para consumir o PriceContext
│   ├── supabase/            # Integrações com Supabase
│   │   ├── client.ts        # Cliente Supabase para o navegador
│   │   ├── client-helpers.ts # Funções auxiliares do cliente
│   │   └── server.ts        # Cliente Supabase para o servidor
│   ├── utils/               # Funções utilitárias
│   │   └── permissions.ts   # Utilitários para verificação de permissões
│   └── coingecko.ts         # <<< Funções para interagir com a API CoinGecko
├── types/                   # Definições de tipos TypeScript
│   ├── crypto.ts            # <<< Tipos específicos do módulo crypto (Operacao, PerformanceMetrics, etc)
│   └── supabase.ts          # <<< Tipos gerados do esquema Supabase
└── middleware.ts            # Middleware do Next.js para proteção de rotas
```

## 4. Banco de Dados

O projeto utiliza PostgreSQL hospedado no Supabase com uma arquitetura multi-tenant.

### Estrutura do Banco de Dados

#### Diagrama de Entidade-Relacionamento (ER)

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
  ├── is_master (BOOLEAN)
  ├── telas_permitidas (TEXT[])
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

crypto_operacoes
  ├── id (PK, UUID)
  ├── moeda_id (TEXT, NOT NULL) - ID da moeda (ex: 'bitcoin', 'ethereum')
  ├── simbolo (TEXT, NOT NULL) - Símbolo da moeda (ex: 'btc', 'eth')
  ├── nome (TEXT, NOT NULL) - Nome da moeda (ex: 'Bitcoin', 'Ethereum')
  ├── tipo (TEXT, NOT NULL, CHECK tipo IN ('compra', 'venda')) - Tipo da operação
  ├── quantidade (NUMERIC, NOT NULL) - Quantidade de moedas negociadas
  ├── preco_unitario (NUMERIC, NOT NULL) - Preço por unidade da moeda na operação
  ├── valor_total (NUMERIC, NOT NULL) - Valor total da operação (quantidade * preco_unitario)
  ├── taxa (NUMERIC, DEFAULT 0) - Taxas associadas à operação
  ├── data_operacao (TIMESTAMP WITH TIME ZONE, NOT NULL) - Data e hora da operação
  ├── exchange (TEXT) - Exchange onde a operação ocorreu (opcional)
  ├── notas (TEXT) - Notas adicionais (opcional)
  ├── usuario_id (UUID, FK -> usuarios.id, NOT NULL) - Usuário que realizou a operação
  ├── grupo_id (UUID, FK -> grupos.id) - Grupo associado à operação (opcional)
  ├── criado_em (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
  └── atualizado_em (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
```

### Restrições e Consistência

O sistema implementa verificações de integridade para evitar dados inconsistentes:

- **Chave única `auth_id`**: Garante que cada usuário na tabela `auth.users` tenha apenas um registro na tabela `usuarios`.
- **Chave única `email`**: Garante que não existam emails duplicados na tabela `usuarios`.
- **Verificação de Existência**: As APIs verificam a existência de registros em ambas as tabelas `auth.users` e `usuarios` antes de criar novos registros.
- **Transações Atômicas**: Operações que afetam múltiplas tabelas são gerenciadas com tratamento de erros abrangente para evitar dados órfãos.

### Configuração Inicial

O arquivo `supabase-schema.sql` contém todas as definições de tabelas e dados iniciais. Para configurar o banco de dados:

```bash
pnpm db:init
```

### Migrações de Banco de Dados

Para realizar alterações no banco de dados:

1. **Crie um arquivo SQL na pasta `scripts/migrations/`** com nome descritivo
2. **Defina as alterações no arquivo SQL**
3. **Atualize o arquivo `supabase-schema.sql`** para manter o esquema atualizado
4. **Execute a migração**: `pnpm db:migrate` ou manualmente no Editor SQL do Supabase

### Transações

Para operações que modificam múltiplas tabelas, utilize transações para garantir a integridade dos dados:

```typescript
const { error } = await supabase.rpc('update_usuario_transacao', {
  p_usuario_id: userId,
  p_nome: nome,
  p_email: email
});
```

### Índices e Performance

O esquema inclui índices para otimizar consultas comuns:

```sql
CREATE INDEX idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX idx_grupos_empresa_id ON grupos(empresa_id);
CREATE INDEX idx_vendas_empresa_id ON vendas(empresa_id);
CREATE INDEX idx_vendas_usuario_id ON vendas(usuario_id);
```

Adicionar índices relevantes para `crypto_operacoes`:
```sql
CREATE INDEX idx_crypto_operacoes_usuario_id ON crypto_operacoes(usuario_id);
CREATE INDEX idx_crypto_operacoes_moeda_id ON crypto_operacoes(moeda_id);
CREATE INDEX idx_crypto_operacoes_data_operacao ON crypto_operacoes(data_operacao);
```

### Políticas de Segurança (RLS)

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
```

Adicionar política para `crypto_operacoes`:
```sql
-- Habilitar RLS
ALTER TABLE crypto_operacoes ENABLE ROW LEVEL SECURITY;

-- Criar política para que usuários vejam/modifiquem apenas suas próprias operações
CREATE POLICY "Usuários podem gerenciar apenas suas próprias operações de cripto"
  ON crypto_operacoes
  FOR ALL
  USING (
    auth.uid() = (SELECT auth_id FROM usuarios WHERE id = usuario_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT auth_id FROM usuarios WHERE id = usuario_id)
  );
```

## 5. Sistema de Autenticação e Permissões

### Arquitetura de Autenticação

O sistema utiliza uma abordagem em camadas:

1. **Supabase Auth**: Gerencia o registro, login e sessões dos usuários
2. **Tabelas Personalizadas**: Armazenam dados adicionais dos usuários e seus relacionamentos
3. **Middleware**: Protege rotas com base no estado de autenticação
4. **Verificação de Permissões**: Controla o acesso a funcionalidades específicas

### Fluxo de Autenticação

1. **Registro de Usuário**:
   - O usuário preenche o formulário de cadastro
   - O sistema verifica a existência do email em ambas as tabelas (auth e usuarios)
   - O sistema cria um usuário no Supabase Auth
   - Dados adicionais são armazenados nas tabelas personalizadas
   - Se qualquer passo falhar, a operação é revertida para manter a consistência

2. **Login**:
   - O usuário fornece e-mail e senha
   - O Supabase Auth valida as credenciais e retorna um token JWT
   - O usuário é redirecionado para a página home

3. **Proteção de Rotas**:
   - O middleware verifica se o usuário está autenticado para acessar rotas protegidas
   - Usuários não autenticados são redirecionados para a página de login

### Hook de Autenticação (`useAuth`)

```typescript
const { user, loading, signIn, signUp, signOut, isAuthenticated } = useAuth();
```

### Modelo de Permissões

- **Permissões**: Representam ações específicas que podem ser executadas
- **Grupos**: Agrupam permissões e são atribuídos a usuários
- **Usuários**: Pertencem a um ou mais grupos e herdam suas permissões

### Permissões Padrão

| Nome | Descrição | Módulo |
|------|-----------|--------|
| `usuario_visualizar` | Visualizar usuários | usuarios |
| `usuario_criar` | Criar usuários | usuarios |
| `usuario_editar` | Editar usuários | usuarios |
| `usuario_excluir` | Excluir usuários | usuarios |
| `grupo_visualizar` | Visualizar grupos | grupos |
| `grupo_criar` | Criar grupos | grupos |
| `grupo_editar` | Editar grupos | grupos |
| `grupo_excluir` | Excluir grupos | grupos |
| `venda_visualizar` | Visualizar vendas | vendas |
| `venda_criar` | Criar vendas | vendas |
| `venda_editar` | Editar vendas | vendas |
| `venda_excluir` | Excluir vendas | vendas |

### Verificação de Permissões

```typescript
import { hasPermission } from "@/lib/utils/permissions";

// Em uma rota de API
export async function GET(request) {
  const userId = "..."; // Obter do contexto de autenticação
  
  // Verificar permissão
  const canViewUsers = await hasPermission(userId, "usuario_visualizar");
  
  if (!canViewUsers) {
    return new Response(JSON.stringify({ error: "Sem permissão" }), {
      status: 403,
    });
  }
  
  // Continuar processamento...
}
```

## 6. Guia de Desenvolvimento

### Configuração do Ambiente

1. **Requisitos**:
   - Node.js v18+ (preferencialmente v20+)
   - pnpm v8+
   - Conta no Supabase

2. **Passos para Configuração**:
   ```bash
   # Clone o repositório
   git clone <url-do-repositorio>
   cd crypto_raiskas
   
   # Instale as dependências
   pnpm install
   
   # Configure as variáveis de ambiente (.env.local)
   NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
   SUPABASE_SERVICE_ROLE_KEY=sua_chave_de_servico
   
   # Configure o banco de dados
   pnpm db:init
   
   # Inicie o servidor de desenvolvimento
   pnpm dev
   ```

### Rotas Principais

| Rota | Descrição |
|------|-----------|
| `/signin` | Login de usuários |
| `/signup` | Registro de novos usuários |
| `/home` | Página inicial após login |
| `/admin` | Painel de administração |
| `/admin/usuarios` | Gerenciamento de usuários |

### Endpoints da API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/auth/register` | POST | Registro de usuários |
| `/api/admin/users` | GET | Listar usuários |
| `/api/admin/users` | POST | Criar usuário |
| `/api/admin/users` | PATCH | Atualizar usuário |
| `/api/admin/users?id=:id` | DELETE | Excluir/Desativar usuário |

### Padrões de Código

- **Estado Compartilhado (Ex: Preços Crypto)**: Para dados que precisam ser acessíveis em múltiplos componentes do dashboard (como preços de criptomoedas atualizados), utilize o padrão Context API. Exemplo implementado: `PriceProvider` e `usePrice` (em `src/lib/context/PriceContext.tsx`) para o preço do Bitcoin. Use `usePrice()` em qualquer Client Component dentro do `(dashboard)/layout.tsx` para acessar o valor.

#### Componentes

```tsx
// src/components/ExampleComponent.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ExampleComponentProps {
  initialValue: number;
  onChange?: (value: number) => void;
}

export function ExampleComponent({ 
  initialValue = 0, 
  onChange 
}: ExampleComponentProps) {
  const [value, setValue] = useState(initialValue);
  
  const handleIncrement = () => {
    const newValue = value + 1;
    setValue(newValue);
    onChange?.(newValue);
  };
  
  return (
    <div className="p-4 border rounded">
      <p>Valor atual: {value}</p>
      <Button onClick={handleIncrement}>Incrementar</Button>
    </div>
  );
}
```

#### Página

```tsx
// src/app/example/page.tsx
"use client";

import { useState } from "react";
import { ExampleComponent } from "@/components/ExampleComponent";
import { useAuth } from "@/lib/hooks/use-auth";

export default function ExamplePage() {
  const { user } = useAuth();
  const [value, setValue] = useState(0);
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Página de Exemplo</h1>
      {user ? (
        <>
          <p>Olá, {user.email}</p>
          <ExampleComponent 
            initialValue={value} 
            onChange={setValue} 
          />
        </>
      ) : (
        <p>Carregando...</p>
      )}
    </div>
  );
}
```

#### Rota de API

```tsx
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/utils/permissions";

// Schema de validação
const exampleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3),
});

export async function POST(request: NextRequest) {
  try {
    // Obter e validar os dados
    const body = await request.json();
    const validation = exampleSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { name, id } = validation.data;
    
    // Criar cliente Supabase
    const supabase = await createServerSupabaseClient();
    
    // Obter sessão atual
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }
    
    // Verificar permissão
    const userId = session.user.id;
    const hasAccess = await hasPermission(userId, "example_create");
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Sem permissão" },
        { status: 403 }
      );
    }
    
    // Processar a solicitação
    // ...
    
    return NextResponse.json(
      { message: "Sucesso", data: { id: "novo_id" } },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error("Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
```

### Adicionando Novas Features

1. **Comece com o banco de dados**:
   - Adicione tabelas/campos necessários no PostgreSQL
   - Atualize o arquivo `supabase-schema.sql`

2. **Crie componentes reutilizáveis**:
   - Coloque-os em `/src/components`
   - Siga o padrão existente para componentes

3. **Implemente páginas**:
   - Crie um novo diretório em `/src/app`
   - Implemente `page.tsx` seguindo o padrão App Router

4. **Adicione rotas de API**:
   - Crie endpoints em `/src/app/api`
   - Use validação Zod para dados de entrada

5. **Atualize o middleware**:
   - Adicione a rota ao middleware se ela for protegida

## 7. Módulo de Criptomoedas

Este módulo permite aos usuários registrar suas operações de compra e venda de criptomoedas e visualizar a performance de seu portfólio calculado usando o método FIFO (First-In, First-Out).

### Funcionalidades

- **Registro de Operações:** Formulário modal (`OperacaoModal`) para adicionar ou editar operações de compra/venda, incluindo moeda, quantidade, preço, data, taxas, etc.
- **Listagem de Operações:** Tabela na página `/crypto` exibindo o histórico de operações do usuário, com filtros e ordenação.
- **Visualização de Portfólio:** Tabela consolidada na página `/crypto` mostrando a posição atual em cada moeda:
    - Quantidade Atual
    - Custo Médio (FIFO)
    - Custo Base Atual (FIFO)
    - Preço Atual (via `PriceContext`)
    - Valor Total Atual (recalculado no frontend)
    - L/P Não Realizado (recalculado no frontend)
    - % Não Realizado (recalculado no frontend)
    - L/P Realizado Total (FIFO)
- **Cards de Resumo:** Exibição dos totais do portfólio (Valor Total, Custo Base, P/L Não Realizado, P/L Realizado).

### Lógica de Cálculo FIFO

- **Função Principal:** `calcularPerformanceFifo` em `src/lib/crypto/fifoCalculations.ts`.
- **Entrada:** Recebe um array de operações (compras/vendas) para **uma única moeda**, ordenadas por data, e o preço de mercado atual dessa moeda.
- **Processamento:**
    1.  Mantém uma lista de "lotes" de compra abertos (`lotesCompraAbertos`), armazenando quantidade, preço de custo unitário e data de cada compra.
    2.  Itera sobre as operações ordenadas:
        - **Compra:** Adiciona um novo lote à lista.
        - **Venda:** Consome os lotes da lista na ordem FIFO (primeiro que entrou). Para cada lote consumido (total ou parcialmente), calcula o custo base proporcional dessa parte vendida. A diferença entre o valor da venda (quantidade vendida * preço de venda) e o custo base dos lotes consumidos é o lucro/prejuízo realizado para aquela venda.
    3.  Acumula o `lucroPrejuizoRealizadoTotal`.
- **Saída:** Retorna um objeto `PerformanceMetrics` contendo:
    - `quantidadeAtual`: Soma das quantidades restantes nos lotes de compra abertos.
    - `custoBaseTotalAtual`: Custo total dos lotes restantes.
    - `custoMedioAtual`: Custo médio ponderado dos lotes restantes.
    - `lucroPrejuizoRealizadoTotal`: Lucro/prejuízo acumulado de todas as vendas processadas.
    - `valorDeMercadoAtual`: Calculado usando o `precoAtualMercado` fornecido como argumento.
    - `lucroPrejuizoNaoRealizado`: Diferença entre `valorDeMercadoAtual` e `custoBaseTotalAtual`.
    - `lucroPrejuizoNaoRealizadoPercentual`.

### API de Performance (`GET /api/crypto/performance`)

- **Responsabilidade:** Orquestrar o cálculo FIFO para todas as moedas do usuário.
- **Fluxo:**
    1.  Obtém o ID do usuário autenticado.
    2.  Busca todas as operações (`crypto_operacoes`) do usuário no banco de dados.
    3.  Agrupa as operações por `moeda_id`.
    4.  Busca os preços de mercado atuais para todas as `moeda_id`s encontradas usando `fetchMarketDataByIds` (`src/lib/coingecko.ts`).
    5.  Itera sobre cada `moeda_id`:
        - **Cria uma cópia profunda** (`JSON.parse(JSON.stringify(...))`) do array de operações daquela moeda para garantir isolamento.
        - Chama `calcularPerformanceFifo` passando a cópia profunda das operações e o preço de mercado atual da moeda.
        - Armazena o resultado (`PerformanceMetrics`) para aquela moeda.
    6.  Calcula um sumário geral (total realizado, não realizado, valor de mercado).
    7.  Retorna um JSON contendo o objeto `performance` (com a performance detalhada por moeda) e o objeto `summary`.

### Fluxo de Dados no Frontend (`CryptoPage`)

1.  **Busca de Dados:** O componente busca dados de duas fontes principais:
    - Performance FIFO: Chama a API `/api/crypto/performance` para obter os cálculos base (quantidade, custo base, P/L realizado).
    - Preços Atuais: Usa o hook `usePrice` para obter o mapa de preços mais recentes do `PriceContext`.
    - Operações: Chama a API `/api/crypto/operacoes` para popular a tabela de histórico.
2.  **Processamento (`calcularPortfolio`):**
    - Itera sobre os dados de performance recebidos da API.
    - Para cada moeda, pega os valores FIFO fundamentais (quantidade, custo base, P/L realizado).
    - Obtém o `precoAtual` do `PriceContext`.
    - **Recalcula** o `valorAtualizado` (valor de mercado) e `lucro` (P/L não realizado) usando a `quantidadeAtual` (da API) e o `precoAtual` (do Context).
    - Monta o objeto final para exibição na tabela do portfólio.
3.  **Renderização:** Exibe os dados processados nas tabelas e cards, usando funções de formatação (`formatarMoeda`, `formatarQuantidade`, etc.).

## 8. Fluxo de Trabalho Git

### Branches

- `main`: Código de produção
- `develop`: Código de desenvolvimento
- `feature/nome-da-feature`: Implementação de novas funcionalidades
- `bugfix/nome-do-bug`: Correções de bugs

### Commits

```
[tipo]: Breve descrição da alteração

Descrição mais detalhada se necessário.
```

Tipos comuns:
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Alterações na documentação
- `style`: Formatação, ponto e vírgula ausentes; sem alteração de código
- `refactor`: Refatoração de código de produção
- `test`: Adição de testes, refatoração de testes
- `chore`: Atualização de tarefas de compilação, configurações

### Pull Requests

- Descreva claramente o que foi implementado
- Referencie issues relacionadas
- Solicite revisão de pelo menos um colega de equipe

## 9. Implantação

### Ambiente de Desenvolvimento

- Acessível através de `http://localhost:3000`
- Usa o banco de dados configurado no Supabase

### Ambiente de Produção

- Build para produção:
  ```bash
  pnpm build
  ```

- Iniciar em produção:
  ```bash
  pnpm start
  ```

## 10. Troubleshooting

### Problemas Comuns

1.  **Erro de violação de chave estrangeira / única**:
    *   Verifique se os dados referenciados existem ou se há duplicatas.

2.  **Erro de conexão ao Supabase**:
    *   Verifique as variáveis de ambiente (`.env.local`).

3.  **Redirecionamento em loop**:
    *   Verifique o `middleware.ts` e o estado de autenticação no `useAuth`.

4.  **Imagens Externas Não Carregam (`next/image`)**
    *   **Sintoma:** Erro `hostname "..." is not configured under images in your next.config.js`.
    *   **Solução:** Adicione o hostname necessário ao array `images.remotePatterns` no arquivo `next.config.js` e reinicie o servidor de desenvolvimento. (Ex: `cryptoicons.org` foi adicionado recentemente).

5.  **Edição de Grupo Não Carrega Dados Completos (Empresa/Permissões)**
    *   **Sintoma:** Ao editar um grupo, apenas o nome é preenchido; empresa e telas permitidas não são selecionados/marcados.
    *   **Causa Raiz:** A API do backend que retorna a lista inicial de grupos (provavelmente `GET /api/admin/groups`) não está incluindo os campos `empresa_id` e `telas_permitidas` em sua resposta, mesmo que eles existam no banco.
    *   **Solução:** A correção **deve ser feita no backend**, modificando a consulta SQL da API para incluir esses campos. O código frontend (`GroupSection.tsx`) já está preparado para usá-los quando fornecidos.

## 11. Módulo de Gerenciamento de Usuários

### Edição de Grupos

*   **Funcionalidade:** Permite editar nome, descrição, status de master e telas permitidas de um grupo existente.
*   **Implementação:** Modal acessado pela tabela de grupos (`GroupSection.tsx`).
*   **Observação Importante:** Atualmente, devido a dados incompletos retornados pela API que carrega a lista inicial de grupos (falta de `empresa_id` e `telas_permitidas`), o modal de edição só consegue pré-preencher o nome do grupo. A funcionalidade completa depende da correção da API no backend. Veja a seção Troubleshooting para mais detalhes.

## 12. Contato e Suporte

Para suporte ou dúvidas sobre o projeto, entre em contato com:

- **Equipe de desenvolvimento**: dev@exemplo.com
- **Repositório**: [GitHub - Crypto Raiskas](#)

---

Documentação atualizada em: DD/MM/YYYY - Preencher Data Atual 