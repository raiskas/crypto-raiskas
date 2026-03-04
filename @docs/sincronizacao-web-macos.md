# Sincronização de Contrato (Web x macOS)

Este projeto usa um contrato compartilhado para manter consistência de branding e navegação entre plataformas.

## Escopo atual da sincronização automática

Coberto automaticamente:
- Web (Next.js)
- macOS (SwiftUI)

Ainda não coberto automaticamente:
- iOS (SwiftUI) — replicação manual guiada.

## Fonte de verdade

Arquivo:
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/shared/cross-platform.contract.json`

Controla:
- nome oficial do app
- labels do menu principal
- labels do admin
- labels de modais

## Geração automática

Comando:

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas
pnpm sync:platforms
```

Arquivos atualizados pelo gerador:

- Web: `/Users/claudioraikasfh/Desktop/crypto-raiskas/src/lib/cross-platform-contract.ts`
- macOS: bloco gerado em `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/macos/RaiskasMac/Sources/App/AppDestination.swift`

## Validação (pré-commit)

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas
pnpm sync:platforms:check
```

## Regra de manutenção

Fluxo obrigatório para qualquer alteração de labels/menus:

1. Editar `shared/cross-platform.contract.json`
2. Rodar `pnpm sync:platforms`
3. Rodar `pnpm sync:platforms:check`
4. Validar Web e macOS
5. Replicar no iOS (manual) e validar iPhone simulador/dispositivo

## Arquivos que não devem ser editados manualmente

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/src/lib/cross-platform-contract.ts`
- bloco `BEGIN/END GENERATED CONTRACT` em `AppDestination.swift`

## Próxima melhoria recomendada

Expandir o script `scripts/sync-cross-platform.mjs` para gerar também o contrato do iOS (`AppContract.swift`) e eliminar ajuste manual.
