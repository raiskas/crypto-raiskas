#!/usr/bin/env python3
"""
Macro Sentinel — Híbrido (Macro Econômico + Notícias Crypto) → macro_digest.json

Objetivo
- Rodar separado do middleware.
- Gerar um resumo estruturado com:
  • risk_score 0–100 + label
  • drivers (bullets)
  • next_events_utc (se disponível)
  • crypto headlines (RSS)
  • sources
- Cache simples e tolerância a falhas: se uma fonte cair, continua com o que tiver.

Rodando no macOS (exemplos)
- Uma vez:
  python3 macro_sentinel.py
- A cada 30 min (cron):
  crontab -e
  */30 * * * * /usr/bin/python3 /caminho/macro_sentinel.py >> /caminho/macro_sentinel.log 2>&1

Config (opcional via env)
- MACRO_DIGEST_FILE=macro_digest.json
- MACRO_DIGEST_TTL_SECONDS=21600   (6h)
- NEWS_MAX_ITEMS=12
- NEWS_RSS_URLS="https://www.coindesk.com/arc/outboundfeeds/rss/,https://cointelegraph.com/rss"
- TRADINGECONOMICS_KEY=... (opcional; calendário econômico)
"""

import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import requests
import xml.etree.ElementTree as ET

REQUEST_TIMEOUT = 12

MACRO_DIGEST_FILE = os.getenv("MACRO_DIGEST_FILE", "macro_digest.json")
MACRO_DIGEST_TTL_SECONDS = int(os.getenv("MACRO_DIGEST_TTL_SECONDS", "21600"))  # 6h
NEWS_MAX_ITEMS = int(os.getenv("NEWS_MAX_ITEMS", "12"))

DEFAULT_RSS = [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
    "https://bitcoinmagazine.com/.rss/full/",
]
NEWS_RSS_URLS = [u.strip() for u in os.getenv("NEWS_RSS_URLS", ",".join(DEFAULT_RSS)).split(",") if u.strip()]

TRADINGECONOMICS_KEY = os.getenv("TRADINGECONOMICS_KEY", "").strip()

POS_WORDS = {
    "approve", "approval", "approved", "etf", "inflows", "adoption", "upgrade", "partnership",
    "record", "bull", "surge", "rally", "rebound", "breakout", "strong", "positive",
}
NEG_WORDS = {
    "hack", "exploit", "breach", "lawsuit", "sued", "ban", "banned", "crackdown", "sanction",
    "regulation", "charges", "collapse", "bankrupt", "outflow", "selloff", "dump", "bear",
    "negative", "fraud", "scam", "liquidation",
}

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def safe_get_json(url: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    try:
        r = requests.get(url, params=params or {}, timeout=REQUEST_TIMEOUT, headers={"User-Agent": "macro-sentinel/1.0"})
        if r.status_code != 200:
            return None
        return r.json()
    except Exception:
        return None

def safe_get_text(url: str, params: Optional[Dict[str, Any]] = None) -> Optional[str]:
    try:
        r = requests.get(url, params=params or {}, timeout=REQUEST_TIMEOUT, headers={"User-Agent": "macro-sentinel/1.0"})
        if r.status_code != 200:
            return None
        return r.text
    except Exception:
        return None

# -----------------------
# Sources (no-key)
# -----------------------
def fetch_fear_greed() -> Tuple[Optional[int], Optional[str]]:
    """
    alternative.me Fear & Greed Index (0–100), no key.
    """
    data = safe_get_json("https://api.alternative.me/fng/")
    try:
        v = int(data["data"][0]["value"])
        cls = str(data["data"][0]["value_classification"])
        return v, cls
    except Exception:
        return None, None

def fetch_coingecko_global() -> Dict[str, Optional[float]]:
    """
    CoinGecko global data: marketcap change 24h, btc dominance, total marketcap.
    No key.
    """
    out = {"mcap_change_24h_pct": None, "btc_dominance_pct": None, "total_mcap_usd": None}
    data = safe_get_json("https://api.coingecko.com/api/v3/global")
    try:
        g = data.get("data", {})
        out["mcap_change_24h_pct"] = float(g.get("market_cap_change_percentage_24h_usd"))
        out["btc_dominance_pct"] = float(g.get("market_cap_percentage", {}).get("btc"))
        out["total_mcap_usd"] = float(g.get("total_market_cap", {}).get("usd"))
    except Exception:
        pass
    return out

def fetch_rss_headlines(urls: List[str], max_items: int) -> List[Dict[str, str]]:
    items: List[Dict[str, str]] = []
    for u in urls:
        txt = safe_get_text(u)
        if not txt:
            continue
        try:
            root = ET.fromstring(txt)
            # RSS usually: rss/channel/item
            channel = root.find("channel")
            if channel is None:
                # sometimes Atom feeds; ignore for now
                continue
            for it in channel.findall("item"):
                title = (it.findtext("title") or "").strip()
                link = (it.findtext("link") or "").strip()
                pub = (it.findtext("pubDate") or "").strip()
                if not title:
                    continue
                items.append({"title": title[:240], "url": link, "source": u, "published": pub})
                if len(items) >= max_items:
                    return items
        except Exception:
            continue
    return items[:max_items]

def headline_sentiment(headlines: List[Dict[str, str]]) -> float:
    """
    Heurística simples: (pos - neg) / max(1, n)
    """
    if not headlines:
        return 0.0
    pos = 0
    neg = 0
    for h in headlines:
        t = (h.get("title") or "").lower()
        words = set(re.findall(r"[a-zA-Z]+", t))
        pos += len(words.intersection(POS_WORDS))
        neg += len(words.intersection(NEG_WORDS))
    n = max(1, len(headlines))
    return (pos - neg) / float(n)

# -----------------------
# Optional: calendar (TradingEconomics)
# -----------------------
def fetch_te_calendar_next_72h() -> List[Dict[str, str]]:
    """
    Requires TRADINGECONOMICS_KEY.
    Returns a few upcoming events with UTC timestamps if available.
    """
    if not TRADINGECONOMICS_KEY:
        return []

    # TradingEconomics API endpoints vary by plan; using a conservative approach:
    # https://api.tradingeconomics.com/calendar?c=APIKEY
    # Filter client-side for next 72h.
    data = safe_get_json("https://api.tradingeconomics.com/calendar", params={"c": TRADINGECONOMICS_KEY})
    if not isinstance(data, list):
        return []

    now = datetime.now(timezone.utc)
    out: List[Dict[str, str]] = []
    for ev in data:
        try:
            # Many TE responses provide "Date" as ISO string (often local timezone). We'll attempt parse loosely.
            date_str = str(ev.get("Date") or "")
            # Try parse: "2026-02-12T13:30:00"
            dt = None
            for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
                try:
                    dt = datetime.strptime(date_str[:19], fmt).replace(tzinfo=timezone.utc)
                    break
                except Exception:
                    continue
            if dt is None:
                continue
            delta_h = (dt - now).total_seconds() / 3600.0
            if delta_h < 0 or delta_h > 72:
                continue
            country = str(ev.get("Country") or "")
            event = str(ev.get("Event") or ev.get("Category") or "")
            if not event:
                continue
            out.append({"when": dt.strftime("%Y-%m-%dT%H:%M:%SZ"), "event": f"{country}: {event}".strip(": ")})
        except Exception:
            continue

    out.sort(key=lambda x: x["when"])
    return out[:10]

# -----------------------
# Risk scoring (0–100)
# -----------------------
def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))

def build_risk_digest() -> Dict[str, Any]:
    ts = utc_now_iso()

    # No-key sources
    fng_val, fng_label = fetch_fear_greed()
    cg = fetch_coingecko_global()
    headlines = fetch_rss_headlines(NEWS_RSS_URLS, NEWS_MAX_ITEMS)
    sent = headline_sentiment(headlines)

    # Optional calendar
    next_events = fetch_te_calendar_next_72h()

    drivers: List[str] = []
    sources: List[str] = []

    # Start from a neutral baseline and add/subtract
    score = 50.0

    # Fear & Greed: low => higher risk; high => lower risk
    if fng_val is not None:
        sources.append("alternative.me/fng")
        if fng_val <= 25:
            score += 18
            drivers.append(f"Fear&Greed baixo ({fng_val}/100) → aversão a risco")
        elif fng_val <= 45:
            score += 8
            drivers.append(f"Fear&Greed moderado-baixo ({fng_val}/100)")
        elif fng_val >= 75:
            score -= 10
            drivers.append(f"Fear&Greed alto ({fng_val}/100) → risk-on (cuidado com euforia)")
        elif fng_val >= 60:
            score -= 5
            drivers.append(f"Fear&Greed moderado-alto ({fng_val}/100)")
        else:
            drivers.append(f"Fear&Greed neutro ({fng_val}/100)")
    else:
        drivers.append("Fear&Greed n/a")

    # CoinGecko global: marketcap change
    mcap_ch = cg.get("mcap_change_24h_pct")
    if mcap_ch is not None:
        sources.append("coingecko/global")
        if mcap_ch <= -4.0:
            score += 14
            drivers.append(f"Market cap 24h forte queda ({mcap_ch:.2f}%)")
        elif mcap_ch <= -2.0:
            score += 8
            drivers.append(f"Market cap 24h em queda ({mcap_ch:.2f}%)")
        elif mcap_ch >= 4.0:
            score -= 8
            drivers.append(f"Market cap 24h forte alta ({mcap_ch:.2f}%)")
        elif mcap_ch >= 2.0:
            score -= 4
            drivers.append(f"Market cap 24h em alta ({mcap_ch:.2f}%)")
        else:
            drivers.append(f"Market cap 24h neutro ({mcap_ch:.2f}%)")
    else:
        drivers.append("Market cap 24h n/a")

    # BTC dominance: rising dominance can be "defensive risk-on" (alts weak) — mild risk up
    btc_dom = cg.get("btc_dominance_pct")
    if btc_dom is not None:
        if btc_dom >= 55:
            score += 4
            drivers.append(f"Dominância BTC alta ({btc_dom:.1f}%) → rotação defensiva")
        elif btc_dom <= 45:
            score -= 2
            drivers.append(f"Dominância BTC baixa ({btc_dom:.1f}%) → apetite por alts")
        else:
            drivers.append(f"Dominância BTC neutra ({btc_dom:.1f}%)")

    # News sentiment: negative => risk up
    if headlines:
        sources.append("rss/headlines")
        if sent <= -0.35:
            score += 10
            drivers.append(f"Headlines negativas (sent {sent:.2f})")
        elif sent <= -0.15:
            score += 5
            drivers.append(f"Headlines levemente negativas (sent {sent:.2f})")
        elif sent >= 0.35:
            score -= 6
            drivers.append(f"Headlines positivas (sent {sent:.2f})")
        elif sent >= 0.15:
            score -= 3
            drivers.append(f"Headlines levemente positivas (sent {sent:.2f})")
        else:
            drivers.append(f"Headlines neutras (sent {sent:.2f})")
    else:
        drivers.append("Headlines n/a")

    # Calendar: upcoming major events => risk up
    if next_events:
        sources.append("tradingeconomics/calendar")
        score += 6
        drivers.append(f"Eventos macro próximos (≤72h): {len(next_events)} itens")
    else:
        drivers.append("Calendário macro n/a (ou sem key)")

    score = clamp(score, 0.0, 100.0)

    if score >= 71:
        label = "risco"
    elif score >= 46:
        label = "neutro"
    else:
        label = "calmo"

    # Keep top drivers short
    drivers_out = drivers[:6]

    digest: Dict[str, Any] = {
        "ts_utc": ts,
        "macro": {
            "risk_score": int(round(score)),
            "label": label,
            "drivers": drivers_out,
            "next_events_utc": next_events,
        },
        "crypto_news": {
            "sentiment": float(sent),
            "top_headlines": headlines[:NEWS_MAX_ITEMS],
        },
        "sources": sorted(list(set(sources))),
        "meta": {
            "ttl_seconds": MACRO_DIGEST_TTL_SECONDS,
            "rss_urls": NEWS_RSS_URLS,
        },
    }
    return digest

def save_json(path: str, obj: Dict[str, Any]) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def main() -> int:
    digest = build_risk_digest()
    save_json(MACRO_DIGEST_FILE, digest)
    print(f"[macro_sentinel] wrote {MACRO_DIGEST_FILE} @ {digest.get('ts_utc')}")
    print(f"[macro_sentinel] risk={digest['macro']['risk_score']}/100 ({digest['macro']['label']})")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

