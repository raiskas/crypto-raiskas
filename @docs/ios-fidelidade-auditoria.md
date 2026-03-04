# Auditoria de Fidelidade Web x iPhone

Data: 2026-03-03

## WEB_APP_SPEC (fonte da verdade)

### Auth - `/signin`
- Estrutura:
  - Coluna logo (desktop)
  - Card central com título `Entrar`
  - Campos `Email` e `Senha`
  - CTA `Entrar`
  - Link `Não tem uma conta? Cadastre-se`
- Estados:
  - loading no submit (`Entrando...`)
  - erro de autenticação

### Home - `/home`
- Estrutura:
  - Título `Dashboard`
  - Saudação `Bem-vindo, ...`
  - Cards: `Total Portfólio`, `Custo Base Total`, `L/P Não Realizado`, `L/P Realizado`
  - Tabela/área de top moedas
- Estados:
  - loading, erro de performance, erro de market-data

### Crypto - `/crypto`
- Estrutura:
  - Título `Gerenciamento de Criptomoedas`
  - CTA `Nova Operação`
  - Cards: `Total Portfólio`, `Total Investido`, `L/P Não Realizado`, `L/P Realizado`
  - Seção `Meu Portfólio`
  - Seção `Minhas Operações`
  - Filtros e busca
  - Ações por linha: editar/excluir
- Estados:
  - loading, vazio, erro API, salvando modal

### Carteira - `/crypto/carteira`
- Estrutura:
  - Título `Acompanhamento de Carteira`
  - Ações de atualização/admin
  - Cards de resumo
  - Bloco `Evolução da Carteira` com série `Aporte`, `Carteira`, `Resultado`
- Estados:
  - loading histórico, sem dados, erro mercado

### Admin - `/admin`
- Estrutura:
  - Cards de acesso para:
    - `/admin/usuarios`
    - `/admin/empresas`

### Admin Usuários - `/admin/usuarios`
- Estrutura:
  - `Gerenciamento de Usuários`
  - `Gerenciamento de Grupos`
  - Modais: novo usuário, editar usuário, novo grupo, etc.
- Estados:
  - loading listas, erro em ação, sucesso em ação

### Admin Empresas - `/admin/empresas`
- Estrutura:
  - tabela/lista de empresas
  - modais criar/editar
  - ação excluir
- Estados:
  - loading, erro, sucesso

## IOS_APP_SPEC (estado atual implementado)

Projeto: `apps/ios/CryptoRaiskasIOS`

### Navegação
- Tab bar com:
  - Home
  - Crypto
  - Carteira
  - Painel Administrativo
- Admin interno com subrotas:
  - Visão Geral
  - Usuários
  - Empresas

### Auth
- Tela `SignInView` com:
  - logo
  - título/subtítulo
  - email/senha
  - botão entrar
  - mensagem de erro

### Home
- `HomeView`:
  - resumo vindo de `fetchDashboardSummary()`
  - cards principais
  - ações `Atualizar` e `Sair`

### Crypto
- `CryptoRootView`:
  - cards de resumo
  - listagem de operações
  - criar/editar/excluir via modal (`CryptoOperationFormView`)
  - busca de ativos via `searchCoins()`

### Carteira
- `PortfolioView`:
  - cards de resumo
  - gráfico (Charts) com 3 linhas: aporte/carteira/resultado
  - atualização via `fetchWalletSummaryAndHistory()`

### Admin
- `AdminPanelView`: visão geral de acesso
- `AdminUsersView`: listas de usuários e grupos + modais de criação
- `AdminEmpresasView`: lista de empresas + modal de criação + exclusão

## Mapeamento 1:1 (Web -> iPhone)

### CORRETO
- Estrutura de alto nível de telas: Auth, Home, Crypto, Carteira, Admin+subpáginas.
- Fluxo principal de autenticação e sessão.
- CRUD base em Crypto e Admin (com Supabase).

### FALTANDO
- Paridade visual pixel-perfect de alguns blocos/tabelas (Web usa grid/tabela mais densa).
- Alguns modais avançados de edição completa (usuário/empresa/grupo) ainda estão simplificados no iPhone.
- Parte de estados específicos de loading/esqueleto do Web.

### EXTRA
- Nenhum fluxo novo de produto foi adicionado.

### DIFERENTE
- Navegação: no iPhone foi usada `TabView + NavigationStack` (adaptação mobile obrigatória).
- Tabelas densas do Web foram convertidas para listas mobile em alguns pontos.

## Próximo ciclo obrigatório
- Fechar paridade visual/funcional de cada subpágina administrativa.
- Completar modais de edição com todos os campos do Web.
- Validar permissões master/empresa em todos os botões de ação.
