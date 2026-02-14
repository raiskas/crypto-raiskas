"""
macro_sources.py — coleta de Macro (FRED + Finnhub opcional) e News (RSS)

ENV suportadas:
- FRED_API_KEY=...               (opcional mas recomendado)
- FINNHUB_API_KEY=...            (opcional)
- RSS_FEEDS=url1,url2,...        (opcional; se vazio usa defaults)
- HTTP_TIMEOUT=8                 (opcional)
- HTTP_RETRIES=1                 (opcional)

Observação:
- RSS é "sem API" (bom para começar).
- FRED fornece séries macro oficiais (juros, CPI, yields).
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


def _timeout() -> int:
    try:
        return int(os.getenv("HTTP_TIMEOUT", "8"))
    except Exception:
        return 8


def _retries() -> int:
    try:
        return max(0, int(os.getenv("HTTP_RETRIES", "1")))
    except Exception:
        return 1


def http_get_json(url: str, headers: Optional[dict] = None) -> Tuple[Optional[dict], Optional[str]]:
    req = urllib.request.Request(url, headers=headers or {})
    last_err = None
    for attempt in range(_retries() + 1):
        try:
            with urllib.request.urlopen(req, timeout=_timeout()) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw), None
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            time.sleep(0.25 * (attempt + 1))
    return None, last_err


def http_get_text(url: str, headers: Optional[dict] = None) -> Tuple[Optional[str], Optional[str]]:
    req = urllib.request.Request(url, headers=headers or {})
    last_err = None
    for attempt in range(_retries() + 1):
        try:
            with urllib.request.urlopen(req, timeout=_timeout()) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            return raw, None
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            time.sleep(0.25 * (attempt + 1))
    return None, last_err


def _clean_html(text: str) -> str:
    # remove tags simples
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# -------------------------
# FRED
# -------------------------

FRED_BASE = "https://api.stlouisfed.org/fred"


def fred_latest_value(series_id: str, api_key: str) -> Tuple[Optional[float], Optional[str], Optional[str]]:
    """
    Retorna (valor, date, err)
    """
    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "sort_order": "desc",
        "limit": "1",
    }
    url = f"{FRED_BASE}/series/observations?{urllib.parse.urlencode(params)}"
    js, err = http_get_json(url)
    if err or not js:
        return None, None, err or "no_response"
    obs = js.get("observations", [])
    if not obs:
        return None, None, "no_observations"
    v = obs[0].get("value", None)
    d = obs[0].get("date", None)
    try:
        if v in (None, ".", ""):
            return None, d, "missing_value"
        return float(v), d, None
    except Exception:
        return None, d, "bad_value"


def fetch_fred_macro(api_key: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Coleta um conjunto mínimo (robusto) de séries.
    """
    series = {
        # Juros
        "fed_funds": "FEDFUNDS",
        # Inflação (CPI YoY) — alternativa: CPIAUCSL (nível) e calcular YoY
        "cpi_yoy": "CPIAUCSL",  # nível (vamos devolver nível e o consumidor decide)
        # Yields
        "us2y": "DGS2",
        "us10y": "DGS10",
        # Fallbacks de mercado
        "vix": "VIXCLS",
        "sp500": "SP500",
        "dxy_broad": "DTWEXBGS",
    }

    out: Dict[str, Any] = {"source": "FRED", "items": {}, "errors": {}}
    any_ok = False

    for k, sid in series.items():
        val, date, err = fred_latest_value(sid, api_key)
        if err:
            out["errors"][k] = err
        else:
            out["items"][k] = {"value": val, "date": date, "series_id": sid}
            any_ok = True

    if not any_ok:
        return None, f"fred_failed:{out['errors']}"
    return out, None


def fred_latest_value_public(series_id: str) -> Tuple[Optional[float], Optional[str], Optional[str]]:
    """
    Fallback sem chave: usa endpoint CSV público do FRED.
    """
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={urllib.parse.quote(series_id)}"
    txt, err = http_get_text(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; crypto-middleware/1.0)",
            "Accept": "text/csv, */*;q=0.8",
        },
    )
    if err or not txt:
        return None, None, err or "no_response"

    last_date: Optional[str] = None
    last_val: Optional[float] = None
    for raw_line in txt.splitlines()[1:]:
        line = raw_line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 2:
            continue
        d, v = parts[0], parts[1]
        if v in ("", ".", "nan", "NaN"):
            continue
        try:
            num = float(v)
            last_date = d
            last_val = num
        except Exception:
            continue

    if last_val is None:
        return None, None, "no_valid_value"
    return last_val, last_date, None


def fetch_fred_macro_public() -> Tuple[Optional[dict], Optional[str]]:
    """
    Coleta FRED sem API key (CSV público).
    """
    series = {
        "fed_funds": "FEDFUNDS",
        "cpi_yoy": "CPIAUCSL",
        "us2y": "DGS2",
        "us10y": "DGS10",
        "vix": "VIXCLS",
        "sp500": "SP500",
        "dxy_broad": "DTWEXBGS",
    }

    out: Dict[str, Any] = {"source": "FRED_PUBLIC_CSV", "items": {}, "errors": {}}
    any_ok = False

    for k, sid in series.items():
        val, date, err = fred_latest_value_public(sid)
        if err:
            out["errors"][k] = err
        else:
            out["items"][k] = {"value": val, "date": date, "series_id": sid}
            any_ok = True

    if not any_ok:
        return None, f"fred_public_failed:{out['errors']}"
    return out, None


# -------------------------
# Finnhub (opcional)
# -------------------------

FINNHUB_BASE = "https://finnhub.io/api/v1"


def finnhub_quote(symbol: str, api_key: str) -> Tuple[Optional[dict], Optional[str]]:
    params = {"symbol": symbol, "token": api_key}
    url = f"{FINNHUB_BASE}/quote?{urllib.parse.urlencode(params)}"
    js, err = http_get_json(url)
    if err or not js:
        return None, err or "no_response"
    # Finnhub quote fields: c (current), pc (prev close), d (change), dp (%)
    if "c" not in js:
        return None, "bad_response"
    return js, None


def fetch_finnhub_risk_proxies(api_key: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Proxies comuns:
    - VIX: ^VIX (depende do provedor; em Finnhub geralmente funciona como ^VIX)
    - SPX: ^GSPC (pode variar)
    - DXY: DX=F (pode variar)

    Se algum símbolo falhar, devolve parcial.
    """
    symbols = {
        "vix": "^VIX",
        "spx": "^GSPC",
        "dxy": "DX=F",
    }
    out: Dict[str, Any] = {"source": "FINNHUB", "items": {}, "errors": {}}
    any_ok = False

    for k, sym in symbols.items():
        q, err = finnhub_quote(sym, api_key)
        if err:
            out["errors"][k] = f"{sym}:{err}"
        else:
            out["items"][k] = {
                "symbol": sym,
                "c": q.get("c"),
                "dp": q.get("dp"),
                "t": int(time.time()),
            }
            any_ok = True

    if not any_ok:
        return None, f"finnhub_failed:{out['errors']}"
    return out, None


def fetch_public_risk_proxies() -> Tuple[Optional[dict], Optional[str]]:
    """
    Fallback sem chave: Yahoo Finance quote API pública.
    """
    symbols = ["^VIX", "^GSPC", "DX-Y.NYB", "DX=F"]
    params = {"symbols": ",".join(symbols)}
    url = f"https://query1.finance.yahoo.com/v7/finance/quote?{urllib.parse.urlencode(params)}"
    js, err = http_get_json(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; crypto-middleware/1.0)",
            "Accept": "application/json, */*;q=0.8",
        },
    )
    if err or not js:
        return None, err or "no_response"

    result = (((js.get("quoteResponse") or {}).get("result")) or [])
    if not isinstance(result, list):
        return None, "bad_response"

    by_symbol: Dict[str, dict] = {}
    for item in result:
        if isinstance(item, dict):
            sym = str(item.get("symbol", "")).upper()
            if sym:
                by_symbol[sym] = item

    mapping = {
        "vix": ["^VIX"],
        "spx": ["^GSPC"],
        "dxy": ["DX-Y.NYB", "DX=F"],
    }
    out: Dict[str, Any] = {"source": "YAHOO_PUBLIC", "items": {}, "errors": {}}
    any_ok = False

    for key, cands in mapping.items():
        picked: Optional[dict] = None
        picked_sym = ""
        for s in cands:
            if s in by_symbol:
                picked = by_symbol[s]
                picked_sym = s
                break
        if not picked:
            out["errors"][key] = "symbol_not_found"
            continue
        c = picked.get("regularMarketPrice")
        dp = picked.get("regularMarketChangePercent")
        try:
            c_val = float(c) if c is not None else None
            dp_val = float(dp) if dp is not None else None
        except Exception:
            out["errors"][key] = "bad_number"
            continue
        if c_val is None:
            out["errors"][key] = "missing_price"
            continue
        out["items"][key] = {
            "symbol": picked_sym,
            "c": c_val,
            "dp": dp_val,
            "t": int(time.time()),
        }
        any_ok = True

    if not any_ok:
        return None, f"yahoo_public_failed:{out['errors']}"
    return out, None


# -------------------------
# RSS / Atom
# -------------------------

DEFAULT_RSS_FEEDS = [
    # Essas URLs podem mudar com o tempo; por isso também é configurável por ENV.
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",   # World News
    "https://www.cnbc.com/id/20910258/device/rss/rss.html",    # Economy
    "https://feeds.a.dj.com/rss/RSSWorldNews.xml",             # WSJ World News (pode exigir acesso em alguns lugares)
    "https://feeds.bbci.co.uk/news/business/rss.xml",          # BBC Business
]

UA_HEADERS = {
    "User-Agent": "macro-bot/1.0 (+https://github.com)",
    "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
}


def _get_feeds() -> List[str]:
    env = (os.getenv("RSS_FEEDS") or "").strip()
    if env:
        parts = [p.strip() for p in env.split(",") if p.strip()]
        return parts or DEFAULT_RSS_FEEDS
    return DEFAULT_RSS_FEEDS


def _parse_rss_or_atom(xml_text: str) -> List[dict]:
    """
    Parser leve (RSS 2.0 e Atom).
    Retorna itens com: title, link, published, summary
    """
    items: List[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return items

    # RSS: <rss><channel><item>...
    channel = root.find("channel")
    if channel is not None:
        for it in channel.findall("item"):
            title = (it.findtext("title") or "").strip()
            link = (it.findtext("link") or "").strip()
            pub = (it.findtext("pubDate") or "").strip()
            desc = (it.findtext("description") or "").strip()
            items.append(
                {
                    "title": _clean_html(title),
                    "link": link,
                    "published": pub,
                    "summary": _clean_html(desc),
                }
            )
        return items

    # Atom: <feed><entry>...
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"
    for entry in root.findall(f"{ns}entry"):
        title = (entry.findtext(f"{ns}title") or "").strip()
        link = ""
        for l in entry.findall(f"{ns}link"):
            href = l.attrib.get("href")
            if href:
                link = href
                break
        pub = (entry.findtext(f"{ns}updated") or entry.findtext(f"{ns}published") or "").strip()
        summ = (entry.findtext(f"{ns}summary") or entry.findtext(f"{ns}content") or "").strip()
        items.append(
            {
                "title": _clean_html(title),
                "link": link,
                "published": pub,
                "summary": _clean_html(summ),
            }
        )
    return items


def fetch_rss_headlines(max_items_total: int = 20) -> Tuple[Optional[List[dict]], Optional[str]]:
    feeds = _get_feeds()
    all_items: List[dict] = []
    errors: List[str] = []

    for url in feeds:
        txt, err = http_get_text(url, headers=UA_HEADERS)
        if err or not txt:
            errors.append(f"{url}:{err or 'no_text'}")
            continue
        items = _parse_rss_or_atom(txt)
        if not items:
            errors.append(f"{url}:parse_empty")
            continue
        for it in items[: max(1, max_items_total // max(1, len(feeds)))]:
            it["feed"] = url
            all_items.append(it)

    if not all_items:
        return None, "rss_failed:" + (" | ".join(errors) if errors else "no_items")

    # Ordenação leve: mantém como veio (muitas feeds já vêm desc)
    return all_items[:max_items_total], None


def summarize_headlines(items: List[dict], max_bullets: int = 6) -> List[str]:
    """
    Resumo heurístico (sem IA externa): pega títulos e corta.
    """
    bullets: List[str] = []
    seen = set()

    for it in items:
        title = (it.get("title") or "").strip()
        if not title:
            continue
        key = re.sub(r"[^a-z0-9]+", "", title.lower())[:64]
        if key in seen:
            continue
        seen.add(key)

        # corta título grande
        if len(title) > 110:
            title = title[:107].rstrip() + "…"

        bullets.append(title)
        if len(bullets) >= max_bullets:
            break

    return bullets
