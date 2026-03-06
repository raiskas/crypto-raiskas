# App Nativo iOS (SwiftUI)

Este documento descreve a arquitetura, setup, operação e manutenção da versão iPhone do Crypto Raiskas.

## Objetivo

- App nativo iOS em SwiftUI.
- Sem WebView.
- Dados e autenticação via Supabase.
- Fidelidade funcional com Web e macOS.

## Estrutura

```text
apps/ios/CryptoRaiskasIOS/
├── project.yml
├── Config.local.example.plist
├── Config.local.plist                 # local, não versionar credenciais
├── Resources/
│   ├── logo-sem-fundo.png
│   └── Assets.xcassets/
└── Sources/
    ├── App/
    │   ├── CryptoRaiskasIOSApp.swift
    │   ├── AppState.swift
    │   ├── MainTabView.swift
    │   ├── AppDestination.swift
    │   └── AppContract.swift
    ├── Core/
    │   ├── AppConfig.swift
    │   ├── SupabaseService.swift
    │   └── Models.swift
    ├── Shared/
    │   ├── AppTheme.swift
    │   └── Formatters.swift
    └── Features/
        ├── Auth/SignInView.swift
        ├── Home/HomeView.swift
        ├── Crypto/CryptoRootView.swift
        ├── Portfolio/PortfolioView.swift
        └── Admin/
            ├── AdminRootView.swift
            ├── AdminUsersView.swift
            └── AdminEmpresasView.swift
```

## Setup

1. Gerar projeto Xcode:

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS
xcodegen generate
```

2. Configurar credenciais locais:

- Copie `Config.local.example.plist` para `Config.local.plist`.
- Preencha:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

3. Abrir no Xcode:

```bash
open /Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/CryptoRaiskasIOS.xcodeproj
```

4. Rodar em simulador ou iPhone físico com scheme `CryptoRaiskasIOS`.

## Funcionalidades atuais

- Login e sessão (Supabase Auth).
- Home com cards de resumo e mercado.
- Crypto com carteira/operações e modais de CRUD.
- Carteira com evolução histórica e gráfico interativo.
- Painel Administrativo:
  - Visão Geral
  - Usuários (com ações de editar/reset/excluir)
  - Empresas (com ações de editar/excluir)
  - Alertas de preço (CRUD + toggle ativo/inativo)
- Logout via Painel Administrativo.

## Alertas de preço (iOS + Supabase)

Documentação completa:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/alertas-preco-ios.md`

Resumo técnico:

- Tela de Alertas dentro do Painel Administrativo.
- Registro de device token APNs no Supabase.
- Deep link para abrir alerta via push (`cryptoraiskas://alerts?...`).
- Monitoramento server-side por Edge Function + `pg_cron` + `pg_net`.
- Sem polling contínuo no iOS.

## Carteira no iOS (estado atual)

Arquivo principal: `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/Features/Portfolio/PortfolioView.swift`

Implementado:
- Gráfico com séries de `Aporte`, `Valor da Carteira` e `Resultado`.
- Seleção por gesto (drag) com leitura dinâmica por data.
- Card de dados selecionados no padrão visual do projeto.
- Painel adaptado para iPhone mantendo as mesmas informações da versão Web.

## Widget iOS (tela bloqueada)

Arquivos principais:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Widgets/CryptoRaiskasWidgets/CryptoRaiskasWidgets.swift`
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/Core/WidgetPortfolioSnapshotStore.swift`

Implementado:

- Widget de lock screen com formatos:
  - `accessoryInline`
  - `accessoryCircular`
  - `accessoryRectangular`
- Card retangular com layout final:
  - logo do app (asset `icon-192x192.png`)
  - valor total do portfólio (linha superior)
  - `L/P` com percentual (linha inferior)
- Atualização de dados via App Group (`group.com.raiskas.ios`) a partir do app principal.
- Visual com foco em leitura rápida no lock screen (tipografia e contraste ajustados).

Observações operacionais:

- Alterações de visual em widgets podem ficar em cache do iOS.
- Quando mudar layout/asset do widget:
  1. Rodar app pelo Xcode.
  2. Remover widget da lock screen.
  3. Adicionar novamente.

## Padrões obrigatórios para futuras alterações

1. Não alterar lógica de dados sem atualizar também Web/macOS quando aplicável.
2. Manter rótulos e fluxos consistentes com a fonte de verdade (Web).
3. Evitar hardcode de credenciais no código.
4. Preservar safe areas e layout fullscreen no iPhone.
5. Sempre validar em:
   - iPhone SE (tela pequena)
   - iPhone padrão atual
   - iPhone Pro Max

## Troubleshooting

### Projeto não abre no Xcode

Erro de container/projeto inválido:

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS
xcodegen generate
open CryptoRaiskasIOS.xcodeproj
```

### Build/simulator preso em estado inconsistente

- Fechar app no simulador.
- Product > Clean Build Folder.
- Rebuild com scheme ativo `CryptoRaiskasIOS`.

### Login falha com hostname inválido

Verificar `SUPABASE_URL` em `Config.local.plist` (não usar placeholder).

## Entrega para iPhone físico

1. Conectar iPhone e confiar no Mac.
2. Em Xcode, selecionar device físico.
3. Signing & Capabilities:
   - Team válido
   - Bundle Identifier único
4. Product > Run.

## Publicação (próxima etapa)

Para distribuir via TestFlight/App Store:

1. Ajustar ícone final em `Assets.xcassets/AppIcon.appiconset`.
2. Product > Archive.
3. Distribute App via App Store Connect.
4. Submeter build no TestFlight.
