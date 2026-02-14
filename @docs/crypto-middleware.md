# Crypto Middleware (Unificado no Crypto Raiskas)

## Objetivo

Centralizar o Crypto Middleware dentro do projeto principal `crypto-raiskas`, sem depender de um segundo servidor externo.

## Arquitetura Final

- Código fonte do middleware mantido em:
  - `/Users/claudioraikasfh/Desktop/crypto-raiskas/tools/crypto-middleware`
- UI do middleware servida pelo próprio Next.js em arquivos estáticos:
  - `/Users/claudioraikasfh/Desktop/crypto-raiskas/public/crypto-middleware/index.html`
  - `/Users/claudioraikasfh/Desktop/crypto-raiskas/public/crypto-middleware/app.js`
  - `/Users/claudioraikasfh/Desktop/crypto-raiskas/public/crypto-middleware/styles.css`
- Página do app principal:
  - `/Users/claudioraikasfh/Desktop/crypto-raiskas/src/app/(dashboard)/crypto-middleware/page.tsx`
  - Carrega `iframe` interno para `/crypto-middleware/index.html` (mesmo domínio e mesmo projeto).

### Resolução de Base de Dados (logs/trades/backtests)

As APIs do módulo escolhem automaticamente a base do middleware com dados válidos, na seguinte prioridade:

1. `CRYPTO_MW_BASE_DIR` (se definido)
2. `tools/crypto-middleware` (dentro do projeto)
3. `$HOME/crypto-middleware` (compatibilidade com ambiente legado)

Critérios usados: presença de `middleware.py`, logs `.jsonl`, `trade_history.jsonl` e arquivos de backtest.

## APIs Internas Usadas Pela UI

Todos os dados são lidos no próprio Next.js:

- `GET /api/crypto-middleware/live`
- `GET /api/crypto-middleware/backtest-summary`
- `GET /api/crypto-middleware/backtest-sweep`
- `GET /api/crypto-middleware/global-news`
- `GET /api/crypto-middleware/recent-trades`
- `POST /api/crypto-middleware/refresh-run`
- `GET /api/crypto-middleware/refresh-status`

### Resiliência de Backtest

Quando os arquivos de backtest ainda não existem (`backtest_summary.json` / `backtest_sweep.json`), as APIs:

- `GET /api/crypto-middleware/backtest-summary`
- `GET /api/crypto-middleware/backtest-sweep`

retornam `200` com payload `sem_dados`, evitando erro de tela por `404`.

## Execução

Somente um servidor:

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas
pnpm dev
```

Acesso:

- `http://localhost:3000/crypto-middleware`

## Segurança e Permissões

- Módulo de permissão: `crypto_middleware`
- Permissões:
  - `crypto_middleware_visualizar`
  - `crypto_middleware_executar`
- Usuário master mantém acesso total.

## Ajuste Funcional (14/02/2026)

No painel `O Que Fazer Agora`:

- se existir trade `OPEN` para o ativo no `recent-trades`;
- e o plano retornar `AGUARDAR`;
- a UI exibe `MANTER POSIÇÃO`.

Arquivo alterado:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/tools/crypto-middleware/web/app.js`
- sincronizado em:
  - `/Users/claudioraikasfh/Desktop/crypto-raiskas/public/crypto-middleware/app.js`

## Ajuste de Paridade de Payload (14/02/2026)

Para manter comportamento idêntico ao dashboard original:

- `getLivePayload` foi alinhado ao algoritmo de `build_live_payload` do projeto original.
- `getRecentTradesPayload` foi alinhado ao algoritmo de `build_recent_trades_payload` (consolidação BUY/SELL em OPEN/CLOSED).

Arquivo backend ajustado:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/src/lib/crypto-middleware/data.ts`

Impacto esperado:

- bloco `O Que Fazer Agora` deixa de mostrar `confiança: 0%` com dados válidos;
- `Recent Trades` deixa de exibir eventos brutos e passa a mostrar trades consolidados.
- `Global News` passa a usar exatamente o payload original do projeto legado.

### Paridade Total de Global News

Para eliminar divergências de estrutura/conteúdo no tab `Global News`, o backend interno chama diretamente:

- `build_global_news_payload()` de `web_dashboard.py`

Arquivo:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/src/lib/crypto-middleware/data.ts`

## Correção do Botão "Atualizar" (Trading Radar)

O endpoint de refresh interno passou a usar o Python do ambiente virtual do middleware quando disponível:

- prioridade: `tools/crypto-middleware/.venv312/bin/python`
- fallback: `python3` do sistema

Arquivo:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/src/lib/crypto-middleware/refresh.ts`

Objetivo: evitar erro `ModuleNotFoundError: No module named 'requests'` ao rodar `middleware.py`.

### Compatibilidade de JSON de Backtest

Arquivos gerados pelo Python podem conter `NaN`/`Infinity` em métricas como `profit_factor`.
Foi adicionado parser tolerante no backend para sanitizar esses valores para `null` antes do `JSON.parse`.

Arquivo:

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/src/lib/crypto-middleware/data.ts`

## Observações

- O script antigo para subir `web_dashboard.py` separado foi removido do fluxo padrão.
- O runtime agora é único: Next.js + APIs internas + arquivos do middleware dentro do próprio repositório.
