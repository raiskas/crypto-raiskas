# Documentação - Crypto Raiskas

Este diretório contém a documentação completa do projeto Crypto Raiskas, um sistema de gerenciamento empresarial com foco em gestão de usuários, controle de permissões e módulo de vendas.

## Índice de Documentação

### Documentos Principais

- [**Visão Geral do Projeto**](projeto.md) - Descrição completa do projeto, tecnologias utilizadas, estrutura e recursos
- [**Guia de Desenvolvimento**](guia-desenvolvimento.md) - Instruções para desenvolvedores que estão começando a trabalhar no projeto
- [**Sistema de Autenticação e Permissões**](autenticacao-permissoes.md) - Detalhes sobre o sistema de autenticação e controle de acesso
- [**Guia do Banco de Dados**](banco-dados.md) - Informações sobre o banco de dados, migrações e melhores práticas
- [**Crypto Middleware (Unificado)**](crypto-middleware.md) - Arquitetura, APIs e operação do módulo nativo de sinais tático/macro
- [**Documentação Completa**](documentacao-completa.md) - Versão consolidada de toda a documentação em um único arquivo
- [**Histórico de Desenvolvimento**](historico-desenvolvimento.md) - Registro das implementações, correções e próximos passos sugeridos

## Guia Rápido

### Para Começar

1. Clone o repositório
2. Configure as variáveis de ambiente (`.env.local`)
3. Instale as dependências: `pnpm install`
4. Configure o banco de dados: `pnpm db:init`
5. Inicie o servidor de desenvolvimento: `pnpm dev`
6. Acesse a aplicação em `http://localhost:3000`

### Estrutura do Projeto

```
src/
├── app/                     # Páginas e rotas (Next.js App Router)
├── components/              # Componentes reutilizáveis
├── lib/                     # Utilitários e hooks
├── types/                   # Definições de tipos TypeScript
└── middleware.ts            # Proteção de rotas
```

### Stack Tecnológico

- **Frontend**: Next.js 15 (React 19)
- **Estilização**: Tailwind CSS v4
- **Autenticação**: Supabase Authentication
- **Banco de Dados**: PostgreSQL (via Supabase)
- **Formulários**: React Hook Form + Zod

## Fluxo de Trabalho Recomendado

1. Leia a [Visão Geral do Projeto](projeto.md) para entender o contexto
2. Configure seu ambiente seguindo o [Guia de Desenvolvimento](guia-desenvolvimento.md)
3. Familiarize-se com o [Sistema de Autenticação e Permissões](autenticacao-permissoes.md)
4. Consulte o [Guia do Banco de Dados](banco-dados.md) quando precisar trabalhar com dados
5. Verifique o [Histórico de Desenvolvimento](historico-desenvolvimento.md) para entender o estado atual e próximos passos

## Contato e Suporte

Para suporte ou dúvidas sobre o projeto, entre em contato com:

- **Equipe de desenvolvimento**: dev@exemplo.com
- **Repositório**: [GitHub - Crypto Raiskas](#)

---

Documentação atualizada em: DD/MM/YYYY - Preencher Data Atual

*   `docs/menu-sidebar.md`: Detalhes sobre o menu lateral.
*   `docs/menu-superior.md`: Detalhes sobre o menu superior.
*   `docs/dark-mode.md`: Detalhes sobre a implementação do tema escuro.
*   `docs/historico-desenvolvimento.md`: Log de alterações importantes.

**Status Atual e Problemas Conhecidos:**

*   O sistema principal de autenticação e gerenciamento de usuários está funcional.
*   **Módulo de Criptomoedas:** Implementado com registro de operações e cálculo de performance de portfólio usando método FIFO. O bug de interação entre cálculos de moedas diferentes foi corrigido (ver histórico).
*   **Gerenciamento de Preços Crypto:** Implementado sistema de cache (`/api/preco` - *revisar relevância*) e compartilhamento de estado (`PriceContext` / `usePrice`) para preços consistentes no dashboard. API `/api/crypto/market-data` busca dados via CoinGecko.
*   **Edição de Grupos (Admin):** A API `GET /api/admin/groups` retorna dados incompletos (omitindo `empresa_id` e `telas_permitidas`), impedindo o pré-preenchimento completo do modal de edição. Requer correção no backend.
*   Consulte `guia-desenvolvimento.md` para outros problemas conhecidos e soluções pendentes.

## Como Contribuir

(...) 
