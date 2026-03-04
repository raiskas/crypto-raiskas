# App Nativo macOS (SwiftUI)

Este documento descreve a base nativa do projeto para macOS, sem WebView, usando Supabase diretamente.

## Objetivo

- App nativo macOS em SwiftUI.
- Sem embutir site/Next.js dentro do app.
- Backend de dados e autenticação via Supabase.

## Alinhamento com Web (fonte única)

O app macOS e o Web compartilham um contrato único para nome/menus/modais:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/shared/cross-platform.contract.json`

Após alterar esse contrato, execute:

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas
pnpm sync:platforms
pnpm sync:platforms:check
```

No macOS, o bloco gerado fica em:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/macos/RaiskasMac/Sources/App/AppDestination.swift`

## Estrutura

```text
apps/macos/RaiskasMac/
├── project.yml
└── Sources/
    ├── App/
    │   ├── RaiskasMacApp.swift
    │   ├── AppState.swift
    │   ├── AppDestination.swift
    │   └── MainShellView.swift
    ├── Core/
    │   ├── AppConfig.swift
    │   ├── Models.swift
    │   └── SupabaseService.swift
    ├── Shared/
    │   ├── AppTheme.swift
    │   └── Formatters.swift
    ├── Resources/
    │   └── logo-sem-fundo.png
    └── Features/
        ├── Auth/SignInView.swift
        ├── Dashboard/DashboardOverviewView.swift
        ├── Portfolio/
        │   ├── PortfolioView.swift
        │   └── PortfolioViewModel.swift
        ├── Operations/OperationsView.swift
        ├── Market/MarketView.swift
        └── Admin/AdminUsersView.swift
```

## Como gerar e rodar

Pré-requisitos:

1. Xcode 15+
2. [XcodeGen](https://github.com/yonaskolb/XcodeGen)
3. Credenciais Supabase (URL + ANON KEY)

Passos:

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas/apps/macos/RaiskasMac
xcodegen generate
open RaiskasMac.xcodeproj
```

No Xcode (Scheme `RaiskasMac`):

1. Edit Scheme > Run > Arguments > Environment Variables
2. Adicionar:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Run (`Cmd + R`)

Alternativa recomendada:

- usar `Config.local.plist` (embutido no bundle) e não depender de variáveis no Scheme.

## Escopo entregue nesta etapa

- Autenticação com e-mail/senha no Supabase.
- Shell principal com navegação lateral no padrão do projeto:
  - Home
  - Crypto
  - Carteira
  - Painel Administrativo
- Header superior com contexto de área administrativa e ação de logout.
- Tela de login no mesmo padrão estrutural do web:
  - área de marca/logo à esquerda,
  - card de autenticação à direita,
  - textos e hierarquia visual equivalentes.
- Painel Administrativo com estrutura alinhada ao web:
  - Visão Geral
  - Usuários
  - Empresas
- Em `Usuários`, a gestão de grupos fica dentro da própria página (aba/segmento),
  como no fluxo web.
- Marca visual unificada com nome `Crypto Raiskas` e uso do logo.
- Menu superior macOS com comandos:
  - `Telas` (Home, Crypto, Carteira, Admin: Visão Geral/Usuários/Empresas)
  - `Modais` (Nova Operação, Administrar Carteira, Novo Usuário, Novo Grupo, Nova Empresa)
- Dashboard com cards e mini série de patrimônio (3M).
- Carteira com:
  - patrimônio,
  - aporte líquido,
  - resultado,
  - filtros de janela (`1M`, `3M`, `6M`, `12M`, `Tudo`),
  - toggles de série (`Carteira`, `Aporte`, `Resultado`),
  - gráfico interativo (hover/crosshair/legenda) por snapshots (`crypto_carteira_snapshots`).
- Operações com filtros, busca e tabela nativa.
- Preços com feed de mercado (BTC, ETH, XRP) e atualização 24h.
- Admin Usuários com:
  - listagem de usuários,
  - reset de senha por usuário,
  - listagem/edição de grupos.
- Admin Empresas com CRUD nativo (criar/editar/remover).

## Permissões (crítico)

- O app resolve contexto administrativo via tabela `usuarios`:
  - `is_master`
  - `empresa_id`
- Leitura:
  - usuário `master`: visão global;
  - usuário não-master: escopo restrito à própria empresa.
- Escrita administrativa sensível:
  - criação/edição/remoção de `empresas` e `grupos` exige `is_master = true`.
  - a trava é aplicada no `SupabaseService` (não só na UI).
- Na UI:
  - botões de ações sensíveis são ocultados/desabilitados para não-master.

## Próximas etapas recomendadas

1. CRUD completo nativo para operações e aportes (hoje está em modo leitura/listagem).
2. Gestão de usuários com edição de role/status.
3. Pipeline de release (`archive`, assinatura e notarização).
4. Módulos avançados do web (quando reativados) em versão nativa.

## Observações técnicas

- O app usa `supabase-swift` como dependency nativa.
- Não há dependência de WebView/Electron/Tauri.
- Toda a renderização da interface é SwiftUI.
- Compatibilidade com projeto base: o app resolve o usuário interno via
  `usuarios.auth_id` e usa `usuarios.id` em filtros de `crypto_carteiras` e
  `crypto_operacoes`, igual ao backend web.
- O cliente Supabase está configurado com
  `emitLocalSessionAsInitialSession: true` para eliminar o warning de sessão inicial.
- Persistência de sessão no macOS app usa `UserDefaults` (storage custom de auth),
  evitando prompts repetidos do Keychain (`supabase.gotrue.swift`) ao abrir o app.

## Estabilidade de dados de mercado (mar/2026)

Para reduzir instabilidade de cotações (ex.: CoinGecko `429`), o app passou a usar:

- Retry com backoff para `coins/markets`.
- Fallback automático para `simple/price` quando a rota principal falha.
- Cache em memória + cache em disco (`Caches/raiskas_market_tickers_cache.json`).
- Reuso de último preço conhecido da operação quando a API externa oscila.

Impacto prático:

- A tela não deve mais zerar `Valor de Mercado` por falha transitória de API.
- `Home`, `Crypto` e `Carteira` continuam operacionais com dados degradados.
- Em cenário de falha total de rede, o app usa snapshot de cache local quando disponível.

## Modais em janelas separadas (desktop)

No app macOS, todos os fluxos que antes usavam `.sheet/.alert` foram migrados para
janelas separadas (filhas do app), mantendo os mesmos formulários e validações.

Cobertura atual:

- `Crypto`: Nova operação, Editar operação, Confirmar exclusão.
- `Carteira`: Administrar carteira.
- `Painel Administrativo > Usuários`: Criar, Editar, Excluir usuário; Criar, Editar, Excluir grupo.
- `Painel Administrativo > Empresas`: Criar, Editar, Excluir empresa.

Implementação compartilhada:

- `AppWindowPresenter` + `AppConfirmDialogWindow` em `Sources/Shared/AppTheme.swift`.
- Fechamento programático por `id` de janela para manter um único modal por fluxo.

## Configuração local robusta (sem depender do Scheme)

O app agora prioriza leitura de `Config.local.plist` embutido no bundle.

Arquivo local (não versionado):

- `apps/macos/RaiskasMac/Config.local.plist`

Template versionado:

- `apps/macos/RaiskasMac/Config.local.example.plist`

Passos:

1. Copie o template para o arquivo local.
2. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
3. Gere o projeto (`xcodegen generate`) e rode.

Observação: o app ainda aceita Environment Variables no Scheme como fallback.
