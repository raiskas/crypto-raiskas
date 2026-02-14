# Crypto Raiskas - Sistema de Gestão

Um sistema de gestão empresarial altamente adaptável e escalável, construído com Next.js, Supabase e Shadcn/UI.

## Recursos Principais

- **Autenticação Completa**: Sistema de login e cadastro integrado com Supabase Auth
- **Gestão de Permissões**: Controle fino de acesso baseado em grupos e permissões
- **Multi-empresas**: Suporte a múltiplas empresas com isolamento de dados
- **UI Moderna**: Interface de usuário responsiva e acessível usando Shadcn/UI
- **Tema Claro/Escuro**: Suporte a temas claro e escuro com persistência
- **Módulos**: Estrutura modular para fácil adição de novas funcionalidades

## Tecnologias Utilizadas

- **Framework**: Next.js 15
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **UI**: Shadcn/UI + Tailwind CSS
- **Formulários**: React Hook Form + Zod
- **Gerenciador de Pacotes**: pnpm

## Pré-requisitos

- Node.js 18+
- pnpm 8+
- Conta no Supabase

## Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/crypto-raiskas.git
   cd crypto-raiskas
   ```

2. Instale as dependências:
   ```bash
   pnpm install
   ```

3. Configure as variáveis de ambiente:
   - Crie um arquivo `.env.local` baseado no `.env.example`
   - Preencha as credenciais do Supabase

4. Configure o banco de dados:
   - Acesse o painel do Supabase
   - Execute o script SQL `supabase-schema.sql` no editor SQL do Supabase

5. Inicie o servidor de desenvolvimento:
   ```bash
   pnpm dev
   ```

6. Acesse o sistema em [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
crypto-raiskas/
├── src/
│   ├── app/                   # Rotas e páginas
│   │   ├── (auth)/            # Rotas de autenticação
│   │   ├── (dashboard)/       # Rotas protegidas
│   │   └── api/               # Rotas da API
│   ├── components/            # Componentes reutilizáveis
│   │   ├── ui/                # Componentes de UI
│   │   └── layouts/           # Layouts
│   └── lib/                   # Utilitários e clientes
│       ├── supabase/          # Cliente Supabase
│       └── utils/             # Funções utilitárias
├── public/                    # Arquivos estáticos
└── supabase-schema.sql        # Esquema do banco de dados
```

## Personalização

### Adicionando um Novo Módulo

1. Crie uma pasta para o módulo em `src/app/(dashboard)/nome-do-modulo/`
2. Adicione as rotas e componentes necessários
3. Atualize o banco de dados com novas tabelas se necessário
4. Adicione permissões para o novo módulo

### Customizando o Tema

- Edite `src/app/globals.css` para modificar as variáveis de cor
- Use o ThemeProvider para criar novos temas

## Deploy

### Pré-requisitos
- Conta no [Vercel](https://vercel.com)
- Conta no [Supabase](https://supabase.com)
- [Vercel CLI](https://vercel.com/cli) instalado globalmente

### Variáveis de Ambiente
Antes de fazer o deploy, você precisa configurar as seguintes variáveis de ambiente:

1. No Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL do seu projeto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave anônima do seu projeto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do seu projeto Supabase

2. No Vercel:
   - Adicione todas as variáveis acima no painel de configuração do projeto
   - Vá para Settings > Environment Variables

### Processo de Deploy

1. Instale o Vercel CLI:
```bash
pnpm add -g vercel
```

2. Faça login no Vercel:
```bash
vercel login
```

3. Inicie o processo de deploy:
```bash
vercel
```

4. Siga as instruções no terminal:
   - Selecione o projeto
   - Confirme as configurações
   - Aguarde o deploy ser concluído

### Pós-Deploy
- Verifique se todas as variáveis de ambiente foram configuradas corretamente
- Teste todas as funcionalidades da aplicação
- Configure o domínio personalizado se necessário

## Licença

Este projeto está licenciado sob a licença MIT.
