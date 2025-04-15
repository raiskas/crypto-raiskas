# Documentação Completa - Crypto Raiskas

Este documento contém a documentação completa do projeto Crypto Raiskas, um sistema de gerenciamento empresarial com foco em gestão de usuários, controle de permissões e módulo de vendas.

## Sumário

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Tecnologias Utilizadas](#2-tecnologias-utilizadas)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Banco de Dados](#4-banco-de-dados)
5. [Sistema de Autenticação e Permissões](#5-sistema-de-autenticação-e-permissões)
6. [Guia de Desenvolvimento](#6-guia-de-desenvolvimento)
7. [Fluxo de Trabalho Git](#7-fluxo-de-trabalho-git)
8. [Implantação](#8-implantação)
9. [Troubleshooting](#9-troubleshooting)
10. [Módulo de Gerenciamento de Usuários](#10-módulo-de-gerenciamento-de-usuários)
11. [Contato e Suporte](#11-contato-e-suporte)

---

## 1. Visão Geral do Projeto

O Crypto Raiskas é uma aplicação web moderna para gerenciamento empresarial, focando em:
- Gestão de usuários com diferentes níveis de acesso
- Sistema robusto de permissões baseado em grupos
- Arquitetura multi-tenant para suportar múltiplas empresas
- Módulo de vendas como exemplo funcional
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
│   │   ├── home/            # Página inicial após login
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── admin/           # Área administrativa
│   │   │   ├── page.tsx     # Painel principal admin
│   │   │   └── usuarios/    # Gerenciamento de usuários
│   │   └── vendas/          # Módulo de vendas
│   ├── api/                 # Rotas da API (Server-side)
│   │   ├── auth/            # Endpoints de autenticação
│   │   │   ├── register/    # Registro de usuários
│   │   │   └── debug/       # Ferramentas de depuração
│   │   └── admin/           # Endpoints administrativos
│   │       └── users/       # Gerenciamento de usuários (CRUD)
│   └── page.tsx             # Página inicial (redireciona para home ou login)
├── components/              # Componentes reutilizáveis
│   ├── layouts/             # Componentes de layout
│   ├── ui/                  # Componentes de interface do usuário
│   │   ├── button.tsx       # Botões padronizados
│   │   ├── card.tsx         # Cards para layout
│   │   ├── dialog.tsx       # Modais e diálogos
│   │   ├── form.tsx         # Componentes de formulário
│   │   ├── table.tsx        # Tabelas de dados
│   │   └── badge.tsx        # Emblemas para status
│   └── theme-toggle.tsx     # Alternador de tema claro/escuro
├── lib/                     # Funções utilitárias e bibliotecas
│   ├── hooks/               # React hooks personalizados
│   │   ├── use-auth.ts      # Hook para gerenciamento de autenticação
│   │   └── use-user-data.ts # Hook para dados do usuário
│   ├── supabase/            # Integrações com Supabase
│   │   ├── client.ts        # Cliente Supabase para o navegador
│   │   ├── client-helpers.ts # Funções auxiliares do cliente
│   │   └── server.ts        # Cliente Supabase para o servidor
│   └── utils/               # Funções utilitárias
│       └── permissions.ts   # Utilitários para verificação de permissões
├── types/                   # Definições de tipos TypeScript
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

## 7. Fluxo de Trabalho Git

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

## 8. Implantação

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

## 9. Troubleshooting

### Problemas de Autenticação

1. **Usuário autenticado mas sem acesso a recursos**:
   - Verifique se o usuário está conectado a uma empresa
   - Verifique se o usuário pertence a pelo menos um grupo
   - Verifique se os grupos têm as permissões necessárias

2. **Erro "Supabase client is not initialized"**:
   - Verifique se as variáveis de ambiente estão configuradas corretamente
   - Reinicie o servidor de desenvolvimento

3. **Redirecionamento em loop**:
   - Verifique o middleware e as regras de redirecionamento
   - Verifique o estado de autenticação no hook `useAuth`

### Problemas de Banco de Dados

1. **Erro de violação de chave estrangeira**:
   - Verifique se o registro referenciado existe
   - Verifique se está tentando excluir um registro que tem dependências

2. **Erro de violação de chave única**:
   - Verifique se já existe um registro com o mesmo valor em uma coluna com restrição UNIQUE
   - Para emails duplicados, verifique tanto a tabela `auth.users` quanto a tabela `usuarios`

3. **Erro de conexão ao Supabase**:
   - Verifique as variáveis de ambiente
   - Verifique se as chaves do Supabase estão ativas

### Erros Comuns e Soluções

1. **"duplicate key value violates unique constraint 'usuarios_email_key'"**:
   - Verifique se o email já existe na tabela `usuarios`
   - Verifique se o mesmo email existe na tabela `auth.users` mas sem correspondência em `usuarios`
   - Utilize a API `/api/auth/debug` para diagnosticar inconsistências

2. **"You cannot have two parallel pages that resolve to the same path"**:
   - Certifique-se de que não existem arquivos `page.tsx` em caminhos que se resolveriam para a mesma URL
   - Lembre-se que grupos de rotas como `(dashboard)` não afetam o caminho da URL

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

-- Verificar emails duplicados
SELECT email, COUNT(*) 
FROM usuarios 
GROUP BY email 
HAVING COUNT(*) > 1;

-- Verificar registros em usuarios sem correspondência em auth.users
SELECT u.* 
FROM usuarios u 
LEFT JOIN auth.users a ON u.auth_id = a.id 
WHERE a.id IS NULL;
```

## 10. Módulo de Gerenciamento de Usuários

### Visão Geral

O módulo de gerenciamento de usuários permite:
- Listar todos os usuários do sistema
- Criar novos usuários
- Editar informações de usuários existentes
- Alterar senhas
- Desativar/remover usuários

### Interface de Usuário

O módulo possui uma interface completa com:
- Tabela responsiva para listar usuários
- Modais para criar, editar, alterar senha e remover usuários
- Indicadores visuais de status (ativo/inativo)
- Formulários com validação em tempo real

### API de Gerenciamento

#### Listar Usuários

```typescript
// GET /api/admin/users
const response = await fetch('/api/admin/users');
const data = await response.json();
// data.users contém a lista de usuários
```

#### Criar Usuário

```typescript
// POST /api/admin/users
const response = await fetch('/api/admin/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    nome: 'Nome do Usuário',
    email: 'usuario@exemplo.com',
    password: 'senha123',
    empresa_id: 'id-da-empresa', // opcional
    ativo: true, // opcional, padrão: true
  }),
});
```

#### Atualizar Usuário

```typescript
// PATCH /api/admin/users
const response = await fetch('/api/admin/users', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    id: 'id-do-usuario', // ID na tabela auth.users
    nome: 'Novo Nome', // opcional
    email: 'novo-email@exemplo.com', // opcional
    password: 'nova-senha', // opcional
    empresa_id: 'nova-empresa-id', // opcional
    ativo: false, // opcional
  }),
});
```

#### Remover Usuário

```typescript
// DELETE /api/admin/users?id=:id
const response = await fetch(`/api/admin/users?id=${userId}`, {
  method: 'DELETE',
});
```

### Tratamento de Casos Especiais

O módulo implementa verificações robustas para:

1. **Prevenção de Duplicações**:
   - Verifica a existência do email em auth.users antes de criar
   - Verifica a existência do email em usuarios antes de criar
   - Tratamento específico para violações de chave única

2. **Consistência de Dados**:
   - Se a criação falhar em qualquer estágio, todas as operações são revertidas
   - Registros em auth.users sem correspondência em usuarios são removidos
   - Detecção e tratamento de erros de diversos tipos

3. **Segurança**:
   - Validação de dados de entrada com Zod
   - Proteção contra remoção acidental (confirmação necessária)
   - Feedback visual de ações (sucesso/erro)

### Próximos Passos

Melhorias planejadas para o módulo:
- Implementação de paginação para a tabela de usuários
- Adição de filtros de busca por nome e email
- Exportação de dados em formato CSV/Excel
- Histórico de ações por usuário

## 11. Contato e Suporte

Para suporte ou dúvidas sobre o projeto, entre em contato com:

- **Equipe de desenvolvimento**: dev@exemplo.com
- **Repositório**: [GitHub - Crypto Raiskas](#)

---

Documentação atualizada em: 10/04/2024 