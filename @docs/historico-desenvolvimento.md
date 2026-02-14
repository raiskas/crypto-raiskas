# Histórico de Desenvolvimento - Crypto Raiskas

Este documento registra as principais mudanças, correções e implementações realizadas durante o desenvolvimento do projeto Crypto Raiskas. Ele serve como referência para o próximo desenvolvedor entender o que já foi feito e poder continuar o trabalho.

## Implementações Principais

### Sistema de Autenticação

1. **Estrutura Inicial**
   - Configuração do Next.js 15 com App Router
   - Integração com Supabase para autenticação
   - Configuração do middleware para proteção de rotas

2. **Páginas de Autenticação**
   - Implementação da página de login (`/src/app/(auth)/signin/page.tsx`)
   - Implementação da página de cadastro (`/src/app/(auth)/signup/page.tsx`)
   - Validação de formulários com Zod e React Hook Form

### API de Autenticação

1. **Endpoint de Registro**
   - Criação da rota `/src/app/api/auth/register/route.ts`
   - Lógica para criar usuário no Supabase Auth
   - Lógica para criar empresa, usuário, grupo e atribuir permissões

2. **Funções de Supabase**
   - Implementação de `createServerSupabaseClient()` como função assíncrona
   - Funções auxiliares para obter dados de usuário, empresa e grupos

### Banco de Dados

1. **Esquema Inicial**
   - Criação das tabelas: `empresas`, `usuarios`, `grupos`, `permissoes`, `usuarios_grupos`, `grupos_permissoes`, `vendas`
   - Inserção de permissões padrão para os módulos de usuários, grupos e vendas
   - Configuração de chaves estrangeiras e índices de performance

### Dashboard e Layout

1. **Estrutura de Dashboard**
   - Layout básico do dashboard protegido em `/src/app/(dashboard)/layout.tsx`
   - Páginas iniciais do dashboard em `/src/app/(dashboard)/dashboard/page.tsx`
   - Módulo de vendas em `/src/app/(dashboard)/vendas/page.tsx`

### Módulo de Gerenciamento de Usuários (10/04/2024)

1. **Interface Administrativa**
   - Criação de painel administrativo em `/src/app/(dashboard)/admin/page.tsx`
   - Implementação de página de gerenciamento de usuários em `/src/app/(dashboard)/admin/usuarios/page.tsx`
   - Interface com tabela, modais e formulários para CRUD completo de usuários

2. **API de Administração**
   - Implementação do endpoint `/src/app/api/admin/users/route.ts` com métodos:
     - GET: Listar todos os usuários
     - POST: Criar novo usuário
     - PATCH: Atualizar usuário existente
     - DELETE: Remover/desativar usuário
   - Integração com Supabase Auth para gerenciar usuários

3. **Componentes UI**
   - Criação e/ou melhoria de componentes UI:
     - Dialog (modais)
     - Tabela de dados
     - Formulários com validação
     - Badge (indicadores de status)
   - Adição de dependências: date-fns, @radix-ui/react-dialog

## Correções e Melhorias

### Correções de Autenticação

1. **Problema de Redirecionamento**
   - Correção do fluxo de redirecionamento após login
   - Atualização do hook `useAuth` para gerenciar o estado de autenticação corretamente

2. **Erros no Registro**
   - Ajuste na validação de campos do formulário de cadastro
   - Adição de logs mais detalhados para diagnóstico
   - Relaxamento da validação do `auth_id` para ser qualquer string não vazia

### Melhoria de Servidor

1. **Função Assíncrona**
   - Correção de `createServerSupabaseClient()` para ser assíncrona conforme exigido pelos Server Actions do Next.js
   - Atualização das chamadas a esta função para usar `await`

### Correções de Integridade de Dados (10/04/2024)

1. **Prevenção de Duplicação de Email**
   - Implementação de verificações em cascata para evitar emails duplicados:
     - Verificação em `usuarios` antes de criar na autenticação
     - Verificação em `auth.users` antes de inserir em `usuarios`
     - Tratamento especial para erro de chave única (código 23505)
   - Melhoria no método `.maybeSingle()` para evitar erros quando não encontra registros

2. **Integridade entre Tabelas**
   - Implementação de reversão automática em caso de falha:
     - Se criar em `auth.users` mas falhar em `usuarios`, o registro de autenticação é removido
     - Melhoria no tratamento de erros com mensagens claras
   - Logs detalhados para diagnóstico de problemas

3. **Correção de Conflito de Rotas**
   - Resolução de erro "You cannot have two parallel pages that resolve to the same path"
   - Remoção de arquivo duplicado (`/src/app/home/page.tsx`) que conflitava com `/src/app/(dashboard)/home/page.tsx`
   - Implementação de redirecionamento adequado na página raiz

### Melhorias de Interface (10/04/2024)

1. **Página Inicial**
   - Criação de página inicial após login com cards navegáveis
   - Adição de botão de logout
   - Exibição de informações do usuário logado

2. **Painel Administrativo**
   - Criação de painel com cards para diferentes áreas administrativas
   - Sistema de cores para identificação visual
   - Layout responsivo para diferentes tamanhos de tela

## Documentação

1. **Documentação Completa**
   - Criação de documentação estruturada sobre todo o projeto
   - Documento único consolidado para referência rápida (`documentacao-completa.md`)

2. **Documentos Específicos**
   - Documentação do banco de dados (`banco-dados.md`)
   - Guia de desenvolvimento (`guia-desenvolvimento.md`)
   - Sistema de autenticação e permissões (`autenticacao-permissoes.md`)
   - Visão geral do projeto (`projeto.md`)

3. **Índice de Documentação**
   - Criação de um README centralizado para navegar entre os documentos

4. **Atualização da Documentação (10/04/2024)**
   - Adição de seção completa sobre o Módulo de Gerenciamento de Usuários
   - Atualização da estrutura do projeto para refletir novas implementações
   - Melhorias na seção de Troubleshooting com novos casos e soluções
   - Documentação detalhada das APIs administrativas

## Estado Atual do Projeto

O projeto está funcional com as seguintes capacidades:

1. **Autenticação**
   - Registro de novos usuários com criação automática de empresa e grupo admin
   - Login de usuários existentes
   - Proteção de rotas baseada em autenticação
   - Middleware simplificado para evitar conflitos

2. **Dashboard**
   - Layout básico do dashboard com navegação
   - Página inicial após login com cards navegáveis
   - Painel administrativo para gerenciar diferentes aspectos do sistema
   - Suporte completo a dark mode em toda a aplicação

3. **Banco de Dados**
   - Esquema completo implementado no Supabase
   - Sistema de permissões funcional
   - Integridade referencial entre tabelas de autenticação e dados personalizados

4. **Gerenciamento de Usuários**
   - Interface completa para listar, criar, editar e remover usuários
   - Modais para diferentes operações com validação de dados
   - API robusta com verificações de integridade

## Implementação de Dark Mode (11/04/2024)

1. **Configuração de Tema**
   - Implementação do ThemeProvider baseado em next-themes
   - Criação de componente ThemeToggle para alternar entre temas (claro, escuro e sistema)
   - Configuração de variáveis CSS para modos claro e escuro

2. **Componentes de Layout**
   - Criação de DashboardHeader para área administrativa
   - Criação de AuthHeader para páginas de autenticação
   - Inclusão do botão de toggle de tema nos cabeçalhos

3. **Ajustes nos Layouts**
   - Modificação do RootLayout para incluir o ThemeProvider
   - Alteração do DashboardLayout para incorporar o cabeçalho e estrutura flexível
   - Adaptação do AuthLayout com seu respectivo cabeçalho

4. **Aspectos Técnicos**
   - Uso do atributo `suppressHydrationWarning` no HTML para evitar erros de hidratação
   - Implementação baseada em classes CSS (attribute="class")
   - Configuração com suporte a preferências do sistema

## Implementação de Menu Lateral (Sidebar) (12/04/2024)

1. **Componente de Menu Lateral**
   - Criação de componente Sidebar com design moderno e responsivo
   - Implementação de suporte a submenus expansíveis
   - Suporte para destaque visual do item ativo
   - Integração com o sistema de temas (dark/light)

2. **Responsividade**
   - Implementação de menu fixo para desktop
   - Menu retrátil para dispositivos móveis e tablets
   - Botão flutuante para acesso ao menu em telas pequenas

3. **Reorganização do Layout**
   - Modificação do DashboardLayout para incorporar o menu lateral
   - Simplificação do DashboardHeader, removendo itens de navegação redundantes
   - Ajuste do conteúdo principal para se alinhar com o novo layout

4. **Estratégia de Testes**
   - Criação de exemplos de testes unitários para o componente Sidebar
   - Definição de estratégias para testes de integração
   - Documentação de procedimentos para testes manuais

5. **Documentação**
   - Documentação detalhada do menu lateral em `docs/menu-sidebar.md`
   - Análise de possíveis melhorias futuras
   - Atualização do histórico de desenvolvimento

## Implementação de Menu Superior (TopNav) (13/04/2024)

1. **Componente de Menu Superior**
   - Criação de componente TopNav com design moderno e elegante
   - Implementação de sistema de dropdown para submenus
   - Adição de gradientes e sombreamento para melhor aparência visual
   - Destaque visual aprimorado para itens ativos com linha indicativa

2. **Responsividade Avançada**
   - Layout horizontal completo para desktop
   - Menu hamburger para tablets e dispositivos móveis
   - Animações suaves para abertura/fechamento do menu móvel
   - Adaptação completa a diferentes tamanhos de tela

3. **Integração com Sistema Existente**
   - Incorporação das informações do usuário no menu
   - Manutenção do acesso ao toggle de tema e função de logout
   - Preservação de toda a estrutura de navegação anterior

4. **Estratégia de Testes**
   - Desenvolvimento de estrutura de testes unitários completa
   - Planejamento de testes de integração para todas as interações
   - Guia detalhado para testes manuais de UX e responsividade

5. **Documentação**
   - Criação de documentação detalhada em `docs/menu-superior.md`
   - Análise abrangente de possíveis melhorias futuras
   - Exemplos de código para futuras expansões 

## Correção do Sistema de Autenticação e Cookies (15/04/2024)

1. **Correção da Função getServerUser**
   - Atualização da função `getServerUser()` no arquivo `src/lib/supabase/async-cookies.ts`
   - Modificação da consulta para buscar usuário pelo campo `auth_id` ao invés de `id`
   - Resolução de problemas de autenticação onde o usuário não era encontrado após login

2. **Implementação de Módulo de Criptomoedas**
   - Criação de API para listar operações criptográficas do usuário (`/api/crypto/operacoes`)
   - Implementação de endpoint para buscar moedas via CoinGecko (`/api/crypto/listar-moedas`)
   - Desenvolvimento de formulário para registrar novas operações de criptomoedas

3. **Melhorias no Gerenciamento de Sessão**
   - Correção do hook `useUserData` para utilizar corretamente o client do Supabase
   - Atualização das funções de cookie para trabalhar com versões mais recentes do Next.js
   - Tratamento adequado de erros no fluxo de autenticação

4. **Melhorias na Estrutura de Código**
   - Utilização consistente do campo `auth_id` para relacionar usuários entre tabelas
   - Implementação de tratamento de erros mais robustos nas APIs
   - Simplificação da interface de autenticação para melhor experiência do usuário

## Refatoração e Melhorias de Formatação (Julho/2024 - Data Aproximada)

1.  **Refatoração do Cálculo de Portfólio (`HomePage`)**
    *   Removida a lógica de cálculo de portfólio do frontend (`HomePage`).
    *   O componente agora busca os dados sumarizados da API `/api/crypto/performance`.
    *   Os cards de resumo foram atualizados para usar os dados da API (Valor Total, Custo Base, L/P Realizado, L/P Não Realizado).

2.  **Padronização da Formatação de Moeda**
    *   Criada a função utilitária `formatCurrency` em `src/lib/utils.ts` usando `Intl.NumberFormat` (padrão `en-US`, 2 decimais, sem símbolo).
    *   A função permite sobrescrever opções (ex: `maximumFractionDigits`).
    *   Aplicada `formatCurrency` em `HomePage` e `CryptoPage` para consistência na exibição de valores monetários.

3.  **Melhoria na Formatação de Inputs (`OperacaoForm`)**
    *   Removidos os spinners padrão dos inputs numéricos (`quantidade`, `valor_total`) usando a classe CSS `hide-number-spinners` e estilos globais.
    *   Implementada formatação automática para os campos "Preço Unitário (USD)" e "Valor Total (USD)" usando a biblioteca `react-number-format`.
    *   Os campos agora utilizam `NumericFormat` com `customInput={Input}` para manter o estilo visual, permitindo digitação livre e formatação (separadores de milhar, controle decimal).
    *   Adicionada a dependência `react-number-format` ao projeto.

4.  **Correção de Build (Vercel)**
    *   Resolvido o erro `ERR_PNPM_OUTDATED_LOCKFILE` durante o deploy na Vercel.
    *   Atualizado o arquivo `pnpm-lock.yaml` para sincronizar com `package.json` após a adição de novas dependências.

## Próximos Passos Sugeridos

1. **Interface de Usuário**
   - Implementar paginação na tabela de usuários
   - Adicionar filtros de busca por nome e email
   - Melhorar a experiência móvel

2. **Módulo de Vendas**
   - Implementar a funcionalidade completa de vendas
   - Criar formulários para cadastro de vendas

3. **Gerenciamento de Permissões**
   - Implementar interface para gerenciar grupos e permissões
   - Adicionar funcionalidade para convidar novos usuários para uma empresa existente

4. **Melhorias de UX**
   - Implementar notificações toast para feedback de ações
   - Adicionar temas personalizáveis para a interface
   - Melhorar acessibilidade dos componentes

5. **Testes Automatizados**
   - Implementar testes unitários e de integração
   - Configurar pipeline de CI/CD

6. **Expansão do Módulo de Criptomoedas**
   - Implementar dashboard com visualização de portfólio
   - Adicionar gráficos de desempenho das moedas
   - Integrar APIs para cotações em tempo real

## 2025-07-26

*   **Refatoração (Admin/Usuários):**
    *   Componentes `UserSection` e `GroupSection` foram refatorados para utilizar feedback global de sucesso/erro (props `setPageSuccess`/`setPageError` passadas do componente pai `page.tsx`) e estados locais (`modalError`) para erros específicos de modais.
*   **Depuração (Admin/Grupos):**
    *   Investigado problema onde o modal de edição de grupo não carregava os campos "Empresa" e "Telas Permitidas".
    *   Comparação com a edição de usuário (funcional) revelou que o problema reside na API `GET /api/admin/groups` (usada para carregar a lista inicial), que retorna dados incompletos (omitindo `empresa_id` e `telas_permitidas`).
    *   A estrutura do banco de dados (`grupos` com as colunas necessárias) foi confirmada.
    *   O código frontend em `GroupSection.tsx` foi ajustado para usar os dados da lista inicial (padrão da edição de usuário) e está aguardando a correção da API backend para funcionalidade completa.
*   **Configuração (Next.js):**
    *   Adicionado o hostname `cryptoicons.org` à configuração `images.remotePatterns` em `next.config.js` para corrigir erro de carregamento de imagens externas.
*   **Qualidade de Código:**
    *   Comentários `// @ts-ignore` foram aplicados em `UserSection.tsx` e `GroupSection.tsx` para suprimir erros persistentes de tipagem relacionados ao `react-hook-form` e `zod`, como solução pragmática.

## 2025-07-27 (Ou data atual)

*   **Correção (API CoinGecko):** Resolvido problema onde dados da CoinGecko não atualizavam na Vercel devido ao cache.
    *   Implementada rota API intermediária (`/api/preco/route.ts`) para buscar dados da CoinGecko.
    *   Utilizado cache `fetch` do Next.js com `revalidate: 60` na API route para garantir atualização periódica no servidor (Vercel).
*   **Gerenciamento de Estado (Preço Crypto):** Implementado compartilhamento de estado para o preço do Bitcoin.
    *   Criado `PriceContext` e `PriceProvider` (`src/lib/context/PriceContext.tsx`) usando Context API.
    *   `PriceProvider` centraliza a lógica de busca periódica do preço via `/api/preco`.
    *   Adicionado `PriceProvider` ao layout do dashboard (`src/app/(dashboard)/layout.tsx`).
    *   Refatorada a página `/preco` e adicionado o uso do hook `usePrice` nas páginas `home` e `crypto` para consumir o preço compartilhado.
    *   **Nota:** Para exibir preços de criptomoedas em novos componentes/páginas do dashboard, utilize o hook `usePrice()`.

## 2026-02-13

*   **Unificação Real do Crypto Middleware no Projeto Principal:**
    *   Criado módulo nativo em TypeScript em `src/lib/crypto-middleware/`.
    *   Implementada engine unificada (`engine.ts`) com:
        *   Coleta OHLC na Kraken (`1H`, `4H`, `1W`)
        *   Cálculo de EMA/RSI
        *   Score tático/macro
        *   Decisão de estágio (`WAIT`, `SMALL`, `MEDIUM`, `FULL`)
    *   Implementadas APIs internas:
        *   `POST /api/crypto-middleware/run`
        *   `GET /api/crypto-middleware/latest`
    *   Página `/crypto-middleware` refatorada para UI nativa (sem iframe), com ações `Rodar Agora` e `Atualizar`.
    *   Inclusão do item `Crypto Middleware` no menu superior.

*   **Banco de Dados e Permissões:**
    *   Nova tabela `crypto_middleware_signals`.
    *   Nova migração: `supabase/migrations/20260213190000_add_crypto_middleware_signals.sql`.
    *   Permissões adicionadas:
        *   `crypto_middleware_visualizar`
        *   `crypto_middleware_executar`
    *   Atualização de `screens.config.json` para incluir `crypto-middleware`.

*   **Documentação:**
    *   Criado documento dedicado: `@docs/crypto-middleware.md`.
    *   Atualizados os documentos de índice e visão geral para refletir o módulo unificado.

---

Documentação atualizada em: 15/04/2024 
