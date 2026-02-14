"""
macro_context.py — Macro Bot integrado (FRED + Finnhub opcional + RSS)

O que ele devolve para o middleware:
- badge: 🟢🟡🔴 (🟡 quando sem dados)
- macro_score: 0–100
- posture: "risk-on" | "neutro" | "risk-off" | "sem_dados"
- highlights: bullets (3–6)
- notes: avisos/atenções (ex.: dados indisponíveis)

ENV:
- DISABLE_MACRO=1        desliga tudo macro
- DISABLE_NEWS=1         desliga só notícias (RSS)
- FRED_API_KEY=...
- FINNHUB_API_KEY=...    (opcional)
- RSS_FEEDS=...,...      (opcional)
- MACRO_TTL_H=24
- NEWS_TTL_MIN=45
- FIN_TTL_H=6

Cache:
- ./cache/macro_context.json (no BASE_DIR do middleware)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple

from cache_utils import cache_read_json, cache_write_json, ensure_dir
from macro_sources import (
    fetch_fred_macro,
    fetch_fred_macro_public,
    fetch_finnhub_risk_proxies,
    fetch_public_risk_proxies,
    fetch_rss_headlines,
    summarize_headlines,
)


def _env_bool(name: str, default: str = "0") -> bool:
    v = (os.getenv(name, default) or "").strip().lower()
    return v in ("1", "true", "yes", "y", "on")


def _env_int(name: str, default: str) -> int:
    try:
        return int(os.getenv(name, default))
    except Exception:
        return int(default)


@dataclass
class MacroContext:
    badge: str
    macro_score: Optional[int]
    posture: str
    highlights: List[str]
    notes: List[str]
    raw: Dict[str, Any]


def compute_macro_score(fred: Optional[dict], fin: Optional[dict], news_items: Optional[List[dict]]) -> Tuple[Optional[int], str, List[str]]:
    """
    Heurística simples e explicável (você pode evoluir depois):
    - Se não tiver dados suficientes: score None, posture sem_dados
    - Caso contrário, soma sinais básicos:
      * Yield 10y - 2y (curva): muito negativo => risk-off
      * VIX alto => risk-off
      * SPX var% (dp) muito negativa => risk-off
      * DXY var% muito positiva => risk-off (dólar forte aperta condições)
    """
    notes: List[str] = []
    score = 50  # base neutra
    signals = 0

    # Curva de juros via FRED
    if fred and fred.get("items"):
        i = fred["items"]
        us2y = i.get("us2y", {}).get("value")
        us10y = i.get("us10y", {}).get("value")
        if us2y is not None and us10y is not None:
            signals += 1
            spread = float(us10y) - float(us2y)
            # curva muito invertida
            if spread < -0.50:
                score -= 15
                notes.append(f"Curva (10Y-2Y) bem invertida ({spread:.2f}pp) → risco maior")
            elif spread < 0:
                score -= 8
                notes.append(f"Curva (10Y-2Y) invertida ({spread:.2f}pp) → atenção")
            else:
                score += 5
                notes.append(f"Curva (10Y-2Y) positiva ({spread:.2f}pp) → melhor clima")
    # Proxies via Finnhub (opcional)
    if fin and fin.get("items"):
        items = fin["items"]
        vix = items.get("vix", {})
        spx = items.get("spx", {})
        dxy = items.get("dxy", {})

        if vix.get("c") is not None:
            signals += 1
            v = float(vix["c"])
            if v >= 25:
                score -= 15
                notes.append(f"VIX alto ({v:.1f}) → risk-off")
            elif v >= 20:
                score -= 8
                notes.append(f"VIX elevado ({v:.1f}) → atenção")
            elif v <= 15:
                score += 6
                notes.append(f"VIX baixo ({v:.1f}) → risk-on")
            else:
                notes.append(f"VIX moderado ({v:.1f})")

        if spx.get("dp") is not None:
            signals += 1
            dp = float(spx["dp"])
            if dp <= -1.0:
                score -= 8
                notes.append(f"S&P 500 caindo ({dp:.2f}%) → aversão a risco")
            elif dp >= 1.0:
                score += 6
                notes.append(f"S&P 500 subindo ({dp:.2f}%) → apetite a risco")

        if dxy.get("dp") is not None:
            signals += 1
            dp = float(dxy["dp"])
            if dp >= 0.6:
                score -= 6
                notes.append(f"Dólar forte (DXY {dp:.2f}%) → aperto financeiro")
            elif dp <= -0.6:
                score += 4
                notes.append(f"Dólar enfraquecendo (DXY {dp:.2f}%) → alívio")

    # Notícias (não “manda” no score; só ajuste leve)
    if news_items:
        # se várias manchetes com termos de stress, dá um tilt defensivo pequeno
        text = " ".join([(it.get("title") or "") for it in news_items]).lower()
        stress_terms = ["war", "conflict", "strike", "sanction", "shutdown", "crisis", "default", "recession", "inflation surge", "bank"]
        hits = sum(1 for t in stress_terms if t in text)
        if hits >= 3:
            score -= 4
            notes.append("Manchetes sugerem stress (ajuste leve defensivo)")
            signals += 1

    if signals == 0:
        return None, "sem_dados", ["Sem dados suficientes para score macro."]

    score = max(0, min(100, int(round(score))))
    if score >= 70:
        return score, "risk-on", notes
    if score <= 40:
        return score, "risk-off", notes
    return score, "neutro", notes


def posture_to_badge(posture: str, has_data: bool) -> str:
    if not has_data or posture == "sem_dados":
        return "🟡"
    if posture == "risk-on":
        return "🟢"
    if posture == "risk-off":
        return "🔴"
    return "🟡"


def get_macro_context(base_dir: str) -> MacroContext:
    if _env_bool("DISABLE_MACRO", "0"):
        return MacroContext(
            badge="🟡",
            macro_score=None,
            posture="sem_dados",
            highlights=[],
            notes=["Macro desativado (DISABLE_MACRO=1)."],
            raw={},
        )

    cache_dir = os.path.join(base_dir, "cache")
    ensure_dir(cache_dir)
    cache_path = os.path.join(cache_dir, "macro_context.json")

    ttl_macro_s = _env_int("MACRO_TTL_H", "24") * 3600
    ttl_news_s = _env_int("NEWS_TTL_MIN", "45") * 60
    ttl_fin_s = _env_int("FIN_TTL_H", "6") * 3600

    # cache geral do contexto (para não recomputar sempre)
    cached = cache_read_json(cache_path, ttl_s=min(ttl_macro_s, ttl_news_s))
    if cached.hit and not cached.stale and cached.data:
        d = cached.data
        return MacroContext(
            badge=d.get("badge", "🟡"),
            macro_score=d.get("macro_score"),
            posture=d.get("posture", "sem_dados"),
            highlights=d.get("highlights", []),
            notes=d.get("notes", []),
            raw=d.get("raw", {}),
        )

    notes: List[str] = []
    raw: Dict[str, Any] = {}

    # FRED
    fred_key = (os.getenv("FRED_API_KEY") or "").strip()
    fred = None
    if fred_key:
        fred, err = fetch_fred_macro(fred_key)
        if err:
            notes.append(f"FRED indisponível (key): {err}")
            fred, err2 = fetch_fred_macro_public()
            if err2:
                notes.append(f"FRED público indisponível: {err2}")
            else:
                raw["fred"] = fred
                notes.append("FRED via fallback público (sem key).")
        else:
            raw["fred"] = fred
    else:
        fred, err = fetch_fred_macro_public()
        if err:
            notes.append(f"FRED público indisponível: {err}")
        else:
            raw["fred"] = fred
            notes.append("FRED via fallback público (sem key).")

    # Finnhub (opcional)
    fin_key = (os.getenv("FINNHUB_API_KEY") or "").strip()
    fin = None
    if fin_key:
        fin, err = fetch_finnhub_risk_proxies(fin_key)
        if err:
            notes.append(f"Finnhub indisponível (key): {err}")
            fin, err2 = fetch_public_risk_proxies()
            if err2:
                notes.append(f"Fallback público VIX/SPX/DXY indisponível: {err2}")
            else:
                raw["finnhub"] = fin
                notes.append("VIX/SPX/DXY via fallback público (Yahoo).")
        else:
            raw["finnhub"] = fin
    else:
        fin, err = fetch_public_risk_proxies()
        if err:
            notes.append(f"Fallback público VIX/SPX/DXY indisponível: {err}")
        else:
            raw["finnhub"] = fin
            notes.append("VIX/SPX/DXY via fallback público (Yahoo).")

    # News (RSS)
    news_items = None
    highlights: List[str] = []
    if _env_bool("DISABLE_NEWS", "0"):
        notes.append("News desativado (DISABLE_NEWS=1).")
    else:
        news_items, err = fetch_rss_headlines(max_items_total=18)
        if err:
            notes.append(f"RSS indisponível: {err}")
        else:
            raw["rss_count"] = len(news_items or [])
            highlights = summarize_headlines(news_items or [], max_bullets=6)

    # Score & badge
    score, posture, score_notes = compute_macro_score(fred, fin, news_items)
    notes = score_notes + notes  # score_notes primeiro (mais importante)

    has_data = score is not None
    badge = posture_to_badge(posture, has_data=has_data)

    ctx = MacroContext(
        badge=badge,
        macro_score=score,
        posture=posture,
        highlights=highlights,
        notes=notes[:10],
        raw=raw,
    )

    # grava cache (mesmo se parcial — ajuda estabilidade)
    cache_write_json(cache_path, asdict(ctx))
    return ctx
