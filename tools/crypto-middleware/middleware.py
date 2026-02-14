"""
Raiskas Crypto Middleware — Trend Following com Alertas (1H) e Confirmação (1W)
+ Macro/News (INTEGRADO via macro_context.py, com cache/TTL)
+ (Opcional) compatibilidade com macro_digest.json (macro_sentinel.py) — legado

================================================================================
O QUE ESTE SCRIPT FAZ
--------------------------------------------------------------------------------
Para cada símbolo (BTCUSDT, ETHUSDT, XRPUSDT), o middleware:

1) Puxa preço e klines (1H, 4H, 1W) na Kraken (com fallback de endpoint)
2) Calcula:
   - Regimes (1W e 4H) por inclinação (slope)
   - RSI (1H e 4H) com Wilder
   - EMA50/EMA200 (4H)
   - ATR (4H)
   - RR (range 4H) e RR_ATR
   - Context Score (0-100) informativo
   - CapMVRVCur (BTC) via CoinMetrics (cache diário)

3) Gera alertas:
   - 4H: viradas (bullish/bearish), proximidade swing_high/swing_low
   - 1H: breakout/breakdown do range 4H, rompimento max/min 1H, fakeouts,
         proximidade do topo/fundo do range 4H, spring/reclaim do swing_low 4H

4) Decide estágio (NÃO ALTERAR):
   - WAIT / SMALL / MEDIUM / FULL
   - decide_stage() não é alterada por QoL nem por Macro/News

5) QoL (UX):
   - Countdown híbrido de fechamentos (UTC)
   - Aviso informativo quando stage libera entrada mas volume 4H ainda é fraco (não altera decisão)
   - Clamp só na EXIBIÇÃO do downside do RR se o preço ficar abaixo do fundo do range 4H

6) Macro/News (NOVO — integrado):
   - Usa macro_context.py (FRED + Finnhub opcional + RSS) com cache/TTL em ./cache/
   - Exibe uma linha "📰 Macro/News: ..." + bullets de manchetes resumidas (quando disponíveis)
   - IMPORTANTÍSSIMO: falta de dados (n/a/indisponível) vira 🟡 “sem dados”
     e NÃO força WAIT e NÃO altera decide_stage.

7) (Opcional) Macro Digest Legado:
   - Se USE_MACRO_DIGEST=1, tenta ler macro_digest.json (macro_sentinel.py)
   - Útil para quem já tinha pipeline externo rodando.
   - Mesmo no legado: indisponível/stale deve ser 🟡 “sem dados” (não 🔴 pânico).

================================================================================
COMO USAR (macOS)
--------------------------------------------------------------------------------
1) (Recomendado) Macro integrado:
   - Crie os arquivos: macro_context.py, macro_sources.py, cache_utils.py
   - Rode:
     python3 middleware.py

2) (Opcional) Legado macro_sentinel:
   - Rode: python3 macro_sentinel.py
   - Depois: python3 middleware.py
   - Sete: USE_MACRO_DIGEST=1

================================================================================
CONFIG KRAKEN (robustez)
--------------------------------------------------------------------------------
- KRAKEN_BASE_URL (opcional):
    KRAKEN_BASE_URL=https://api.kraken.com

- KRAKEN_FALLBACKS (opcional, CSV):
    KRAKEN_FALLBACKS=

O script tenta KRAKEN_BASE_URL e depois fallbacks em caso de erro HTTP/rede.

================================================================================
CONFIG MACRO INTEGRADO (macro_context.py)
--------------------------------------------------------------------------------
- DISABLE_MACRO=1    (desliga macro)
- DISABLE_NEWS=1     (desliga RSS)
- FRED_API_KEY=...
- FINNHUB_API_KEY=...  (opcional)
- RSS_FEEDS=...,...   (opcional)
- MACRO_TTL_H=24
- FIN_TTL_H=6
- NEWS_TTL_MIN=45

================================================================================
LEGADO MACRO DIGEST (macro_digest.json)
--------------------------------------------------------------------------------
- USE_MACRO_DIGEST=1
- MACRO_DIGEST_PATH (opcional)
- MACRO_DIGEST_MAX_AGE_H (default: 6)

================================================================================
DEBUG
--------------------------------------------------------------------------------
- QOL_DEBUG=1
  Mostra detalhes extras (ex.: qual endpoint Kraken usou; motivo de “sem dados” no macro)

================================================================================
"""

import json
import os
import requests
from datetime import datetime, timezone
from statistics import mean
from typing import Dict, List, Tuple, Optional

# ============================================================
# BASE DIR (robusto p/ GitHub/cron)
# ============================================================
try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
except Exception:
    BASE_DIR = os.getcwd()


def _load_local_env_file(base_dir: str) -> None:
    """
    Carrega .env local sem dependência externa e sem sobrescrever variáveis já exportadas.
    """
    env_path = os.path.join(base_dir, ".env")
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                if not key or key in os.environ:
                    continue
                value = value.strip().strip('"').strip("'")
                os.environ[key] = value
    except Exception:
        # Falha no .env não pode derrubar o middleware.
        return


_load_local_env_file(BASE_DIR)

# ============================================================
# KRAKEN BASE URL + FALLBACKS
# ============================================================
KRAKEN_BASE_URL = os.getenv("KRAKEN_BASE_URL", "https://api.kraken.com").strip()
KRAKEN_FALLBACKS = os.getenv("KRAKEN_FALLBACKS", "").strip()

SYMBOL_TO_KRAKEN_PAIR = {
    "BTCUSDT": "XBTUSD",
    "ETHUSDT": "ETHUSD",
    "XRPUSDT": "XRPUSD",
    # aliases opcionais
    "BTCUSD": "XBTUSD",
    "ETHUSD": "ETHUSD",
    "XRPUSD": "XRPUSD",
}

INTERVAL_TO_KRAKEN_MINUTES = {
    "1h": 60,
    "4h": 240,
    "1w": 10080,
}


def _kraken_base_urls() -> List[str]:
    urls: List[str] = []
    if KRAKEN_BASE_URL:
        urls.append(KRAKEN_BASE_URL.rstrip("/"))
    if KRAKEN_FALLBACKS:
        for u in KRAKEN_FALLBACKS.split(","):
            u = u.strip()
            if u:
                urls.append(u.rstrip("/"))
    # dedup preservando ordem
    out: List[str] = []
    seen = set()
    for u in urls:
        if u not in seen:
            out.append(u)
            seen.add(u)
    return out

# ============================================================
# CONFIGURAÇÃO — ALOCAÇÃO
# ============================================================
TARGET_ALLOCATION_PCT = {
    "BTCUSDT": 30.0,
    "ETHUSDT": 20.0,
    "XRPUSDT": 10.0,
}

SCALE_SMALL = 0.20
SCALE_MEDIUM = 0.50
SCALE_FULL = 1.00

# =========================
# CONFIGURAÇÃO — LIMITES DE KLINES
# =========================
KLINES_LIMIT_1H = 200
KLINES_LIMIT_4H = 600
KLINES_LIMIT_1W = 200

# =========================
# CONFIGURAÇÃO — LOOKBACKS
# =========================
RANGE_4H_LOOKBACK = 30
HIGHLOW_1H_LOOKBACK = 48
PIVOT_4H_LOOKBACK = 20

# =========================
# CONFIGURAÇÃO — VOLUME
# =========================
VOL_WINDOW_1H = 50
VOL_MULTIPLIER_1H = 1.05

VOL_WINDOW_4H = 50
VOL_MULTIPLIER_4H = 1.00

# =========================
# CONTINUATION MODE (captura tendência de várias horas/1 dia)
# =========================
ENABLE_CONTINUATION_MODE = os.getenv("ENABLE_CONTINUATION_MODE", "0").strip().lower() in ("1", "true", "yes", "on")
CONT_MIN_24H_PCT = float(os.getenv("CONT_MIN_24H_PCT", "4.0"))
CONT_MIN_VOL1_RATIO = float(os.getenv("CONT_MIN_VOL1_RATIO", "0.90"))
CONT_MIN_RR_ATR = float(os.getenv("CONT_MIN_RR_ATR", "1.20"))
CONT_STRONG_MIN_24H_PCT = float(os.getenv("CONT_STRONG_MIN_24H_PCT", "6.0"))
CONT_STRONG_MIN_RR_ATR = float(os.getenv("CONT_STRONG_MIN_RR_ATR", "2.0"))
CONT_REQUIRE_ABOVE_EMA50 = os.getenv("CONT_REQUIRE_ABOVE_EMA50", "0").strip().lower() in ("1", "true", "yes", "on")

# =========================
# CONFIGURAÇÃO — PROXIMIDADE / ESTRUTURA
# =========================
RANGE_EDGE_PCT = 0.12      # % da largura do range (posicional)
PROX_PCT_PIVOT = 0.030     # % do nível do pivô

# EPS apenas para QoL (não mexe em alertas/decisão)
EDGE_EPS_PCT = float(os.getenv("EDGE_EPS_PCT", "1.00"))

SPRING_LOOKBACK_1H = 6
SPRING_MAX_CLOSE_ABOVE = 0.010

# =========================
# CONFIGURAÇÃO — INDICADORES
# =========================
RSI_PERIOD = 14
EMA_FAST_4H = 50
EMA_SLOW_4H = 200

# =========================
# CONFIGURAÇÃO — ATR (4H)
# =========================
ATR_PERIOD = 14
ATR_PCT_CALM_MAX = 1.5
ATR_PCT_NORMAL_MAX = 3.0

# =========================
# CONFIGURAÇÃO — RR (Assimetria)
# =========================
RR_DOWNSIDE_FLOOR_PCT = float(os.getenv("RR_DOWNSIDE_FLOOR_PCT", "0.50"))
RR_ATR_RISK_MULT = float(os.getenv("RR_ATR_RISK_MULT", "1.00"))

# =========================
# CONFIABILIDADE — DADOS / RISCO
# =========================
MIN_DATA_QUALITY_SCORE = int(os.getenv("MIN_DATA_QUALITY_SCORE", "80"))
MIN_BARS_1H = int(os.getenv("MIN_BARS_1H", "120"))
MIN_BARS_4H = int(os.getenv("MIN_BARS_4H", "180"))
MIN_BARS_1W = int(os.getenv("MIN_BARS_1W", "80"))

MAX_RISK_PER_TRADE_CAPITAL_PCT = float(os.getenv("MAX_RISK_PER_TRADE_CAPITAL_PCT", "1.50"))
MAX_PORTFOLIO_RISK_CAPITAL_PCT = float(os.getenv("MAX_PORTFOLIO_RISK_CAPITAL_PCT", "3.00"))

# =========================
# CONFIGURAÇÃO — HISTÓRICO POR ATIVO (paths robustos)
# =========================
ENABLE_HISTORY_LOG = True
LOG_DIR = os.getenv("LOG_DIR", os.path.join(BASE_DIR, "logs"))

# =========================
# CONFIGURAÇÃO — DEDUP (paths robustos)
# =========================
DEDUP_ALERTS = True
ALERT_STATE_FILE = os.getenv("ALERT_STATE_FILE", os.path.join(BASE_DIR, ".alert_state.json"))
TRADE_HISTORY_FILE = os.getenv("TRADE_HISTORY_FILE", os.path.join(BASE_DIR, "data", "trade_history.jsonl"))
ACTIVE_STAGES = {"SMALL", "MEDIUM", "FULL"}

# =========================
# CONFIGURAÇÃO — MVRV (CoinMetrics grátis) (path robusto)
# =========================
COINMETRICS_BASE = os.getenv("COINMETRICS_BASE_URL", "https://community-api.coinmetrics.io")
CAP_MVRV_METRIC = "CapMVRVCur"
MVRV_CACHE_FILE = os.getenv("MVRV_CACHE_FILE", os.path.join(BASE_DIR, ".mvrv_cache.json"))
MVRV_CACHE_TTL_SECONDS = 24 * 60 * 60
REQUEST_TIMEOUT = 12

MVRV_FLOOR_MAX = 0.80
MVRV_EUPHORIA_MIN = 2.20

# =========================
# CONFIGURAÇÃO — DEBUG QoL
# =========================
QOL_DEBUG = os.getenv("QOL_DEBUG", "0").strip() in ("1", "true", "TRUE", "yes", "YES")

# =========================
# MACRO INTEGRADO (macro_context.py)
# =========================
DISABLE_MACRO = os.getenv("DISABLE_MACRO", "0").strip().lower() in ("1", "true", "yes", "on")
DISABLE_NEWS = os.getenv("DISABLE_NEWS", "0").strip().lower() in ("1", "true", "yes", "on")

# =========================
# (Opcional) LEGADO: MACRO DIGEST (macro_sentinel.py)
# =========================
USE_MACRO_DIGEST = os.getenv("USE_MACRO_DIGEST", "0").strip().lower() in ("1", "true", "yes", "on")
MACRO_DIGEST_PATH = os.getenv("MACRO_DIGEST_PATH", "").strip()  # vazio => auto-discover
MACRO_DIGEST_DEFAULT_NAME = "macro_digest.json"
MACRO_DIGEST_MAX_AGE_H = float(os.getenv("MACRO_DIGEST_MAX_AGE_H", "6"))


# ============================================================
# MACRO (integrado) — import tolerante
# ============================================================
try:
    from macro_context import get_macro_context  # requer macro_context.py ao lado
except Exception as e:
    get_macro_context = None
    if QOL_DEBUG:
        print(f"🧪 DEBUG: macro_context import falhou ({type(e).__name__}): {e}")


# ============================================================
# DATA FETCH (Kraken com fallback)
# ============================================================
def _kraken_request(path: str, params: Dict, timeout: int = 10) -> Tuple[Optional[dict], Optional[str], Optional[str]]:
    """
    Retorna (json, err, used_base_url)
    """
    last_err = None
    used = None
    for base in _kraken_base_urls():
        used = base
        try:
            r = requests.get(f"{base}{path}", params=params, timeout=timeout)
            if r.status_code != 200:
                last_err = f"HTTP {r.status_code} via {base} ({path})"
                continue
            js = r.json()
            errs = js.get("error") if isinstance(js, dict) else None
            if isinstance(errs, list) and errs:
                last_err = f"Kraken error via {base}: {';'.join(str(x) for x in errs)}"
                continue
            return js, None, base
        except Exception as e:
            last_err = f"{type(e).__name__} via {base}: {e}"
            continue
    return None, last_err or "kraken_request_failed", used


def _kraken_pair(symbol: str) -> str:
    s = (symbol or "").upper().strip()
    pair = SYMBOL_TO_KRAKEN_PAIR.get(s)
    if not pair:
        raise RuntimeError(f"Símbolo não mapeado para Kraken: {symbol}")
    return pair


def get_price(symbol: str) -> float:
    pair = _kraken_pair(symbol)
    js, err, used = _kraken_request("/0/public/Ticker", {"pair": pair}, timeout=10)
    if err or not js:
        raise RuntimeError(f"Falha get_price({symbol}): {err}")
    result = js.get("result", {}) if isinstance(js, dict) else {}
    if not isinstance(result, dict) or not result:
        raise RuntimeError(f"Falha get_price({symbol}): resposta vazia de ticker")
    pair_key = next(iter(result.keys()))
    item = result.get(pair_key, {})
    if not isinstance(item, dict):
        raise RuntimeError(f"Falha get_price({symbol}): ticker inválido")
    c = item.get("c")
    if not isinstance(c, list) or not c:
        raise RuntimeError(f"Falha get_price({symbol}): campo c ausente")
    if QOL_DEBUG and used:
        print(f"🧪 DEBUG(KRAKEN): get_price {pair} via {used}")
    return float(c[0])


def get_klines(symbol: str, interval: str, limit: int = 200):
    pair = _kraken_pair(symbol)
    k_int = INTERVAL_TO_KRAKEN_MINUTES.get(interval.lower().strip())
    if not k_int:
        raise RuntimeError(f"Intervalo não suportado para Kraken: {interval}")
    js, err, used = _kraken_request(
        "/0/public/OHLC",
        {"pair": pair, "interval": k_int},
        timeout=10,
    )
    if err or js is None:
        raise RuntimeError(f"Falha get_klines({symbol},{interval}): {err}")
    result = js.get("result", {}) if isinstance(js, dict) else {}
    if not isinstance(result, dict) or not result:
        raise RuntimeError(f"Falha get_klines({symbol},{interval}): resposta vazia")
    rows = []
    for k, v in result.items():
        if k == "last":
            continue
        if isinstance(v, list):
            rows = v
            break
    if not rows:
        raise RuntimeError(f"Falha get_klines({symbol},{interval}): sem candles")
    if limit > 0 and len(rows) > limit:
        rows = rows[-limit:]

    out: List[Dict] = []
    for r in rows:
        # Kraken OHLC: [time, open, high, low, close, vwap, volume, count]
        try:
            open_s = int(float(r[0]))
            close_s = open_s + (k_int * 60) - 1
            out.append(
                {
                    "open_time": open_s * 1000,
                    "open": float(r[1]),
                    "high": float(r[2]),
                    "low": float(r[3]),
                    "close": float(r[4]),
                    "volume": float(r[6]),
                    "close_time": close_s * 1000,
                }
            )
        except Exception:
            continue
    if not out:
        raise RuntimeError(f"Falha get_klines({symbol},{interval}): sem candles válidos")
    if QOL_DEBUG and used:
        print(f"🧪 DEBUG(KRAKEN): get_klines {pair} {interval} via {used}")
    return out


def kline_to_ohlcv(k) -> Dict:
    if isinstance(k, dict) and all(x in k for x in ("open_time", "open", "high", "low", "close", "volume", "close_time")):
        return {
            "open_time": int(k["open_time"]),
            "open": float(k["open"]),
            "high": float(k["high"]),
            "low": float(k["low"]),
            "close": float(k["close"]),
            "volume": float(k["volume"]),
            "close_time": int(k["close_time"]),
        }
    # Compatibilidade legada (formato Binance)
    return {
        "open_time": int(k[0]),
        "open": float(k[1]),
        "high": float(k[2]),
        "low": float(k[3]),
        "close": float(k[4]),
        "volume": float(k[5]),
        "close_time": int(k[6]),
    }


def _is_valid_ohlcv(c: Dict) -> bool:
    try:
        o = float(c["open"])
        h = float(c["high"])
        l = float(c["low"])
        cl = float(c["close"])
        v = float(c["volume"])
        if min(o, h, l, cl) <= 0:
            return False
        if v < 0:
            return False
        if h < max(o, cl):
            return False
        if l > min(o, cl):
            return False
        if h < l:
            return False
        return True
    except Exception:
        return False


def assess_ohlcv_quality(label: str, klines: List[Dict], min_bars: int, expected_step_ms: int) -> Tuple[int, List[str]]:
    score = 100.0
    issues: List[str] = []

    n = len(klines or [])
    if n < min_bars:
        ratio = safe_div(n, max(1, min_bars))
        penalty = (1.0 - ratio) * 40.0
        score -= penalty
        issues.append(f"{label}: histórico curto ({n}/{min_bars})")

    if n >= 2:
        bad_order = 0
        bad_step = 0
        checks = 0
        for i in range(1, n):
            t0 = int(klines[i - 1].get("open_time", 0) or 0)
            t1 = int(klines[i].get("open_time", 0) or 0)
            if t1 <= t0:
                bad_order += 1
                continue
            step = t1 - t0
            checks += 1
            if expected_step_ms > 0 and abs(step - expected_step_ms) > (expected_step_ms * 0.20):
                bad_step += 1

        if bad_order > 0:
            score -= min(30.0, bad_order * 12.0)
            issues.append(f"{label}: timestamps fora de ordem ({bad_order})")
        if checks > 0 and bad_step > 0:
            ratio = bad_step / checks
            score -= min(20.0, ratio * 100.0 * 0.5)
            issues.append(f"{label}: gaps/irregularidades temporais ({bad_step}/{checks})")

    invalid_candles = sum(1 for c in (klines or []) if not _is_valid_ohlcv(c))
    if invalid_candles > 0:
        score -= min(25.0, invalid_candles * 8.0)
        issues.append(f"{label}: candles inválidos ({invalid_candles})")

    return int(clamp(score, 0.0, 100.0)), issues


def data_quality_assessment(k1h: List[Dict], k4h: List[Dict], k1w: List[Dict]) -> Tuple[int, List[str], Dict]:
    s1, i1 = assess_ohlcv_quality("1H", k1h, MIN_BARS_1H, 60 * 60 * 1000)
    s4, i4 = assess_ohlcv_quality("4H", k4h, MIN_BARS_4H, 4 * 60 * 60 * 1000)
    sW, iW = assess_ohlcv_quality("1W", k1w, MIN_BARS_1W, 7 * 24 * 60 * 60 * 1000)
    agg = int(round((s1 * 0.40) + (s4 * 0.40) + (sW * 0.20)))
    issues = i1 + i4 + iW
    detail = {"score_1h": s1, "score_4h": s4, "score_1w": sW}
    return agg, issues, detail


def risk_capital_pct_from_stage(symbol: str, stage: str, downside_eff_pct: Optional[float]) -> float:
    if stage not in ACTIVE_STAGES:
        return 0.0
    if downside_eff_pct is None or downside_eff_pct <= 0:
        return 0.0
    alloc_pct = stage_to_allocation(symbol, stage)
    return max(0.0, alloc_pct * float(downside_eff_pct) / 100.0)


def latest_log_row(symbol: str) -> Optional[Dict]:
    path = os.path.join(LOG_DIR, f"{symbol}.jsonl")
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        for ln in reversed(lines):
            ln = ln.strip()
            if not ln:
                continue
            row = json.loads(ln)
            if isinstance(row, dict):
                return row
    except Exception:
        return None
    return None


def portfolio_risk_capital_pct(exclude_symbol: Optional[str] = None) -> float:
    total = 0.0
    for sym in ("BTCUSDT", "ETHUSDT", "XRPUSDT"):
        if exclude_symbol and sym == exclude_symbol:
            continue
        row = latest_log_row(sym)
        if not isinstance(row, dict):
            continue
        stg = str(row.get("stage", "WAIT")).upper()
        rr = row.get("rr_range_4h") if isinstance(row.get("rr_range_4h"), dict) else {}
        dn_eff = None
        if isinstance(rr, dict):
            try:
                dn_eff = float(rr.get("downside_eff_pct")) if rr.get("downside_eff_pct") is not None else None
            except Exception:
                dn_eff = None
        total += risk_capital_pct_from_stage(sym, stg, dn_eff)
    return total


def fmt_ts(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def now_ms_utc() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def fmt_countdown(seconds: int) -> str:
    s = max(0, int(seconds))
    d = s // 86400
    s -= d * 86400
    h = s // 3600
    s -= h * 3600
    m = s // 60
    parts: List[str] = []
    if d > 0:
        parts.append(f"{d}d")
    if h > 0 or d > 0:
        parts.append(f"{h}h")
    parts.append(f"{m}m")
    return "".join(parts)


def next_close_line(label: str, close_time_ms: int, now_ms: Optional[int] = None) -> str:
    nm = now_ms if now_ms is not None else now_ms_utc()
    secs = max(0, int((close_time_ms - nm) / 1000))
    return f"{label}: em {fmt_countdown(secs)} (UTC) — {fmt_ts(close_time_ms)}"


def next_close_short(label: str, close_time_ms: int, now_ms: Optional[int] = None) -> str:
    nm = now_ms if now_ms is not None else now_ms_utc()
    secs = max(0, int((close_time_ms - nm) / 1000))
    return f"{label} {fmt_countdown(secs)}"


def closes_panel_line(close_times_ms: Dict[str, int]) -> str:
    nm = now_ms_utc()
    p1 = next_close_line("1H", int(close_times_ms.get("1H", 0)), nm) if close_times_ms.get("1H") else "1H: n/a"
    p4 = next_close_line("4H", int(close_times_ms.get("4H", 0)), nm) if close_times_ms.get("4H") else "4H: n/a"
    pW = next_close_line("1W", int(close_times_ms.get("1W", 0)), nm) if close_times_ms.get("1W") else "1W: n/a"
    return f"⏱ Próximos fechamentos (UTC): {p1} | {p4} | {pW}"


def closes_triggers_short_line(close_times_ms: Dict[str, int]) -> str:
    nm = now_ms_utc()
    s1 = next_close_short("1H", int(close_times_ms.get("1H", 0)), nm) if close_times_ms.get("1H") else "1H n/a"
    s4 = next_close_short("4H", int(close_times_ms.get("4H", 0)), nm) if close_times_ms.get("4H") else "4H n/a"
    sW = next_close_short("1W", int(close_times_ms.get("1W", 0)), nm) if close_times_ms.get("1W") else "1W n/a"
    return f"⏱ Closes (UTC): {s1} | {s4} | {sW}"


def vol4_soft_warning_line(stage: str, vol4_ratio: float, close4_ms: Optional[int]) -> Optional[str]:
    """
    QoL: se stage libera entrada mas volume 4H ainda está abaixo do mínimo,
    imprime aviso (informativo). NÃO altera decide_stage().
    """
    if stage not in ("SMALL", "MEDIUM", "FULL"):
        return None
    if vol4_ratio <= 0:
        return None
    if vol4_ratio >= VOL_MULTIPLIER_4H:
        return None

    base = (
        f"⚠️ Aviso (informativo): stage={stage} liberou entrada, mas VOL 4H ainda fraco "
        f"({vol4_ratio:.2f}x < {VOL_MULTIPLIER_4H:.2f}x)."
    )
    if close4_ms:
        nm = now_ms_utc()
        secs = max(0, int((int(close4_ms) - nm) / 1000))
        base += f" Reavaliar no close 4H: em {fmt_countdown(secs)} — {fmt_ts(int(close4_ms))}."
    else:
        base += " Reavaliar no próximo close 4H."
    return base


# ============================================================
# HELPERS
# ============================================================
def closed_series(klines: List[Dict]) -> List[Dict]:
    if len(klines) >= 2:
        return klines[:-1]
    return klines


def safe_div(a: float, b: float) -> float:
    return a / b if b else 0.0


def pct(x: float) -> float:
    return x * 100.0


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def scale(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    if x1 == x0:
        return y0
    t = (x - x0) / (x1 - x0)
    t = clamp(t, 0.0, 1.0)
    return y0 + t * (y1 - y0)


def clamp_pct_nonneg(x_pct: float) -> float:
    return max(0.0, float(x_pct))


def clamp_range_pos_pct(x_pos_pct: float) -> float:
    return clamp(float(x_pos_pct), 0.0, 100.0)


def pct_change_lookback(closes: List[float], bars_back: int) -> Optional[float]:
    if not closes or bars_back <= 0 or len(closes) <= bars_back:
        return None
    last = float(closes[-1])
    prev = float(closes[-(bars_back + 1)])
    if prev <= 0:
        return None
    return pct((last / prev) - 1.0)


def hi_lo(klines: List[Dict], n: int) -> Tuple[float, float]:
    recent = klines[-n:] if len(klines) >= n else klines
    if not recent:
        return 0.0, 0.0
    return max(c["high"] for c in recent), min(c["low"] for c in recent)


def slope_regime(klines: List[Dict], lookback: int) -> str:
    if len(klines) < max(20, lookback):
        return "none"
    recent = klines[-lookback:]
    half = max(10, lookback // 2)

    c1 = mean(c["close"] for c in recent[:half])
    c2 = mean(c["close"] for c in recent[half:])
    l1 = mean(c["low"] for c in recent[:half])
    l2 = mean(c["low"] for c in recent[half:])
    h1 = mean(c["high"] for c in recent[:half])
    h2 = mean(c["high"] for c in recent[half:])

    if c2 > c1 and l2 > l1:
        return "up"
    if c2 < c1 and h2 < h1:
        return "down"
    return "none"


def pivot_levels(klines: List[Dict], lookback: int) -> Tuple[float, float]:
    window = klines[-(lookback + 1):-1] if len(klines) > lookback else klines[:-1]
    if not window:
        return 0.0, 0.0
    return max(c["high"] for c in window), min(c["low"] for c in window)


def vol_stats_closed(klines: List[Dict], window: int) -> Tuple[float, float, float]:
    if not klines:
        return 0.0, 0.0, 0.0
    ks = closed_series(klines) or klines
    last_v = ks[-1]["volume"]
    vols = [c["volume"] for c in ks[-window:]] if ks else []
    avg_v = mean(vols) if vols else 0.0
    ratio = safe_div(last_v, avg_v) if avg_v > 0 else 0.0
    return last_v, avg_v, ratio


def volume_ok_prev_1h(k1h: List[Dict]) -> bool:
    if len(k1h) < 5:
        return True
    ks = closed_series(k1h)
    if len(ks) < 3:
        return True
    prev = ks[-2]
    vols = [c["volume"] for c in ks[-VOL_WINDOW_1H:]]
    v_avg = mean(vols) if vols else 0.0
    return prev["volume"] >= VOL_MULTIPLIER_1H * v_avg if v_avg > 0 else True


def allocation_levels(symbol: str) -> Dict[str, float]:
    tgt = float(TARGET_ALLOCATION_PCT.get(symbol, 0.0))
    return {
        "small": tgt * SCALE_SMALL,
        "medium": tgt * SCALE_MEDIUM,
        "full": tgt * SCALE_FULL,
        "tgt": tgt,
    }


def stage_to_allocation(symbol: str, stage: str) -> float:
    levels = allocation_levels(symbol)
    return (
        levels["small"] if stage == "SMALL"
        else levels["medium"] if stage == "MEDIUM"
       	else levels["full"] if stage == "FULL"
        else 0.0
    )


def spring_reclaim_1h(k1h: List[Dict], swing_low_4h: float) -> bool:
    if swing_low_4h <= 0:
        return False
    ks = closed_series(k1h)
    if len(ks) < max(5, SPRING_LOOKBACK_1H):
        return False
    last = ks[-1]
    recent = ks[-SPRING_LOOKBACK_1H:]
    dipped = any(c["low"] < swing_low_4h for c in recent)
    reclaimed = last["close"] > swing_low_4h
    not_extended = safe_div((last["close"] - swing_low_4h), swing_low_4h) <= SPRING_MAX_CLOSE_ABOVE
    return dipped and reclaimed and not_extended


def rr_label(rr: Optional[float]) -> str:
    if rr is None:
        return "n/a"
    if rr >= 2.0:
        return "assimetria boa"
    if rr >= 1.0:
        return "assimetria ok"
    return "assimetria ruim"


def rr_range_4h_metrics(
    price: float,
    hi4: float,
    lo4: float,
    downside_floor_pct: float,
) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float], Optional[float], str]:
    if price <= 0 or hi4 <= 0 or lo4 <= 0 or hi4 <= lo4:
        return None, None, None, None, None, "n/a"

    upside = (hi4 - price) / price * 100.0
    downside = (price - lo4) / price * 100.0

    if downside <= 0.0001:
        downside_eff = max(float(downside), float(downside_floor_pct))
        rr_raw = None
        rr_adj = safe_div(upside, downside_eff) if downside_eff > 0 else None
        return upside, downside, downside_eff, rr_raw, rr_adj, rr_label(rr_adj)

    downside_eff = max(downside, float(downside_floor_pct))
    rr_raw = safe_div(upside, downside)
    rr_adj = safe_div(upside, downside_eff) if downside_eff > 0 else None
    return upside, downside, downside_eff, rr_raw, rr_adj, rr_label(rr_adj)


def rr_atr_metrics(
    upside_pct: Optional[float],
    atr_pct: Optional[float],
    atr_risk_mult: float,
) -> Tuple[Optional[float], Optional[float], str]:
    if upside_pct is None or atr_pct is None or atr_pct <= 0:
        return None, None, "n/a"
    risk_pct = atr_pct * float(atr_risk_mult)
    if risk_pct <= 0:
        return None, None, "n/a"
    rr_atr = safe_div(upside_pct, risk_pct)
    return risk_pct, rr_atr, rr_label(rr_atr)


# ============================================================
# (LEGADO) MACRO DIGEST — leitura híbrida por arquivo
# ============================================================
def _parse_iso_ts_to_epoch(ts_val: Optional[str]) -> Optional[int]:
    if not ts_val or not isinstance(ts_val, str):
        return None
    s = ts_val.strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except Exception:
        return None


def _candidate_macro_paths() -> List[str]:
    paths: List[str] = []
    if MACRO_DIGEST_PATH:
        paths.append(MACRO_DIGEST_PATH)
    paths.append(os.path.join(os.getcwd(), MACRO_DIGEST_DEFAULT_NAME))
    paths.append(os.path.join(BASE_DIR, MACRO_DIGEST_DEFAULT_NAME))

    out: List[str] = []
    seen = set()
    for p in paths:
        p2 = os.path.abspath(p)
        if p2 not in seen:
            out.append(p2)
            seen.add(p2)
    return out


def load_macro_digest() -> Tuple[Optional[Dict], Optional[str]]:
    candidates = _candidate_macro_paths()

    chosen = None
    for p in candidates:
        if os.path.exists(p):
            chosen = p
            break

    if not chosen:
        return None, f"arquivo não encontrado (tentou: {', '.join(candidates)})"

    try:
        with open(chosen, "r", encoding="utf-8") as f:
            digest = json.load(f)
    except Exception as e:
        return None, f"falha ao ler JSON ({chosen}): {e}"

    if isinstance(digest, dict):
        for k in ("data", "digest", "payload"):
            if isinstance(digest.get(k), dict):
                digest = digest[k]
                break

    max_age_h = max(0.0, float(MACRO_DIGEST_MAX_AGE_H))
    ts_epoch = None

    if isinstance(digest, dict):
        for k in ("ts_utc", "ts", "timestamp", "generated_at", "updated_at"):
            ts_epoch = _parse_iso_ts_to_epoch(digest.get(k))
            if ts_epoch is not None:
                break

    if ts_epoch is None:
        try:
            ts_epoch = int(os.path.getmtime(chosen))
        except Exception:
            ts_epoch = None

    age_s = None
    if ts_epoch is not None:
        age_s = int(datetime.now(timezone.utc).timestamp()) - int(ts_epoch)

    if ts_epoch is not None and max_age_h > 0 and age_s is not None:
        if age_s > int(max_age_h * 3600):
            # NOTE: não “pânico” — vira sem dados
            return None, f"digest antigo (stale): {age_s}s > {int(max_age_h*3600)}s ({chosen})"

    if isinstance(digest, dict):
        digest["_meta_path"] = chosen
        if ts_epoch is not None:
            digest["_meta_ts_epoch"] = int(ts_epoch)
        if age_s is not None:
            digest["_meta_age_s"] = int(age_s)

    return digest, None


def build_macro_news_line_from_digest(digest: Optional[Dict], err: Optional[str] = None) -> str:
    """
    LEGADO (macro_sentinel):
    - Se sem dados/erro/stale: 🟡 sem dados (NUNCA 🔴 por indisponibilidade)
    """
    badge = "🟡"
    if not isinstance(digest, dict) or not digest:
        return f"📰 Macro/News: {badge} sem dados | postura: sem_dados"

    macro = digest.get("macro") if isinstance(digest.get("macro"), dict) else {}
    risk = digest.get("risk_score", digest.get("risk", digest.get("riskScore", macro.get("risk_score"))))
    risk_label = digest.get("risk_label", digest.get("label", macro.get("label")))
    posture = digest.get("posture", digest.get("stance", macro.get("posture")))

    bullets = digest.get(
        "bullets",
        digest.get("highlights", digest.get("notes", digest.get("summary_lines", macro.get("drivers")))),
    )

    extra = ""
    if isinstance(bullets, list) and bullets:
        cleaned = [str(x).strip() for x in bullets if str(x).strip()]
        if cleaned:
            extra = " | " + "; ".join(cleaned[:4])

    if isinstance(risk, (int, float)):
        r_part = f"risco={float(risk):.0f}/100"
    else:
        r_part = "risco=n/a"

    if isinstance(risk_label, str) and risk_label.strip():
        r_part += f" ({risk_label.strip()})"

    if isinstance(posture, str) and posture.strip():
        p_part = f"postura: {posture.strip()}"
    else:
        p_part = "postura: sem_dados"

    return f"📰 Macro/News: {badge} {r_part} | {p_part}{extra}"


# ============================================================
# MACRO/NEWS — linha principal (integrado), com fallback pro legado se ativado
# ============================================================
def get_macro_news_block() -> Tuple[str, List[str], Optional[str]]:
    """
    Retorna:
      (macro_line, bullets, debug_reason)

    Regras:
    - Sem dados/indisponível => 🟡 sem dados
    - Nunca derruba decisão, nunca força WAIT
    """
    # Macro desligado por env
    if DISABLE_MACRO:
        return "📰 Macro/News: 🟡 Macro desativado (DISABLE_MACRO=1)", [], "macro_disabled"

    # Legado, se explicitamente ligado
    if USE_MACRO_DIGEST:
        digest, macro_err = load_macro_digest()
        if QOL_DEBUG and macro_err:
            return "📰 Macro/News: 🟡 sem dados | postura: sem_dados", [], f"digest_err:{macro_err}"
        line = build_macro_news_line_from_digest(digest, macro_err)
        bullets = []
        if isinstance(digest, dict):
            macro = digest.get("macro") if isinstance(digest.get("macro"), dict) else {}
            b = digest.get("bullets", digest.get("highlights", digest.get("notes", macro.get("drivers"))))
            if isinstance(b, list):
                bullets = [str(x).strip() for x in b if str(x).strip()][:6]
        return line, bullets, None if digest else (macro_err or "digest_empty")

    # Integrado (recomendado)
    if get_macro_context is None:
        return "📰 Macro/News: 🟡 sem dados | postura: sem_dados", [], "macro_context_missing"

    try:
        ctx = get_macro_context(BASE_DIR)
        if ctx.macro_score is None:
            line = f"📰 Macro/News: {ctx.badge} sem dados | postura: sem_dados"
        else:
            line = f"📰 Macro/News: {ctx.badge} score={ctx.macro_score}/100 | postura: {ctx.posture}"
        bullets = ctx.highlights[:6] if isinstance(ctx.highlights, list) else []
        dbg = None
        # Se estiver sem dados, guarda motivo no debug
        if QOL_DEBUG and ctx.notes:
            # só para debug na tela, não “polui” a linha
            dbg = " | ".join(ctx.notes[:3])
        return line, bullets, dbg
    except Exception as e:
        return "📰 Macro/News: 🟡 sem dados | postura: sem_dados", [], f"macro_exception:{type(e).__name__}"


# ============================================================
# MVRV (CoinMetrics) — cache diário
# ============================================================
def _load_json_file(path: str) -> Dict:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_json_file(path: str, obj: Dict) -> None:
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _now_epoch() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def macro_state_from_capmvrv(mvrv: Optional[float]) -> str:
    if mvrv is None:
        return "macro n/a"
    if mvrv <= MVRV_FLOOR_MAX:
        return "macro fundo"
    if mvrv >= MVRV_EUPHORIA_MIN:
        return "macro euforia"
    return "macro neutro"


def macro_alerts_from_capmvrv(mvrv: Optional[float]) -> List[str]:
    alerts: List[str] = []
    if mvrv is None:
        return alerts
    if mvrv <= MVRV_FLOOR_MAX:
        alerts.append(f"🌍 Macro Alert: possível zona de FUNDO ({CAP_MVRV_METRIC}={mvrv:.2f} ≤ {MVRV_FLOOR_MAX:.2f})")
    if mvrv >= MVRV_EUPHORIA_MIN:
        alerts.append(f"🌍 Macro Alert: possível zona de EUFORIA ({CAP_MVRV_METRIC}={mvrv:.2f} ≥ {MVRV_EUPHORIA_MIN:.2f})")
    return alerts


def fetch_capmvrv_btc_coinmetrics() -> Optional[float]:
    url = f"{COINMETRICS_BASE.rstrip('/')}/v4/timeseries/asset-metrics"
    params = {"assets": "btc", "metrics": CAP_MVRV_METRIC, "frequency": "1d"}
    try:
        r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        if r.status_code != 200:
            return None
        data = r.json()
        rows = data.get("data")
        if not isinstance(rows, list) or not rows:
            return None
        last = rows[-1]
        if not isinstance(last, dict):
            return None
        v = last.get(CAP_MVRV_METRIC)
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def get_capmvrv_btc_cached() -> Tuple[Optional[float], str, List[str]]:
    cache = _load_json_file(MVRV_CACHE_FILE)
    now = _now_epoch()

    entry = cache.get("btc", {})
    if isinstance(entry, dict):
        ts = int(entry.get("ts", 0) or 0)
        val = entry.get("capmvrv", None)
        if ts > 0 and (now - ts) <= MVRV_CACHE_TTL_SECONDS and val is not None:
            try:
                m = float(val)
                state = macro_state_from_capmvrv(m)
                return m, state, macro_alerts_from_capmvrv(m)
            except Exception:
                pass

    m = fetch_capmvrv_btc_coinmetrics()
    if m is not None:
        cache["btc"] = {"ts": now, "capmvrv": m, "metric": CAP_MVRV_METRIC, "source": "coinmetrics-community"}
        _save_json_file(MVRV_CACHE_FILE, cache)

    state = macro_state_from_capmvrv(m)
    return m, state, macro_alerts_from_capmvrv(m)


# ============================================================
# INDICADORES — RSI / EMA (fechados)
# ============================================================
def ema_from_closes(closes: List[float], period: int) -> Optional[float]:
    if period <= 1 or len(closes) < period:
        return None
    k = 2.0 / (period + 1.0)
    ema = mean(closes[:period])
    for price in closes[period:]:
        ema = (price * k) + (ema * (1.0 - k))
    return ema


def rsi_wilder(closes: List[float], period: int = 14) -> Optional[float]:
    if period <= 1 or len(closes) < period + 1:
        return None

    gains: List[float] = []
    losses: List[float] = []
    for i in range(1, period + 1):
        d = closes[i] - closes[i - 1]
        gains.append(max(0.0, d))
        losses.append(max(0.0, -d))

    avg_gain = mean(gains)
    avg_loss = mean(losses)

    for i in range(period + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        gain = max(0.0, d)
        loss = max(0.0, -d)
        avg_gain = ((avg_gain * (period - 1)) + gain) / period
        avg_loss = ((avg_loss * (period - 1)) + loss) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def fmt_num(x: Optional[float], nd: int = 2) -> str:
    return "n/a" if x is None else f"{x:.{nd}f}"


# ============================================================
# ATR (4H) — fechados
# ============================================================
def atr_wilder_from_ohlc(klines_closed: List[Dict], period: int = 14) -> Optional[float]:
    if period <= 1 or len(klines_closed) < period + 1:
        return None

    trs: List[float] = []
    for i in range(1, len(klines_closed)):
        cur = klines_closed[i]
        prev = klines_closed[i - 1]
        tr = max(
            cur["high"] - cur["low"],
            abs(cur["high"] - prev["close"]),
            abs(cur["low"] - prev["close"]),
        )
        trs.append(tr)

    if len(trs) < period:
        return None

    atr = mean(trs[:period])
    for tr in trs[period:]:
        atr = ((atr * (period - 1)) + tr) / period
    return atr


def atr_label(atr_pct: Optional[float]) -> str:
    if atr_pct is None:
        return "n/a"
    if atr_pct <= ATR_PCT_CALM_MAX:
        return "calmo"
    if atr_pct <= ATR_PCT_NORMAL_MAX:
        return "normal"
    return "nervoso"


# ============================================================
# REGIME DE CICLO
# ============================================================
def cycle_level_and_label(price: float, ema200_4h: Optional[float], ema50_4h: Optional[float]) -> Tuple[str, str, Optional[float]]:
    ref = None
    ref_name = "EMA n/a"
    if ema200_4h is not None:
        ref = ema200_4h
        ref_name = f"EMA{EMA_SLOW_4H}"
    elif ema50_4h is not None:
        ref = ema50_4h
        ref_name = f"EMA{EMA_FAST_4H}"

    if ref is None:
        return "CICLO n/a", ref_name, None

    return ("CICLO DE ALTA" if price >= ref else "CICLO DE BAIXA"), ref_name, ref


def regime_combo_1w_vs_cycle(regime_1w: str, cycle_label: str) -> str:
    if cycle_label == "CICLO DE ALTA":
        c = "ciclo em alta (acima EMA)"
    elif cycle_label == "CICLO DE BAIXA":
        c = "ciclo em baixa (abaixo EMA)"
    else:
        c = "ciclo n/a"
    if regime_1w == "TENDÊNCIA DE ALTA":
        return f"1W alta + {c}"
    if regime_1w == "TENDÊNCIA DE BAIXA":
        return f"1W baixa + {c}"
    return f"1W range/transição + {c}"


# ============================================================
# CONTEXT SCORE (0–100) — informativo
# ============================================================
def context_score(
    price: float,
    ema_ref: Optional[float],
    rsi_4h: Optional[float],
    rsi_1h: Optional[float],
    vol4_ratio: float,
    regime_4h: str,
) -> Tuple[int, str, List[str]]:
    score = 0.0
    breakdown: List[str] = []

    ema_pts = 0.0
    if ema_ref is not None and ema_ref > 0:
        dist_pct = (price - ema_ref) / ema_ref * 100.0
        if dist_pct >= 0.0:
            ema_pts = 30.0
        elif dist_pct <= -10.0:
            ema_pts = 0.0
        else:
            ema_pts = scale(dist_pct, -10.0, 0.0, 0.0, 30.0)
        breakdown.append(f"+{ema_pts:.0f} EMA (dist {dist_pct:+.2f}%)")
    else:
        breakdown.append("+0 EMA n/a")
    score += ema_pts

    rsi4_pts = 0.0
    if rsi_4h is not None:
        rsi4_pts = scale(rsi_4h, 30.0, 70.0, 0.0, 20.0)
        breakdown.append(f"+{rsi4_pts:.0f} RSI4H ({rsi_4h:.1f})")
    else:
        breakdown.append("+0 RSI4H n/a")
    score += rsi4_pts

    vol4_pts = 0.0
    if vol4_ratio > 0:
        vol4_pts = scale(vol4_ratio, 0.10, 1.30, 0.0, 20.0)
        breakdown.append(f"+{vol4_pts:.0f} VOL4 ({vol4_ratio:.2f}x)")
    else:
        breakdown.append("+0 VOL4 n/a")
    score += vol4_pts

    if regime_4h == "TENDÊNCIA DE ALTA":
        r4_pts = 20.0
    elif regime_4h == "RANGE / CONSOLIDAÇÃO":
        r4_pts = 10.0
    else:
        r4_pts = 0.0
    breakdown.append(f"+{r4_pts:.0f} Regime4H")
    score += r4_pts

    rsi1_pts = 0.0
    if rsi_1h is not None:
        rsi1_pts = scale(rsi_1h, 40.0, 60.0, 0.0, 10.0)
        breakdown.append(f"+{rsi1_pts:.0f} RSI1H ({rsi_1h:.1f})")
    else:
        breakdown.append("+0 RSI1H n/a")
    score += rsi1_pts

    score_i = int(clamp(score, 0.0, 100.0))

    if score_i >= 71:
        label = "agressivo"
    elif score_i >= 46:
        label = "neutro"
    elif score_i >= 26:
        label = "defensivo"
    else:
        label = "ultra defensivo"

    return score_i, label, breakdown


# ============================================================
# REGIMES
# ============================================================
def classify_regime_1w(k1w_closed: List[Dict]) -> str:
    trend = slope_regime(k1w_closed, lookback=min(60, len(k1w_closed)))
    return "TENDÊNCIA DE ALTA" if trend == "up" else "TENDÊNCIA DE BAIXA" if trend == "down" else "RANGE / TRANSIÇÃO"


def classify_regime_4h(k4h: List[Dict]) -> str:
    trend = slope_regime(k4h, lookback=50)
    return "TENDÊNCIA DE ALTA" if trend == "up" else "TENDÊNCIA DE BAIXA" if trend == "down" else "RANGE / CONSOLIDAÇÃO"


# ============================================================
# ALERTAS
# ============================================================
def alerts_4h(k4h: List[Dict]) -> Tuple[List[str], Dict]:
    alerts: List[str] = []

    ks4 = closed_series(k4h)
    last = ks4[-1] if ks4 else k4h[-1]

    swing_high, swing_low = pivot_levels(k4h, PIVOT_4H_LOOKBACK)

    _, _, v_ratio = vol_stats_closed(k4h, VOL_WINDOW_4H)
    v_ok_4h = v_ratio >= VOL_MULTIPLIER_4H if v_ratio > 0 else True

    bullish_turn = bool(swing_high and last["close"] > swing_high)
    bearish_turn = bool(swing_low and last["close"] < swing_low)

    if bullish_turn:
        alerts.append(f"4H: virada bullish (vol {v_ratio:.2f}x)" if v_ok_4h else f"4H: virada bullish FRACA (vol {v_ratio:.2f}x)")
    if bearish_turn:
        alerts.append(f"4H: virada bearish (vol {v_ratio:.2f}x)" if v_ok_4h else f"4H: virada bearish FRACA (vol {v_ratio:.2f}x)")

    if swing_high > 0:
        dist = (swing_high - last["close"]) / swing_high
        if 0 <= dist <= PROX_PCT_PIVOT:
            alerts.append(f"4H: perto do swing_high (~{pct(dist):.2f}% abaixo)")
    if swing_low > 0:
        dist = (last["close"] - swing_low) / swing_low
        if 0 <= dist <= PROX_PCT_PIVOT:
            alerts.append(f"4H: perto do swing_low (~{pct(dist):.2f}% acima)")

    dist_swh_pct = 0.0
    if swing_high:
        dist_swh_pct = clamp_pct_nonneg(pct((swing_high - last["close"]) / swing_high))
    dist_swl_pct = 0.0
    if swing_low:
        dist_swl_pct = clamp_pct_nonneg(pct((last["close"] - swing_low) / swing_low))

    info = {
        "swing_high": swing_high,
        "swing_low": swing_low,
        "dist_swh_pct": dist_swh_pct,
        "dist_swl_pct": dist_swl_pct,
        "vol4_ratio": v_ratio,
        "vol4_ok": v_ok_4h,
        "signal_4h_bullish_turn": bullish_turn,
        "signal_4h_bearish_turn": bearish_turn,
        "signal_4h_bullish_turn_strong": bullish_turn and v_ok_4h,
        "signal_4h_bearish_turn_strong": bearish_turn and v_ok_4h,
    }
    return alerts, info


def alerts_1h(k1h: List[Dict], k4h: List[Dict], piv_4h: Dict) -> Tuple[List[str], Dict]:
    alerts: List[str] = []

    ks1 = closed_series(k1h)
    if len(ks1) < 3:
        return [], {"hi4": 0.0, "lo4": 0.0, "hi1": 0.0, "lo1": 0.0}

    last = ks1[-1]
    prev = ks1[-2]

    k4h_closed = closed_series(k4h)
    hi4, lo4 = hi_lo(k4h_closed, RANGE_4H_LOOKBACK)

    hi1, lo1 = hi_lo(ks1[:-1], HIGHLOW_1H_LOOKBACK)

    v_ok_prev = volume_ok_prev_1h(k1h)
    _, _, v1_ratio = vol_stats_closed(k1h, VOL_WINDOW_1H)
    v_ok_last = v1_ratio >= VOL_MULTIPLIER_1H if v1_ratio > 0 else True

    broke_hi4 = prev["close"] > hi4
    broke_lo4 = prev["close"] < lo4
    broke_hi1 = prev["close"] > hi1
    broke_lo1 = prev["close"] < lo1

    if broke_hi4:
        alerts.append("1H: breakout acima do topo do range 4H (vol ok)" if v_ok_prev else "1H: breakout FRACO acima do topo do range 4H (vol baixo)")
    if broke_lo4:
        alerts.append("1H: breakdown abaixo do fundo do range 4H (vol ok)" if v_ok_prev else "1H: breakdown FRACO abaixo do fundo do range 4H (vol baixo)")

    if broke_hi1:
        alerts.append("1H: rompeu máxima recente do 1H (vol ok)" if v_ok_prev else "1H: rompeu máxima recente do 1H (vol baixo)")
    if broke_lo1:
        alerts.append("1H: rompeu mínima recente do 1H (vol ok)" if v_ok_prev else "1H: rompeu mínima recente do 1H (vol baixo)")

    fakeout_range = (broke_hi4 and last["close"] <= hi4) or (broke_lo4 and last["close"] >= lo4)
    if fakeout_range:
        alerts.append("1H: possível fakeout no range 4H")

    ref_close = last["close"]
    range_w = (hi4 - lo4) if (hi4 > 0 and lo4 > 0 and hi4 > lo4) else 0.0

    pos_frac_raw = safe_div((ref_close - lo4), range_w) if range_w else 0.0
    pos_frac = clamp(pos_frac_raw, 0.0, 1.0) if range_w else 0.0
    pos_range_pct = clamp_range_pos_pct(pct(pos_frac)) if range_w else 0.0

    dist_bot_range_clamped = pos_frac
    dist_top_range_clamped = clamp(1.0 - pos_frac, 0.0, 1.0)

    if range_w > 0:
        if 0 <= dist_top_range_clamped <= RANGE_EDGE_PCT:
            alerts.append(f"1H: perto do topo do range 4H (~{pct(dist_top_range_clamped):.2f}% da largura)")
        if 0 <= dist_bot_range_clamped <= RANGE_EDGE_PCT:
            alerts.append(f"1H: perto do fundo do range 4H (~{pct(dist_bot_range_clamped):.2f}% da largura)")

    swl = float(piv_4h.get("swing_low", 0.0))
    spring_reclaim = spring_reclaim_1h(k1h, swl)
    if spring_reclaim:
        alerts.append(f"1H: spring/reclaim acima do swing_low 4H (vol {v1_ratio:.2f}x)" if v_ok_last else f"1H: spring/reclaim FRACO (vol {v1_ratio:.2f}x)")

    dist_top4_pct = 0.0
    if hi4:
        dist_top4_pct = clamp_pct_nonneg(pct((hi4 - ref_close) / hi4))
    dist_bot4_pct = 0.0
    if lo4:
        dist_bot4_pct = clamp_pct_nonneg(pct((ref_close - lo4) / lo4))

    info = {
        "hi4": hi4,
        "lo4": lo4,
        "hi1": hi1,
        "lo1": lo1,
        "dist_top4_pct": dist_top4_pct,
        "dist_bot4_pct": dist_bot4_pct,
        "pos_range4h_pct": pos_range_pct,
        "dist_top4_range_pct": clamp_range_pos_pct(pct(dist_top_range_clamped)) if range_w else 0.0,
        "dist_bot4_range_pct": clamp_range_pos_pct(pct(dist_bot_range_clamped)) if range_w else 0.0,
        "vol1_ratio": v1_ratio,
        "vol1_ok_last": v_ok_last,
        "vol1_ok_prev": v_ok_prev,
        "signal_1h_breakout_range4h": broke_hi4,
        "signal_1h_breakdown_range4h": broke_lo4,
        "signal_1h_breakout_recent_high": broke_hi1,
        "signal_1h_breakdown_recent_low": broke_lo1,
        "signal_1h_spring_reclaim": spring_reclaim,
        "signal_1h_fakeout_range4h": fakeout_range,
        "signal_1h_bullish_trigger_strong": ((broke_hi4 or broke_hi1) and v_ok_prev) or (spring_reclaim and v_ok_last),
    }
    return alerts, info


# ============================================================
# DECISÃO (NÃO ALTERAR)
# ============================================================
def decide_stage(
    regime_1w: str,
    regime_4h: str,
    a1h: List[str],
    a4h: List[str],
    lvl: Optional[Dict] = None,
    piv: Optional[Dict] = None,
    market_ctx: Optional[Dict] = None,
) -> str:
    # Preferência por sinais estruturados (mais robusto que parsing de texto).
    bullish_1h = bool((lvl or {}).get("signal_1h_bullish_trigger_strong", False))
    fakeout_1h = bool((lvl or {}).get("signal_1h_fakeout_range4h", False))
    bullish_4h_turn = bool((piv or {}).get("signal_4h_bullish_turn_strong", False))
    bearish_4h_turn = bool((piv or {}).get("signal_4h_bearish_turn_strong", False))
    continuation_ok = bool((market_ctx or {}).get("continuation_ok", False))
    continuation_override_ok = bool((market_ctx or {}).get("continuation_override_ok", False))
    continuation_signal_ok = continuation_ok or continuation_override_ok

    # Fallback legado (se sinais estruturados não estiverem disponíveis).
    if not lvl:
        bullish_1h = any(
            (("breakout" in x) or ("rompeu" in x) or ("spring/reclaim" in x))
            and ("FRACO" not in x) and ("vol baixo" not in x)
            for x in (a1h or [])
        )
        fakeout_1h = any("fakeout" in x for x in (a1h or []))
    if not piv:
        bullish_4h_turn = any("virada bullish" in x and "FRACA" not in x for x in (a4h or []))
        bearish_4h_turn = any("virada bearish" in x and "FRACA" not in x for x in (a4h or []))

    if regime_1w == "TENDÊNCIA DE ALTA":
        if bearish_4h_turn:
            return "WAIT"

        if regime_4h != "TENDÊNCIA DE BAIXA" and (bullish_4h_turn or regime_4h == "TENDÊNCIA DE ALTA"):
            return "FULL"

        if bullish_4h_turn:
            return "MEDIUM"

        if bullish_1h and not fakeout_1h:
            return "SMALL"

        # Modo continuação: captura tendência forte de 24h mesmo sem gatilho clássico.
        if continuation_signal_ok and not fakeout_1h:
            return "SMALL"

        return "WAIT"

    if bullish_1h and not fakeout_1h:
        return "SMALL"
    return "WAIT"


# ============================================================
# PRÓXIMOS GATILHOS — CONTEXTUAL + VOLUME + QoL + DEBUG + COUNTDOWN (híbrido)
# ============================================================
def vol_gap_str(current: float, minimum: float) -> str:
    if current <= 0:
        return f"min {minimum:.2f}x"
    gap = max(0.0, minimum - current)
    if gap <= 0:
        return f"vol {current:.2f}x (min {minimum:.2f}x, ok)"
    return f"vol {current:.2f}x (min {minimum:.2f}x, falta +{gap:.2f}x)"


def next_triggers_contextual(
    regime_1w: str,
    regime_4h: str,
    lvl: Dict,
    piv: Dict,
    close_times_ms: Optional[Dict[str, int]] = None,
) -> List[str]:
    near_pivot_pct = PROX_PCT_PIVOT * 100.0
    near_edge_pct = RANGE_EDGE_PCT * 100.0
    edge_eff_pct = near_edge_pct + max(0.0, float(EDGE_EPS_PCT))

    dist_swl = float(piv.get("dist_swl_pct", 999.0))
    dist_swh = float(piv.get("dist_swh_pct", 999.0))

    dist_top_range = float(lvl.get("dist_top4_range_pct", 999.0))
    dist_bot_range = float(lvl.get("dist_bot4_range_pct", 999.0))
    pos_range = float(lvl.get("pos_range4h_pct", 0.0))

    near_swl = dist_swl <= near_pivot_pct
    near_swh = dist_swh <= near_pivot_pct
    near_top = dist_top_range <= edge_eff_pct
    near_bottom = dist_bot_range <= edge_eff_pct

    in_middle = (35.0 <= dist_top_range <= 65.0) and (35.0 <= dist_bot_range <= 65.0)
    far_from_swl = dist_swl >= (near_pivot_pct * 2.0)

    v1 = float(lvl.get("vol1_ratio", 0.0))
    v4 = float(piv.get("vol4_ratio", 0.0))

    v1s = vol_gap_str(v1, VOL_MULTIPLIER_1H)
    v4s = vol_gap_str(v4, VOL_MULTIPLIER_4H)

    v1_ok = (v1 <= 0) or (v1 >= VOL_MULTIPLIER_1H)
    v4_ok = (v4 <= 0) or (v4 >= VOL_MULTIPLIER_4H)
    vol_ok = v1_ok and v4_ok

    candidates: List[Tuple[int, str]] = []

    if isinstance(close_times_ms, dict) and close_times_ms:
        try:
            candidates.append((0, closes_triggers_short_line(close_times_ms)))
        except Exception:
            pass

    candidates.append((0, f"📦 Condição de Volume p/ Gatilhos: 1H → {v1s} | 4H → {v4s}"))

    dominant_added = False
    if not vol_ok:
        dominant_added = True
        if (not v1_ok) and (not v4_ok):
            candidates.append((0, f"🧱 Gargalo dominante: VOLUME 1H + 4H abaixo do mínimo → 1H→{v1s} | 4H→{v4s}"))
        elif not v4_ok:
            candidates.append((0, f"🧱 Gargalo dominante: VOLUME 4H abaixo do mínimo → {v4s}"))
        else:
            candidates.append((0, f"🧱 Gargalo dominante: VOLUME 1H abaixo do mínimo → {v1s}"))

        if (not v4_ok) and isinstance(close_times_ms, dict) and close_times_ms.get("4H"):
            try:
                nm = now_ms_utc()
                close4 = int(close_times_ms["4H"])
                secs4 = max(0, int((close4 - nm) / 1000))
                candidates.append((0, f"⏳ Este gargalo só pode mudar no fechamento 4H: em {fmt_countdown(secs4)} — {fmt_ts(close4)}"))
            except Exception:
                pass

    if QOL_DEBUG:
        dbg = {
            "near_swl": near_swl,
            "near_swh": near_swh,
            "near_top": near_top,
            "near_bottom": near_bottom,
            "dist_swl_pct": round(dist_swl, 2),
            "dist_swh_pct": round(dist_swh, 2),
            "dist_top_range_pct": round(dist_top_range, 2),
            "dist_bot_range_pct": round(dist_bot_range, 2),
            "pos_range4h_pct": round(pos_range, 2),
            "v1_ratio": round(v1, 2),
            "v4_ratio": round(v4, 2),
            "v1_ok": v1_ok,
            "v4_ok": v4_ok,
            "edge_pct": round(near_edge_pct, 2),
            "edge_eps_pct": round(float(EDGE_EPS_PCT), 2),
            "edge_eff_pct": round(edge_eff_pct, 2),
            "pivot_pct": round(near_pivot_pct, 2),
        }
        candidates.append((0, "🧪 DEBUG(QoL): " + json.dumps(dbg, ensure_ascii=False)))

    if (near_swl or near_bottom):
        where = []
        if near_swl:
            where.append("perto do swing_low")
        if near_bottom:
            where.append("perto do fundo do range")
        if vol_ok:
            candidates.append((1, f"📌 Favorável a spring: {' + '.join(where)} | pos={pos_range:.2f}% | vol ok (1H/4H)."))
        else:
            candidates.append((1, f"📌 Favorável a spring (BLOQUEADO por volume): {' + '.join(where)} | pos={pos_range:.2f}% | 1H→{v1s} | 4H→{v4s}"))

    if (near_swh or near_top):
        where = []
        if near_swh:
            where.append("perto do swing_high")
        if near_top:
            where.append("perto do topo do range")
        if vol_ok:
            candidates.append((1, f"📌 Favorável a breakout: {' + '.join(where)} | pos={pos_range:.2f}% | vol ok (1H/4H)."))
        else:
            candidates.append((1, f"📌 Favorável a breakout (BLOQUEADO por volume): {' + '.join(where)} | pos={pos_range:.2f}% | 1H→{v1s} | 4H→{v4s}"))

    if regime_1w == "TENDÊNCIA DE ALTA":
        spring_pri = 1 if (near_swl or near_bottom) else 4
        candidates.append((spring_pri, "1H: spring/reclaim acima do swing_low 4H (precisa vol ok)"))

        breakout_pri = 1 if near_top else 4
        candidates.append((breakout_pri, "1H: breakout acima do topo do range 4H (sem fakeout, precisa vol ok)"))

        if in_middle and far_from_swl and (not near_top) and (not near_bottom):
            rompeu_pri = 2
        else:
            rompeu_pri = 3 if (dist_top_range < dist_bot_range) else 4
        candidates.append((rompeu_pri, "1H: rompeu máxima recente do 1H (sem fakeout, precisa vol ok)"))

        turn_pri = 2 if near_swh else 5
        candidates.append((turn_pri, "4H: virada bullish (close acima do swing_high, precisa vol ok)"))

        if not dominant_added:
            if v1 > 0 and v1 < VOL_MULTIPLIER_1H:
                candidates.append((8, f"📌 Gargalo: volume 1H abaixo do mínimo → {v1s}"))
            if v4 > 0 and v4 < VOL_MULTIPLIER_4H:
                candidates.append((8, f"📌 Gargalo: volume 4H abaixo do mínimo → {v4s}"))

        if regime_4h == "TENDÊNCIA DE BAIXA":
            candidates.append((9, "⚠️ Nota: 4H está em baixa — entradas só com gatilho 1H confirmado por volume."))
    else:
        candidates.append((1, "1H: rompimento (máxima recente / breakout, precisa vol ok)"))
        candidates.append((5, "Ideal: 1W virar TENDÊNCIA DE ALTA para aumentar convicção."))

    candidates.sort(key=lambda x: x[0])
    out: List[str] = []
    seen = set()
    for _, txt in candidates:
        if txt not in seen:
            out.append(txt)
            seen.add(txt)
    return out


# ============================================================
# MENSAGEM PRONTA — inclui MACRO/NEWS + MACRO(BTC) + RR + AVISO VOL4
# ============================================================
def build_ready_message(
    symbol: str,
    price: float,
    regime_1w: str,
    regime_4h: str,
    cycle_label: str,
    cycle_ref_name: str,
    cycle_ref_val: Optional[float],
    capmvrv_btc: Optional[float],
    macro_state: str,
    macro_alerts: List[str],
    macro_news_line: str,
    macro_bullets: List[str],
    rr_adj: Optional[float],
    rr_atr: Optional[float],
    rr_label_adj: str,
    rr_label_atr: str,
    context_score_val: int,
    context_label: str,
    lvl: Dict,
    piv: Dict,
    a1h: List[str],
    a4h: List[str],
    stage: str,
    vol4_ratio: float,
    close4_ms: Optional[int],
) -> str:
    alloc = stage_to_allocation(symbol, stage)
    lines: List[str] = []
    lines.append(f"🚨 {symbol} | Preço: {price:.2f}")
    lines.append(f"📊 Regimes: 1W={regime_1w} | 4H={regime_4h}")

    if cycle_ref_val is not None:
        lines.append(f"🌀 Ciclo: {cycle_label} ({'acima' if price >= cycle_ref_val else 'abaixo'} {cycle_ref_name})")
    else:
        lines.append("🌀 Ciclo: CICLO n/a")

    if capmvrv_btc is None:
        lines.append(f"🌍 Macro (BTC): {CAP_MVRV_METRIC}=n/a ({macro_state})")
    else:
        lines.append(f"🌍 Macro (BTC): {CAP_MVRV_METRIC}={capmvrv_btc:.2f} ({macro_state})")
    if macro_alerts:
        for ma in macro_alerts:
            lines.append(f"   • {ma}")

    if macro_news_line:
        lines.append(macro_news_line)

    if macro_bullets:
        lines.append("🗞️ Headlines (resumo):")
        for b in macro_bullets[:4]:
            lines.append(f"   • {b}")

    if rr_adj is not None:
        rr_line = f"📐 RR: adj={rr_adj:.2f} ({rr_label_adj})"
        if rr_atr is not None:
            rr_line += f" | RR_ATR={rr_atr:.2f} ({rr_label_atr})"
        lines.append(rr_line)

    lines.append(f"🧠 Context Score: {context_score_val}/100 ({context_label})")

    warn = vol4_soft_warning_line(stage, vol4_ratio, close4_ms)
    if warn:
        lines.append(warn)

    lines.append("📍 Níveis:")
    lines.append(f"   • Range 4H: topo={lvl['hi4']:.2f} | fundo={lvl['lo4']:.2f} | posRange4H={lvl.get('pos_range4h_pct',0.0):.2f}%")
    lines.append(f"   • High/Low 1H: topo={lvl['hi1']:.2f} | fundo={lvl['lo1']:.2f}")
    lines.append(f"   • Pivôs 4H ({PIVOT_4H_LOOKBACK}): swing_high={piv['swing_high']:.2f} | swing_low={piv['swing_low']:.2f}")

    lines.append("📦 Volume (ratios, fechados):")
    lines.append(f"   • 1H vol: {lvl.get('vol1_ratio', 0.0):.2f}x (mín {VOL_MULTIPLIER_1H:.2f}x)")
    lines.append(f"   • 4H vol: {piv.get('vol4_ratio', 0.0):.2f}x (mín {VOL_MULTIPLIER_4H:.2f}x)")

    if a4h:
        lines.append("🧭 Alertas 4H:")
        for x in a4h:
            lines.append(f"   • {x}")
    if a1h:
        lines.append("⚡ Alertas 1H:")
        for x in a1h:
            lines.append(f"   • {x}")

    if stage == "SMALL":
        lines.append(f"✅ Ação: ENTRADA PEQUENA (~{alloc:.1f}% do capital).")
    elif stage == "MEDIUM":
        lines.append(f"✅ Ação: ESCALAR (MÉDIA) (~{alloc:.1f}% do capital).")
    elif stage == "FULL":
        lines.append(f"✅ Ação: ESCALAR (CHEIA) (~{alloc:.1f}% do capital).")
    else:
        lines.append("✅ Ação: ESPERAR.")

    return "\n".join(lines)


# ============================================================
# DEDUP STATE
# ============================================================
def load_state() -> Dict:
    if not os.path.exists(ALERT_STATE_FILE):
        return {}
    try:
        with open(ALERT_STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(state: Dict) -> None:
    try:
        with open(ALERT_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


# ============================================================
# HISTÓRICO POR ATIVO (JSONL)
# ============================================================
def ensure_log_dir() -> None:
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR, exist_ok=True)


def append_symbol_log(symbol: str, record: Dict) -> None:
    if not ENABLE_HISTORY_LOG:
        return
    try:
        ensure_log_dir()
        path = os.path.join(LOG_DIR, f"{symbol}.jsonl")
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        pass


def append_trade_history(record: Dict) -> None:
    """
    Histórico operacional de sinais (compra/venda) para dashboard.
    """
    try:
        hist_dir = os.path.dirname(TRADE_HISTORY_FILE)
        if hist_dir:
            os.makedirs(hist_dir, exist_ok=True)
        with open(TRADE_HISTORY_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _stage_rank(stage: str) -> int:
    s = (stage or "").upper()
    if s == "SMALL":
        return 1
    if s == "MEDIUM":
        return 2
    if s == "FULL":
        return 3
    return 0


def _track_trade_history(
    symbol: str,
    ts_utc: str,
    stage: str,
    price: float,
    rr_up_pct: Optional[float],
    rr_adj: Optional[float],
    rr_atr: Optional[float],
    target_price: Optional[float],
) -> None:
    state = load_state()
    positions = state.get("__positions__", {})
    if not isinstance(positions, dict):
        positions = {}

    current_pos = positions.get(symbol)

    if stage in ACTIVE_STAGES:
        # Entrada inicial
        if not isinstance(current_pos, dict):
            positions[symbol] = {
                "entry_ts": ts_utc,
                "entry_price": price,
                "stage": stage,
            }
            append_trade_history(
                {
                    "ts_utc": ts_utc,
                    "symbol": symbol,
                    "side": "BUY",
                    "signal_type": "ENTRY",
                    "stage": stage,
                    "entry_price": price,
                    "current_price": price,
                    "target_price": target_price,
                    "expected_profit_pct": rr_up_pct,
                    "rr_adj": rr_adj,
                    "rr_atr": rr_atr,
                }
            )
        else:
            prev_stage = str(current_pos.get("stage", "WAIT"))
            # Escalonamento de posição (SMALL -> MEDIUM -> FULL)
            if _stage_rank(stage) > _stage_rank(prev_stage):
                entry_price = float(current_pos.get("entry_price", price) or price)
                expected_profit_pct = None
                if target_price is not None and entry_price > 0:
                    expected_profit_pct = pct((target_price - entry_price) / entry_price)

                append_trade_history(
                    {
                        "ts_utc": ts_utc,
                        "symbol": symbol,
                        "side": "BUY",
                        "signal_type": "SCALE_IN",
                        "stage": stage,
                        "entry_price": entry_price,
                        "current_price": price,
                        "target_price": target_price,
                        "expected_profit_pct": expected_profit_pct if expected_profit_pct is not None else rr_up_pct,
                        "rr_adj": rr_adj,
                        "rr_atr": rr_atr,
                    }
                )
            current_pos["stage"] = stage
            current_pos["last_price"] = price
            current_pos["last_ts"] = ts_utc
            positions[symbol] = current_pos
    else:
        # Saída quando volta para WAIT
        if isinstance(current_pos, dict):
            entry_price = float(current_pos.get("entry_price", price) or price)
            pnl_pct = pct((price - entry_price) / entry_price) if entry_price > 0 else None
            append_trade_history(
                {
                    "ts_utc": ts_utc,
                    "symbol": symbol,
                    "side": "SELL",
                    "signal_type": "EXIT",
                    "stage": stage,
                    "entry_price": entry_price,
                    "exit_price": price,
                    "realized_profit_pct": pnl_pct,
                }
            )
            positions.pop(symbol, None)

    state["__positions__"] = positions
    save_state(state)


# ============================================================
# OUTPUT
# ============================================================
def summarize(symbol: str) -> None:
    price = get_price(symbol)

    k1h = [kline_to_ohlcv(k) for k in get_klines(symbol, "1h", limit=KLINES_LIMIT_1H)]
    k4h = [kline_to_ohlcv(k) for k in get_klines(symbol, "4h", limit=KLINES_LIMIT_4H)]
    k1w = [kline_to_ohlcv(k) for k in get_klines(symbol, "1w", limit=KLINES_LIMIT_1W)]

    dq_score, dq_issues, dq_detail = data_quality_assessment(k1h, k4h, k1w)

    last_1h_raw = k1h[-1]
    last_4h_raw = k4h[-1]

    last_1w_forming = k1w[-1]
    last_1w_closed = k1w[-2] if len(k1w) >= 2 else k1w[-1]
    k1w_closed = k1w[:-1] if len(k1w) > 1 else k1w

    close_times_ms = {
        "1H": int(last_1h_raw.get("close_time", 0) or 0),
        "4H": int(last_4h_raw.get("close_time", 0) or 0),
        "1W": int(last_1w_forming.get("close_time", 0) or 0),
    }

    regime_1w = classify_regime_1w(k1w_closed)
    regime_4h = classify_regime_4h(k4h)

    k1h_closed = closed_series(k1h)
    k4h_closed = closed_series(k4h)

    c1h = [c["close"] for c in k1h_closed]
    c4h = [c["close"] for c in k4h_closed]

    rsi_1h = rsi_wilder(c1h, RSI_PERIOD)
    rsi_4h = rsi_wilder(c4h, RSI_PERIOD)

    ema50_4h = ema_from_closes(c4h, EMA_FAST_4H)
    ema200_4h = ema_from_closes(c4h, EMA_SLOW_4H)

    atr_4h = atr_wilder_from_ohlc(k4h_closed, ATR_PERIOD)
    atr_pct = (pct(atr_4h / price) if (atr_4h is not None and price > 0) else None)
    atr_state = atr_label(atr_pct)

    a4h, piv = alerts_4h(k4h)
    a1h, lvl = alerts_1h(k1h, k4h, piv)

    hi4_val = float(lvl.get("hi4", 0.0))
    lo4_val = float(lvl.get("lo4", 0.0))
    rr_up, rr_dn, rr_dn_eff, rr_raw, rr_adj, rr_adj_label = rr_range_4h_metrics(
        price=price,
        hi4=hi4_val,
        lo4=lo4_val,
        downside_floor_pct=RR_DOWNSIDE_FLOOR_PCT,
    )
    rr_risk_pct, rr_atr, rr_atr_label = rr_atr_metrics(
        upside_pct=rr_up,
        atr_pct=atr_pct,
        atr_risk_mult=RR_ATR_RISK_MULT,
    )

    change_24h_pct = pct_change_lookback(c1h, bars_back=24)
    vol1_ratio = float(lvl.get("vol1_ratio", 0.0) or 0.0)
    above_ema50 = bool(ema50_4h is not None and price >= float(ema50_4h))
    cont_price_ok = (not CONT_REQUIRE_ABOVE_EMA50) or above_ema50
    cont_rr_ok = (rr_atr is not None and rr_atr >= CONT_MIN_RR_ATR)
    cont_strong_chg_ok = (change_24h_pct is not None and change_24h_pct >= CONT_STRONG_MIN_24H_PCT)
    cont_strong_rr_ok = (rr_atr is not None and rr_atr >= CONT_STRONG_MIN_RR_ATR)
    cont_strong_vol_exception = (vol1_ratio > 0 and vol1_ratio < CONT_MIN_VOL1_RATIO)
    continuation_ok = bool(
        ENABLE_CONTINUATION_MODE
        and regime_1w == "TENDÊNCIA DE ALTA"
        and change_24h_pct is not None
        and change_24h_pct >= CONT_MIN_24H_PCT
        and vol1_ratio >= CONT_MIN_VOL1_RATIO
        and cont_price_ok
        and cont_rr_ok
    )
    continuation_override_ok = bool(
        ENABLE_CONTINUATION_MODE
        and regime_1w == "TENDÊNCIA DE ALTA"
        and cont_price_ok
        and cont_strong_chg_ok
        and cont_strong_rr_ok
        and cont_strong_vol_exception
    )
    market_ctx = {
        "continuation_ok": continuation_ok,
        "continuation_override_ok": continuation_override_ok,
        "change_24h_pct": change_24h_pct,
        "vol1_ratio": vol1_ratio,
        "cont_rr_ok": cont_rr_ok,
        "cont_strong_chg_ok": cont_strong_chg_ok,
        "cont_strong_rr_ok": cont_strong_rr_ok,
        "cont_strong_vol_exception": cont_strong_vol_exception,
        "cont_price_ok": cont_price_ok,
        "continuation_mode_enabled": ENABLE_CONTINUATION_MODE,
    }

    stage = decide_stage(regime_1w, regime_4h, a1h, a4h, lvl=lvl, piv=piv, market_ctx=market_ctx)
    stage_before_guards = stage

    risk_trade_capital_pct = risk_capital_pct_from_stage(symbol, stage, rr_dn_eff)
    risk_portfolio_existing_pct = portfolio_risk_capital_pct(exclude_symbol=symbol)
    risk_portfolio_projected_pct = risk_portfolio_existing_pct + risk_trade_capital_pct
    risk_guard_issues: List[str] = []

    if stage in ACTIVE_STAGES:
        if dq_score < MIN_DATA_QUALITY_SCORE:
            risk_guard_issues.append(
                f"Data quality baixa ({dq_score}/100 < {MIN_DATA_QUALITY_SCORE})"
            )
        if risk_trade_capital_pct > MAX_RISK_PER_TRADE_CAPITAL_PCT:
            risk_guard_issues.append(
                f"Risco/trade {risk_trade_capital_pct:.2f}% > limite {MAX_RISK_PER_TRADE_CAPITAL_PCT:.2f}%"
            )
        if risk_portfolio_projected_pct > MAX_PORTFOLIO_RISK_CAPITAL_PCT:
            risk_guard_issues.append(
                f"Risco carteira proj. {risk_portfolio_projected_pct:.2f}% > limite {MAX_PORTFOLIO_RISK_CAPITAL_PCT:.2f}%"
            )

    if risk_guard_issues:
        stage = "WAIT"
    alloc = allocation_levels(symbol)
    target_price = float(lvl.get("hi4", 0.0)) if float(lvl.get("hi4", 0.0) or 0.0) > 0 else None

    cycle_label, cycle_ref_name, cycle_ref_val = cycle_level_and_label(price, ema200_4h, ema50_4h)
    combo_txt = regime_combo_1w_vs_cycle(regime_1w, cycle_label)

    score_val, score_label, score_breakdown = context_score(
        price=price,
        ema_ref=cycle_ref_val,
        rsi_4h=rsi_4h,
        rsi_1h=rsi_1h,
        vol4_ratio=float(piv.get("vol4_ratio", 0.0)),
        regime_4h=regime_4h,
    )

    capmvrv_btc, macro_state, macro_alerts = get_capmvrv_btc_cached()

    # ✅ Macro/News integrado (ou legado se USE_MACRO_DIGEST=1)
    macro_news_line, macro_bullets, macro_dbg = get_macro_news_block()
    if QOL_DEBUG and macro_dbg:
        print(f"🧪 DEBUG(MACRO): {macro_dbg}")
    if QOL_DEBUG:
        chg = "n/a" if change_24h_pct is None else f"{change_24h_pct:.2f}%"
        print(
            "🧪 DEBUG(CONT): "
            f"enabled={ENABLE_CONTINUATION_MODE} chg24h={chg} "
            f"vol1={vol1_ratio:.2f} (min {CONT_MIN_VOL1_RATIO:.2f}) "
            f"rr_atr={fmt_num(rr_atr,2)} (min {CONT_MIN_RR_ATR:.2f}) "
            f"ema50_ok={cont_price_ok} -> continuation_ok={continuation_ok} "
            f"override_ok={continuation_override_ok}"
        )

    reasons: List[str] = []
    conflict = (regime_1w == "TENDÊNCIA DE ALTA" and regime_4h == "TENDÊNCIA DE BAIXA")
    if conflict:
        reasons.append("Conflito: 1W alta x 4H baixa")

    has_trigger_1h = any(
        ("breakout" in x) or ("breakdown" in x) or ("rompeu" in x) or ("spring/reclaim" in x)
        for x in (a1h or [])
    )
    if stage == "WAIT" and not has_trigger_1h:
        reasons.append("Sem gatilho 1H")

    v1_ratio = float(lvl.get("vol1_ratio", 0.0))
    v4_ratio = float(piv.get("vol4_ratio", 0.0))
    if stage == "WAIT":
        if v1_ratio > 0 and v1_ratio < VOL_MULTIPLIER_1H:
            reasons.append(f"Volume 1H baixo ({v1_ratio:.2f}x < {VOL_MULTIPLIER_1H:.2f}x)")
        if v4_ratio > 0 and v4_ratio < VOL_MULTIPLIER_4H:
            reasons.append(f"Volume 4H baixo ({v4_ratio:.2f}x < {VOL_MULTIPLIER_4H:.2f}x)")

    if stage == "WAIT" and not a1h and not a4h:
        reasons.append("Sem alertas")

    if stage == "WAIT" and not reasons:
        reasons.append("Sem condições de gatilho")

    for gi in risk_guard_issues:
        reasons.append(f"Guardrail: {gi}")

    reason_txt = " | ".join(reasons) if reasons else "-"

    _track_trade_history(
        symbol=symbol,
        ts_utc=utc_now_iso(),
        stage=stage,
        price=price,
        rr_up_pct=rr_up,
        rr_adj=rr_adj,
        rr_atr=rr_atr,
        target_price=target_price,
    )

    context_bits: List[str] = []
    if cycle_ref_val is not None:
        context_bits.append(f"{'acima' if price >= cycle_ref_val else 'abaixo'} {cycle_ref_name}")
    else:
        context_bits.append("EMA n/a")

    if rsi_4h is None:
        context_bits.append("RSI4H n/a")
    elif rsi_4h < 40:
        context_bits.append("RSI4H baixo")
    elif rsi_4h > 60:
        context_bits.append("RSI4H alto")
    else:
        context_bits.append("RSI4H neutro")

    context_bits.append(f"Score {score_val}/100 {score_label}")

    if atr_pct is None:
        context_bits.append("ATR4H n/a")
    else:
        context_bits.append(f"ATR {atr_state} ({atr_pct:.2f}%)")

    if rr_adj is not None:
        context_bits.append(f"RR_adj {rr_adj:.2f} ({rr_adj_label})")
    else:
        context_bits.append("RR_adj n/a")

    if rr_atr is not None:
        context_bits.append(f"RR_ATR {rr_atr:.2f} ({rr_atr_label})")
    else:
        context_bits.append("RR_ATR n/a")

    if capmvrv_btc is None:
        context_bits.append(f"{CAP_MVRV_METRIC}(BTC) n/a")
    else:
        context_bits.append(f"{CAP_MVRV_METRIC}(BTC) {capmvrv_btc:.2f} ({macro_state})")

    context_txt = " | ".join(context_bits)

    print("=" * 100)
    print(f"{symbol} | Preço: {price:.2f}")
    print(f"1H: {last_1h_raw['close']:.2f} | {fmt_ts(last_1h_raw['close_time'])}")
    print(f"4H: {last_4h_raw['close']:.2f} | {fmt_ts(last_4h_raw['close_time'])}")
    print(f"1W fechado: {last_1w_closed['close']:.2f} | {fmt_ts(last_1w_closed['close_time'])}")
    print(f"1W formando: {last_1w_forming['close']:.2f} | {fmt_ts(last_1w_forming['close_time'])}")
    print(closes_panel_line(close_times_ms))
    print("-" * 100)
    print(f"Regime 1W: {regime_1w}")
    print(f"Regime 4H: {regime_4h}")
    print("-" * 100)

    print(f"RSI({RSI_PERIOD}) (fechado): 1H={fmt_num(rsi_1h, 1)} | 4H={fmt_num(rsi_4h, 1)}")
    s50 = "n/a" if ema50_4h is None else f"{ema50_4h:.2f} ({pct((price - ema50_4h) / ema50_4h):+.2f}%)"
    s200 = "n/a" if ema200_4h is None else f"{ema200_4h:.2f} ({pct((price - ema200_4h) / ema200_4h):+.2f}%)"
    print(f"EMAs 4H (fechado): EMA{EMA_FAST_4H}={s50} | EMA{EMA_SLOW_4H}={s200}")

    if cycle_ref_val is not None:
        rel = "acima" if price >= cycle_ref_val else "abaixo"
        print(f"Ciclo de Mercado (4H): {cycle_label} — preço {rel} {cycle_ref_name} ({cycle_ref_val:.2f})")
    else:
        print("Ciclo de Mercado (4H): CICLO n/a (sem EMA suficiente)")
    print(f"Leitura 1W vs Ciclo: {combo_txt}")

    if capmvrv_btc is None:
        print(f"{CAP_MVRV_METRIC} (macro/BTC via CoinMetrics): n/a ({macro_state})")
    else:
        print(f"{CAP_MVRV_METRIC} (macro/BTC via CoinMetrics): {capmvrv_btc:.2f} ({macro_state})")
    if macro_alerts:
        print("🌍 Alertas Macro:")
        for ma in macro_alerts:
            print(f" - {ma}")

    if atr_4h is None or atr_pct is None:
        print(f"ATR({ATR_PERIOD}) 4H (fechado): n/a")
    else:
        print(f"ATR({ATR_PERIOD}) 4H (fechado): {atr_4h:.2f} | ATR%={atr_pct:.2f}% | Volatilidade: {atr_state}")

    # ✅ QoL RR: clamp do downside só na exibição (e nota quando ticker está fora do range)
    if rr_adj is None or rr_up is None or rr_dn is None:
        print("RR (Range 4H): n/a")
    else:
        rr_raw_str = "n/a" if rr_raw is None else f"{rr_raw:.2f}"
        dn_display = max(0.0, float(rr_dn))
        note_rr = ""
        if rr_dn < 0:
            note_rr = " | ⚠️ ticker abaixo do fundo do range 4H (down exibido como 0.00%)"
        print(
            f"RR (Range 4H): raw {rr_raw_str} | adj {rr_adj:.2f} (floor {RR_DOWNSIDE_FLOOR_PCT:.2f}%) — "
            f"up {rr_up:.2f}% | down {dn_display:.2f}% ({rr_adj_label}){note_rr}"
        )

    if rr_atr is None or rr_risk_pct is None:
        print("RR_ATR: n/a")
    else:
        print(f"RR_ATR: {rr_atr:.2f} — risk {rr_risk_pct:.2f}% (ATR%*{RR_ATR_RISK_MULT:.2f}) ({rr_atr_label})")

    print(f"Context Score: {score_val}/100 ({score_label})")
    print(f"Leitura rápida: {context_txt}")
    print(
        f"Data Quality: {dq_score}/100 "
        f"(1H={dq_detail.get('score_1h',0)} | 4H={dq_detail.get('score_4h',0)} | 1W={dq_detail.get('score_1w',0)})"
    )
    if dq_issues:
        print("🧪 Qualidade de dados:")
        for it in dq_issues[:6]:
            print(f" - {it}")
    print(
        "Risk Guardrails: "
        f"trade={risk_trade_capital_pct:.2f}% (max {MAX_RISK_PER_TRADE_CAPITAL_PCT:.2f}%) | "
        f"carteira_atual={risk_portfolio_existing_pct:.2f}% | "
        f"carteira_proj={risk_portfolio_projected_pct:.2f}% (max {MAX_PORTFOLIO_RISK_CAPITAL_PCT:.2f}%)"
    )
    if stage_before_guards != stage and risk_guard_issues:
        print(f"⚠️ Guardrails bloquearam entrada: {stage_before_guards} -> {stage}")

    # ✅ Macro/News integrado (linha + bullets)
    print(macro_news_line)
    if macro_bullets:
        print("🗞️ Top news (resumo):")
        for b in macro_bullets[:6]:
            print(f" - {b}")

    warn_panel = vol4_soft_warning_line(stage, v4_ratio, close_times_ms.get("4H"))
    if warn_panel:
        print(warn_panel)

    print("-" * 100)

    print(f"Alvo: {alloc['tgt']:.1f}% | pequena=6.0% | média=15.0% | cheia={alloc['tgt']:.1f}%") if False else None
    print(f"Alvo: {alloc['tgt']:.1f}% | pequena={alloc['small']:.1f}% | média={alloc['medium']:.1f}% | cheia={alloc['full']:.1f}%")
    print(f"Range 4H (fechado): topo={lvl.get('hi4',0.0):.2f} | fundo={lvl.get('lo4',0.0):.2f} | posRange4H={lvl.get('pos_range4h_pct',0.0):.2f}%")
    print(f"High/Low 1H: topo={lvl.get('hi1',0.0):.2f} | fundo={lvl.get('lo1',0.0):.2f}")
    print(f"Pivôs 4H: swing_high={piv.get('swing_high',0.0):.2f} | swing_low={piv.get('swing_low',0.0):.2f}")
    print(
        f"Distâncias (aprox.): posRange4H={lvl.get('pos_range4h_pct',0.0):.2f}% | topo4H={lvl.get('dist_top4_pct',0.0):.2f}% | "
        f"fundo4H={lvl.get('dist_bot4_pct',0.0):.2f}% | topoRange={lvl.get('dist_top4_range_pct',0.0):.2f}% | "
        f"fundoRange={lvl.get('dist_bot4_range_pct',0.0):.2f}% | swh={piv.get('dist_swh_pct',0.0):.2f}% | "
        f"swl={piv.get('dist_swl_pct',0.0):.2f}%"
    )
    print(
        f"Volume (fechado): 1H={lvl.get('vol1_ratio',0.0):.2f}x (min {VOL_MULTIPLIER_1H:.2f}x) | "
        f"4H={piv.get('vol4_ratio',0.0):.2f}x (min {VOL_MULTIPLIER_4H:.2f}x)"
    )
    print("-" * 100)
    print("Alertas 4H:")
    for x in a4h or ["(nenhum)"]:
        print(f" - {x}")
    print("Alertas 1H:")
    for x in a1h or ["(nenhum)"]:
        print(f" - {x}")
    print("-" * 100)
    print(f"ESTADO ATUAL: {stage} | Alocação sugerida agora: {stage_to_allocation(symbol, stage):.1f}% do capital")
    print(f"MOTIVO: {reason_txt}")
    if ENABLE_CONTINUATION_MODE:
        chg = "n/a" if change_24h_pct is None else f"{change_24h_pct:.2f}%"
        print(
            "CONTINUATION MODE: "
            f"24h={chg} | vol1={vol1_ratio:.2f} (min {CONT_MIN_VOL1_RATIO:.2f}) | "
            f"rr_atr={fmt_num(rr_atr,2)} (min {CONT_MIN_RR_ATR:.2f}) | "
            f"ema50_req={'on' if CONT_REQUIRE_ABOVE_EMA50 else 'off'} | "
            f"enabled_signal={'yes' if (continuation_ok or continuation_override_ok) else 'no'} | "
            f"override={'yes' if continuation_override_ok else 'no'}"
        )

    print("PRÓXIMO(S) GATILHO(S):")
    next_trigs = next_triggers_contextual(regime_1w, regime_4h, lvl, piv, close_times_ms=close_times_ms)
    for t in next_trigs:
        print(f" - {t}")

    print("Score breakdown:")
    for b in score_breakdown:
        print(f" - {b}")

    print("=" * 100)

    append_symbol_log(symbol, {
        "ts_utc": utc_now_iso(),
        "symbol": symbol,
        "price": price,
        "regime_1w": regime_1w,
        "regime_4h": regime_4h,
        "rr_range_4h": {
            "upside_pct": rr_up,
            "downside_pct": rr_dn,
            "downside_eff_pct": rr_dn_eff,
            "rr_raw": rr_raw,
            "rr_adj": rr_adj,
            "rr_adj_label": rr_adj_label,
            "rr_atr": rr_atr,
            "rr_atr_risk_pct": rr_risk_pct,
            "rr_atr_label": rr_atr_label,
            "params": {"downside_floor_pct": RR_DOWNSIDE_FLOOR_PCT, "atr_risk_mult": RR_ATR_RISK_MULT},
        },
        "volume": {"vol1_ratio": float(lvl.get("vol1_ratio", 0.0)), "vol4_ratio": float(piv.get("vol4_ratio", 0.0))},
        "stage": stage,
        "stage_pre_guardrails": stage_before_guards,
        "data_quality": {
            "score": dq_score,
            "threshold": MIN_DATA_QUALITY_SCORE,
            "issues": dq_issues,
            "detail": dq_detail,
        },
        "risk_guardrails": {
            "trade_capital_pct": risk_trade_capital_pct,
            "trade_limit_pct": MAX_RISK_PER_TRADE_CAPITAL_PCT,
            "portfolio_existing_pct": risk_portfolio_existing_pct,
            "portfolio_projected_pct": risk_portfolio_projected_pct,
            "portfolio_limit_pct": MAX_PORTFOLIO_RISK_CAPITAL_PCT,
            "blocked": bool(risk_guard_issues),
            "issues": risk_guard_issues,
        },
        "continuation": market_ctx,
        "next_closes_utc": {
            "1H_close_time_ms": close_times_ms.get("1H"),
            "4H_close_time_ms": close_times_ms.get("4H"),
            "1W_close_time_ms": close_times_ms.get("1W"),
        },
        "soft_warning_vol4": warn_panel,
        "macro_news_line": macro_news_line,
        "macro_bullets": macro_bullets,
        "macro_mode": "digest" if USE_MACRO_DIGEST else "integrated",
    })

    if stage in ("SMALL", "MEDIUM", "FULL"):
        ready_msg = build_ready_message(
            symbol=symbol,
            price=price,
            regime_1w=regime_1w,
            regime_4h=regime_4h,
            cycle_label=cycle_label,
            cycle_ref_name=cycle_ref_name,
            cycle_ref_val=cycle_ref_val,
            capmvrv_btc=capmvrv_btc,
            macro_state=macro_state,
            macro_alerts=macro_alerts,
            macro_news_line=macro_news_line,
            macro_bullets=macro_bullets,
            rr_adj=rr_adj,
            rr_atr=rr_atr,
            rr_label_adj=rr_adj_label,
            rr_label_atr=rr_atr_label,
            context_score_val=score_val,
            context_label=score_label,
            lvl=lvl,
            piv=piv,
            a1h=a1h or [],
            a4h=a4h or [],
            stage=stage,
            vol4_ratio=float(piv.get("vol4_ratio", 0.0)),
            close4_ms=close_times_ms.get("4H"),
        )

        if DEDUP_ALERTS:
            state = load_state()
            last_stage = state.get(symbol, {}).get("stage")
            last_msg = state.get(symbol, {}).get("msg")

            if stage != last_stage or ready_msg != last_msg:
                print("\n📩 MENSAGEM PRONTA (copiar/colar):")
                print(ready_msg)
                print()
                state[symbol] = {"stage": stage, "msg": ready_msg}
                save_state(state)
        else:
            print("\n📩 MENSAGEM PRONTA (copiar/colar):")
            print(ready_msg)
            print()


if __name__ == "__main__":
    for sym in ["BTCUSDT", "ETHUSDT", "XRPUSDT"]:
        summarize(sym)
