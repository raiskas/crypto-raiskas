# Documentação do Projeto Crypto Raiskas

## Visão Geral

O Crypto Raiskas é uma aplicação web moderna construída para gerenciamento empresarial, focando em gestão de usuários, controle de permissões e módulo de vendas. A plataforma é desenvolvida utilizando tecnologias modernas e uma arquitetura escalável, permitindo a criação de um sistema seguro, eficiente e de fácil manutenção.

## Tecnologias Principais

- **Frontend**: [Next.js 15](https://nextjs.org/) (React 19) com App Router e Turbopack
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/) v4 para estilização moderna e responsiva
- **UI Components**: Sistema de componentes personalizados baseados na biblioteca shadcn/ui
- **Autenticação**: [Supabase Authentication](https://supabase.io/auth) para autenticação segura e sem estado
- **Banco de Dados**: PostgreSQL (via Supabase) para armazenamento persistente de dados
- **Validação**: [Zod](https://github.com/colinhacks/zod) para validação de tipo em tempo de execução
- **Formulários**: [React Hook Form](https://react-hook-form.com/) para gerenciamento de formulários
- **Temas**: Suporte a tema claro/escuro via `next-themes`

## Estrutura do Projeto

```
src/
├── app/                     # Páginas e rotas da aplicação (Next.js App Router)
│   ├── (auth)/              # Grupo de rotas para autenticação
│   │   ├── signin/          # Página de login
│   │   └── signup/          # Página de cadastro
│   ├── (dashboard)/         # Grupo de rotas protegidas (painel administrativo)
│   │   ├── dashboard/       # Dashboard principal
│   │   └── vendas/          # Módulo de vendas
│   ├── api/                 # Rotas da API (Server-side)
│   │   └── auth/            # Endpoints de autenticação
│   ├── home/                # Página inicial após login
│   ├── layout.tsx           # Layout principal da aplicação
│   └── page.tsx             # Página inicial (redireciona para home ou login)
├── components/              # Componentes reutilizáveis
│   ├── layouts/             # Componentes de layout
│   ├── ui/                  # Componentes de interface do usuário
│   └── theme-toggle.tsx     # Alternador de tema claro/escuro
├── lib/                     # Funções utilitárias e bibliotecas
│   ├── hooks/               # React hooks personalizados
│   │   └── use-auth.ts      # Hook para gerenciamento de autenticação
│   ├── supabase/            # Integrações com Supabase
│   │   ├── client.ts        # Cliente Supabase para o navegador
│   │   ├── client-helpers.ts # Funções auxiliares do cliente
│   │   └── server.ts        # Cliente Supabase para o servidor
│   └── utils/               # Funções utilitárias
│       └── permissions.ts   # Utilitários para verificação de permissões
├── types/                   # Definições de tipos TypeScript
└── middleware.ts            # Middleware do Next.js para proteção de rotas
```

## Banco de Dados

O projeto utiliza PostgreSQL hospedado no Supabase com o seguinte esquema:

### Tabelas Principais

1. **empresas** - Armazena informações sobre as empresas cadastradas
   - `id` (UUID, PK)
   - `nome` (VARCHAR)
   - `cnpj` (VARCHAR, opcional)
   - `email` (VARCHAR, opcional)
   - `telefone` (VARCHAR, opcional)
   - `criado_em` (TIMESTAMP)
   - `atualizado_em` (TIMESTAMP)

2. **usuarios** - Armazena informações dos usuários da plataforma
   - `id` (UUID, PK)
   - `auth_id` (UUID) - Referência ao ID do usuário no Supabase Auth
   - `nome` (VARCHAR)
   - `email` (VARCHAR)
   - `empresa_id` (UUID, FK) - Referência à empresa do usuário
   - `ativo` (BOOLEAN)
   - `criado_em` (TIMESTAMP)
   - `atualizado_em` (TIMESTAMP)

3. **grupos** - Grupos de permissões
   - `id` (UUID, PK)
   - `nome` (VARCHAR)
   - `descricao` (TEXT, opcional)
   - `empresa_id` (UUID, FK) - Empresa à qual o grupo pertence
   - `criado_em` (TIMESTAMP)
   - `atualizado_em` (TIMESTAMP)

4. **permissoes** - Permissões disponíveis no sistema
   - `id` (UUID, PK)
   - `nome` (VARCHAR)
   - `descricao` (TEXT, opcional)
   - `modulo` (VARCHAR) - Módulo ao qual a permissão se refere
   - `criado_em` (TIMESTAMP)
   - `atualizado_em` (TIMESTAMP)

### Tabelas de Relacionamento

1. **grupos_permissoes** - Relação muitos-para-muitos entre grupos e permissões
   - `grupo_id` (UUID, FK)
   - `permissao_id` (UUID, FK)
   - `criado_em` (TIMESTAMP)

2. **usuarios_grupos** - Relação muitos-para-muitos entre usuários e grupos
   - `usuario_id` (UUID, FK)
   - `grupo_id` (UUID, FK)
   - `criado_em` (TIMESTAMP)

### Outras Tabelas

1. **vendas** - Registro de vendas (módulo de exemplo)
   - `id` (UUID, PK)
   - `numero` (VARCHAR)
   - `cliente` (VARCHAR)
   - `valor_total` (DECIMAL)
   - `data_venda` (TIMESTAMP)
   - `status` (VARCHAR)
   - `empresa_id` (UUID, FK)
   - `usuario_id` (UUID, FK, opcional)
   - `criado_em` (TIMESTAMP)
   - `atualizado_em` (TIMESTAMP)

## Fluxo de Autenticação

1. **Registro de Usuário**:
   - O usuário preenche o formulário de cadastro (nome, e-mail, senha, empresa)
   - O sistema cria um usuário no Supabase Auth
   - Dados adicionais são armazenados nas tabelas personalizadas (empresas, usuarios)
   - Um grupo "Administradores" é criado para a empresa
   - O usuário é adicionado ao grupo "Administradores"
   - Todas as permissões são concedidas ao grupo "Administradores"

2. **Login**:
   - O usuário fornece e-mail e senha
   - O Supabase Auth valida as credenciais e retorna um token JWT
   - O usuário é redirecionado para a página home

3. **Proteção de Rotas**:
   - O middleware verifica se o usuário está autenticado para acessar rotas protegidas
   - Usuários não autenticados são redirecionados para a página de login
   - Usuários autenticados são redirecionados para a página home quando tentam acessar as páginas de autenticação

4. **Verificação de Permissões**:
   - Funções utilitárias verificam se o usuário possui as permissões necessárias para realizar ações específicas
   - Permissões são verificadas consultando os grupos do usuário e suas permissões associadas

## Configuração do Ambiente

### Requisitos

- Node.js v18+ (recomendado v20+)
- pnpm v8+ (gerenciador de pacotes)
- Conta no Supabase (para banco de dados e autenticação)

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_do_supabase
```

### Instalação

1. Clone o repositório
2. Instale as dependências:
   ```bash
   pnpm install
   ```
3. Configure o banco de dados:
   ```bash
   pnpm db:init
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   pnpm dev
   ```
5. Acesse a aplicação em `http://localhost:3000`

## Recursos e Características

### Autenticação e Autorização

- Login e registro com e-mail/senha
- Sistema de permissões baseado em grupos
- Proteção de rotas via middleware
- Verificação de permissões para ações específicas

### Multitenancy

- Cada empresa possui seus próprios usuários, grupos e permissões
- Dados isolados por empresa
- Suporte a múltiplas empresas na mesma instância da aplicação

### Temas

- Suporte a temas claro e escuro
- Persistência da preferência de tema via cookies
- Alternância de tema via componente `ThemeToggle`

### Componentes UI

- Design system consistente com componentes reutilizáveis
- Componentes acessíveis e responsivos
- Implementação de formulários com validação

## Guia de Desenvolvimento

### Adicionando Novas Páginas

1. Crie um novo diretório em `src/app/` seguindo a convenção de nomenclatura
2. Implemente seu componente de página (`page.tsx`)
3. Atualize o middleware se a página precisar ser protegida

### Adicionando Novas Funcionalidades

1. Siga a arquitetura existente e padrões de código
2. Crie componentes reutilizáveis em `src/components/`
3. Adicione hooks personalizados em `src/lib/hooks/` se necessário
4. Implemente funções utilitárias em `src/lib/utils/`

### Estendendo o Banco de Dados

1. Crie tabelas adicionais seguindo o padrão de nomenclatura existente
2. Adicione relacionamentos apropriados e chaves estrangeiras
3. Atualize o arquivo `supabase-schema.sql` com suas alterações
4. Execute as alterações no seu banco de dados Supabase

## Segurança

- Senhas são gerenciadas pelo Supabase Auth (bcrypt)
- Autenticação baseada em JWT para sessões sem estado
- Proteção de rotas via middleware
- Verificação de permissões para ações sensíveis
- Variáveis de ambiente para armazenar chaves seguras
- Validação de dados de entrada com Zod

## Limites e Considerações

- A aplicação é otimizada para navegadores modernos
- O código é organizado para facilitar manutenção e escalabilidade
- Supabase é usado para autenticação e banco de dados

## Contato e Suporte

Para suporte ou dúvidas sobre o projeto, entre em contato com:

- **Equipe de desenvolvimento**: dev@exemplo.com
- **Repositório**: [GitHub - Crypto Raiskas](#)

## Estado Atual

O projeto está funcional com as seguintes capacidades:
*   Autenticação completa (Registro, Login, Proteção de Rotas).
*   Layout de Dashboard com navegação (Menu Lateral e Superior) e suporte a Dark Mode.
*   Estrutura de Banco de Dados implementada no Supabase.
*   Módulo de Gerenciamento de Usuários funcional (CRUD completo).

**Problemas Conhecidos:**
*   A funcionalidade de Edição de Grupo no módulo de administração está parcialmente funcional. O modal carrega o nome, mas devido a dados incompletos retornados pela API `GET /api/admin/groups` (lista inicial), os campos "Empresa" e "Telas Permitidas" não são pré-preenchidos. A correção requer ajuste na API do backend para retornar os dados completos. Veja `guia-desenvolvimento.md` para detalhes.
*   Existem alguns erros de tipo relacionados à integração `react-hook-form`/`zod` que foram temporariamente suprimidos com `// @ts-ignore`.

## Próximos Passos

*   Implementar completamente o Módulo de Vendas.
*   Desenvolver interface para gerenciamento de Permissões.
*   Adicionar testes automatizados.
*   Corrigir a API `GET /api/admin/groups` no backend.

---

Documentação criada em: 09/04/2024 