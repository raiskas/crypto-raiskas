# Documentação - Crypto Raiskas

Este diretório centraliza a documentação oficial do projeto **Crypto Raiskas** (Web, macOS e iOS).

## Índice principal

- [Visão Geral do Projeto](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/projeto.md)
- [Guia de Desenvolvimento](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/guia-desenvolvimento.md)
- [Autenticação e Permissões](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/autenticacao-permissoes.md)
- [Banco de Dados](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/banco-dados.md)
- [Documentação Completa](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/documentacao-completa.md)
- [Histórico de Desenvolvimento](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/historico-desenvolvimento.md)

## Documentos por plataforma

- [App Nativo macOS](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/macos-app.md)
- [App Nativo iOS](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/ios-app.md)
- [Alertas de Preço (iOS + Supabase)](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/alertas-preco-ios.md)
- [Auditoria de Fidelidade Web x iOS](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/ios-fidelidade-auditoria.md)
- [Sincronização de Contrato (Web x macOS)](/Users/claudioraikasfh/Desktop/crypto-raiskas/@docs/sincronizacao-web-macos.md)

## Setup rápido (Web)

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas
pnpm install
pnpm sync:platforms
pnpm db:init
pnpm dev
```

## Setup rápido (macOS)

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas/apps/macos/RaiskasMac
xcodegen generate
open RaiskasMac.xcodeproj
```

## Setup rápido (iOS)

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS
xcodegen generate
open CryptoRaiskasIOS.xcodeproj
```

## Regra obrigatória de consistência

Sempre que houver mudança de **branding**, **menu**, **rótulos de tela** ou **nomes de modais**:

1. Edite: `/Users/claudioraikasfh/Desktop/crypto-raiskas/shared/cross-platform.contract.json`
2. Rode: `pnpm sync:platforms`
3. Valide: `pnpm sync:platforms:check`

Observação: hoje a sincronização automática cobre **Web e macOS**. Para iOS, os ajustes equivalentes ainda são manuais (registrados em `@docs/ios-app.md`).
