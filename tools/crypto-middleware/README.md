# Crypto Middleware (Trend + Macro Context)

Sistema de análise e alertas de criptoativos com estrutura multi-timeframe, confirmação por volume e contexto macro.

## Arquitetura

- `1W`: tendência macro (confirmador estrutural)
- `4H`: estrutura tática
- `1H`: gatilhos de execução
- Volume validado apenas em candles fechados
- Context Score (`0-100`)
- RR e RR_ATR informativos
- Macro on-chain (MVRV BTC)
- Macro/News integrado via `macro_context.py`

## Estrutura do projeto

- `/Users/claudioraikasfh/crypto-middleware/middleware.py`
  - Motor principal.
  - Busca dados Kraken (`1H/4H/1W`) com fallback de endpoint.
  - Calcula RSI, EMA, ATR, regimes, range, RR e RR_ATR.
  - Detecta gatilhos (`spring`, `reclaim`, `breakout`, `breakdown`).
  - Define estágio (`WAIT`, `SMALL`, `MEDIUM`, `FULL`).
  - Mostra gargalos dominantes e countdown de fechamento (`1H/4H/1W`).
  - Usa macro integrado por padrão e suporta digest legado opcional.

- `/Users/claudioraikasfh/crypto-middleware/macro_context.py`
  - Pipeline macro integrado (FRED + Finnhub opcional + RSS).
  - Gera contexto com `badge`, `macro_score`, `posture`, `highlights` e `notes`.
  - Cache em `/Users/claudioraikasfh/crypto-middleware/cache/macro_context.json`.

- `/Users/claudioraikasfh/crypto-middleware/macro_sources.py`
  - Coletores HTTP de dados macro e notícias.

- `/Users/claudioraikasfh/crypto-middleware/cache_utils.py`
  - Utilitários de cache/TTL e escrita de JSON.

- `/Users/claudioraikasfh/crypto-middleware/services/macro_sentinel.py`
  - Fluxo legado opcional.
  - Gera `macro_digest.json` com `risk_score`, headlines e drivers.
  - Pode ser lido pelo middleware quando `USE_MACRO_DIGEST=1`.

- `/Users/claudioraikasfh/crypto-middleware/run_middleware.sh`
  - Script auxiliar para ativar venv, carregar `.env` local e rodar `middleware.py` com log diário.

## Como rodar

### Opção A (recomendada): macro integrado

1. Configure o ambiente:

```bash
cp .env.example .env
```

2. (Opcional) Preencha no `.env`:

- `FRED_API_KEY`
- `FINNHUB_API_KEY`

3. Rode:

```bash
python3 middleware.py
```

### Opção B (legado): macro digest externo

1. Gere o digest:

```bash
python3 services/macro_sentinel.py
```

2. Rode o middleware com leitura do digest:

```bash
USE_MACRO_DIGEST=1 python3 middleware.py
```

## Script de execução com log

```bash
bash run_middleware.sh
```

Logs em:

- `/Users/claudioraikasfh/crypto-middleware/logs/`

## Backtest (a partir dos logs)

Rodar backtest padrão (`SMALL,MEDIUM,FULL` entra, `WAIT` sai, hold máximo 24h, taxa 5 bps por lado):

```bash
python3 scripts/backtest_from_logs.py
```

Saídas geradas:

- `/Users/claudioraikasfh/crypto-middleware/data/backtests/backtest_summary.json`

Exemplo mudando parâmetros:

```bash
python3 scripts/backtest_from_logs.py --max-hold-hours 12 --fee-bps 3
```

Sweep de calibração (`4h,8h,24h,48h` e comparação `SMALL` vs `SMALL+MEDIUM+FULL`):

```bash
python3 scripts/backtest_sweep.py
```

Saídas do sweep:

- `/Users/claudioraikasfh/crypto-middleware/data/backtests/backtest_sweep.json`
- `/Users/claudioraikasfh/crypto-middleware/data/backtests/backtest_sweep_report.md`

## Dashboard Web (local)

Subir o dashboard:

```bash
python3 web_dashboard.py
```

Abrir no navegador:

- `http://127.0.0.1:8000`

No dashboard:

- Aba `Trading`: stages, backtest e recent trades.
- Aba `Global News`:
  - Top 5 riscos do dia para cripto
  - Headlines por categoria (`Juros/Fed`, `Inflação`, `Geopolítica`, `Regulação`, `Liquidez`)
  - Crypto Relevance Score por notícia
  - Bloco `O Que Observar Hoje` (watchlist tática)
- Botão `Atualizar`: dispara `middleware.py` e, ao concluir, recarrega os dados da tela.
- Bloco `O Que Fazer Agora`: recomendação simples por ativo (`Entrar Pequena/Média/Forte` ou `Aguardar`), com semáforo e checklist rápido.

O dashboard lê estes arquivos:

- `/Users/claudioraikasfh/crypto-middleware/logs/BTCUSDT.jsonl`
- `/Users/claudioraikasfh/crypto-middleware/logs/ETHUSDT.jsonl`
- `/Users/claudioraikasfh/crypto-middleware/logs/XRPUSDT.jsonl`
- `/Users/claudioraikasfh/crypto-middleware/data/backtests/backtest_summary.json`
- `/Users/claudioraikasfh/crypto-middleware/data/backtests/backtest_sweep.json`
- `/Users/claudioraikasfh/crypto-middleware/data/trade_history.jsonl` (histórico de sinais BUY/SELL)

`Recent Trades`:

- Fonte principal: `data/trade_history.jsonl`
- A API consolida eventos BUY/SELL em trades com status `OPEN`/`CLOSED`
- Endpoint: `GET /api/recent-trades`

Se quiser preencher histórico inicial a partir do backtest já existente:

```bash
python3 scripts/backfill_trade_history.py
```

## Variáveis importantes

- `KRAKEN_BASE_URL` (default: `https://api.kraken.com`)
- `KRAKEN_FALLBACKS` (default: vazio)
- `ENABLE_CONTINUATION_MODE=1` (habilita entrada tática por momentum de 24h)
- `CONT_MIN_24H_PCT=4.0`
- `CONT_MIN_VOL1_RATIO=0.90`
- `CONT_MIN_RR_ATR=1.20`
- `CONT_REQUIRE_ABOVE_EMA50=0`
- `DISABLE_MACRO=1` (desliga macro)
- `DISABLE_NEWS=1` (desliga RSS)
- `USE_MACRO_DIGEST=1` (habilita leitura de `macro_digest.json`)
- `QOL_DEBUG=1` (mostra debug extra)

## Observações

- Se dados macro estiverem indisponíveis, o sistema deve tratar como `sem_dados` (badge amarelo), sem forçar `WAIT` por isso.
- O motor de decisão dos estágios está em `decide_stage()` dentro de `middleware.py`.
