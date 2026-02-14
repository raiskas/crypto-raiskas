#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import math
import subprocess
import sys
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
LOG_DIR = BASE_DIR / "logs"
BACKTEST_DIR = BASE_DIR / "data" / "backtests"
TRADE_HISTORY_FILE = BASE_DIR / "data" / "trade_history.jsonl"
MACRO_CONTEXT_CACHE_FILE = BASE_DIR / "cache" / "macro_context.json"
ECON_PANEL_STATE_FILE = BASE_DIR / "cache" / "econ_panel_state.json"
REFRESH_RUN_STATE: Dict[str, Any] = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "exit_code": None,
    "message": "idle",
}
REFRESH_LOCK = threading.Lock()

try:
    from macro_context import get_macro_context  # type: ignore
except Exception:
    get_macro_context = None


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        return None
    return None


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _iter_jsonl_last(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            lines = f.readlines()
        for ln in reversed(lines):
            ln = ln.strip()
            if not ln:
                continue
            try:
                row = json.loads(ln)
            except Exception:
                continue
            if isinstance(row, dict):
                return row
    except Exception:
        return None
    return None


def _read_jsonl(path: Path, limit: int = 50, symbol: str = "") -> list:
    if not path.exists():
        return []
    items = []
    sym = (symbol or "").upper().strip()
    try:
        with path.open("r", encoding="utf-8") as f:
            for ln in f:
                ln = ln.strip()
                if not ln:
                    continue
                try:
                    row = json.loads(ln)
                except Exception:
                    continue
                if not isinstance(row, dict):
                    continue
                if sym and str(row.get("symbol", "")).upper() != sym:
                    continue
                items.append(row)
    except Exception:
        return []
    return items[-limit:]


def _parse_iso_ts(ts: Any) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


def _fmt_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat().replace("+00:00", "Z")


def _impact_label_from_headline(text: str) -> str:
    t = (text or "").lower()
    high_terms = (
        "fed",
        "fomc",
        "cpi",
        "inflation",
        "interest rate",
        "recession",
        "war",
        "conflict",
        "sanction",
        "tariff",
        "powell",
    )
    medium_terms = (
        "gdp",
        "employment",
        "unemployment",
        "treasury",
        "yield",
        "dollar",
        "bank",
        "oil",
        "opec",
    )
    if any(k in t for k in high_terms):
        return "alto"
    if any(k in t for k in medium_terms):
        return "médio"
    return "baixo"


def _news_category_from_headline(text: str) -> str:
    t = (text or "").lower()
    if any(k in t for k in ("fed", "fomc", "powell", "interest rate", "yield", "treasury")):
        return "Juros/Fed"
    if any(k in t for k in ("cpi", "inflation", "ppi", "prices")):
        return "Inflação"
    if any(k in t for k in ("war", "conflict", "sanction", "attack", "geopolitical")):
        return "Geopolítica"
    if any(k in t for k in ("sec", "regulation", "regulatory", "law", "ban", "etf")):
        return "Regulação"
    if any(k in t for k in ("bank", "liquidity", "credit", "dollar", "funding")):
        return "Liquidez"
    return "Mercado Global"


def _crypto_relevance_score(text: str, category: str, impact: str) -> int:
    t = (text or "").lower()
    score = 30
    if impact == "alto":
        score += 30
    elif impact == "médio":
        score += 18
    else:
        score += 8

    if category in ("Juros/Fed", "Liquidez", "Regulação"):
        score += 20
    elif category in ("Inflação", "Geopolítica"):
        score += 12

    crypto_terms = (
        "bitcoin",
        "btc",
        "crypto",
        "ether",
        "eth",
        "xrp",
        "etf",
        "stablecoin",
        "exchange",
    )
    hits = sum(1 for k in crypto_terms if k in t)
    score += min(20, hits * 6)
    return max(0, min(100, score))


def _market_direction_hint(text: str) -> str:
    t = (text or "").lower()
    risk_off_terms = ("war", "conflict", "sanction", "inflation", "rate hike", "crisis", "default")
    risk_on_terms = ("rate cut", "disinflation", "growth", "liquidity", "stimulus", "eases")
    if any(k in t for k in risk_off_terms):
        return "risk-off"
    if any(k in t for k in risk_on_terms):
        return "risk-on"
    return "neutro"


def build_global_news_payload() -> Dict[str, Any]:
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "sem_dados",
        "macro": {
            "badge": "🟡",
            "macro_score": None,
            "posture": "sem_dados",
            "updated_ts": None,
        },
        "headlines": [],
        "top_risks": [],
        "categories": {},
        "watchlist": [],
        "notes": [],
        "executive_summary": [],
        "economic_panel": [],
    }

    cache = _read_json(MACRO_CONTEXT_CACHE_FILE)
    if not isinstance(cache, dict) and get_macro_context is not None:
        # Tenta carregar ao vivo quando cache não existe.
        try:
            ctx = get_macro_context(str(BASE_DIR))
            cache = {
                "data": {
                    "badge": getattr(ctx, "badge", "🟡"),
                    "macro_score": getattr(ctx, "macro_score", None),
                    "posture": getattr(ctx, "posture", "sem_dados"),
                    "highlights": list(getattr(ctx, "highlights", []) or []),
                    "notes": list(getattr(ctx, "notes", []) or []),
                    "raw": dict(getattr(ctx, "raw", {}) or {}),
                }
            }
        except Exception:
            cache = None
    raw_data: Dict[str, Any] = {}
    highlights: list = []
    notes: list = []
    raw_block: Dict[str, Any] = {}
    used_cache = False

    if isinstance(cache, dict):
        raw_data = cache.get("data") if isinstance(cache.get("data"), dict) else cache
        if isinstance(raw_data, dict):
            used_cache = True
            payload["status"] = "ok"
            payload["macro"]["badge"] = raw_data.get("badge", "🟡")
            payload["macro"]["macro_score"] = raw_data.get("macro_score")
            payload["macro"]["posture"] = raw_data.get("posture", "sem_dados")

            ts_val = cache.get("ts")
            try:
                if ts_val is not None:
                    ts_epoch = int(ts_val)
                    payload["macro"]["updated_ts"] = datetime.fromtimestamp(ts_epoch, tz=timezone.utc).isoformat().replace("+00:00", "Z")
            except Exception:
                pass

            highlights = raw_data.get("highlights") if isinstance(raw_data.get("highlights"), list) else []
            notes = raw_data.get("notes") if isinstance(raw_data.get("notes"), list) else []
            raw_block = raw_data.get("raw") if isinstance(raw_data.get("raw"), dict) else {}

    # Fallback local: usa os últimos logs do robô para não deixar a aba vazia.
    if not highlights:
        seen = set()
        latest_ts = None
        latest_posture = None
        for sym in ("BTCUSDT", "ETHUSDT", "XRPUSDT"):
            row = _iter_jsonl_last(LOG_DIR / f"{sym}.jsonl")
            if not isinstance(row, dict):
                continue
            ts = _parse_iso_ts(row.get("ts_utc"))
            if ts and (latest_ts is None or ts > latest_ts):
                latest_ts = ts
            mline = str(row.get("macro_news_line", "") or "")
            if "postura:" in mline:
                try:
                    latest_posture = mline.split("postura:", 1)[1].strip().split("|")[0].strip()
                except Exception:
                    pass
            for b in (row.get("macro_bullets") or []):
                txt = str(b).strip()
                if not txt:
                    continue
                key = txt.lower()
                if key in seen:
                    continue
                seen.add(key)
                highlights.append(txt)
                if len(highlights) >= 20:
                    break
            if len(highlights) >= 20:
                break

        if highlights:
            payload["status"] = "ok"
            if latest_posture:
                payload["macro"]["posture"] = latest_posture
            if latest_ts:
                payload["macro"]["updated_ts"] = _fmt_iso(latest_ts)
            notes = (notes or []) + ["Fallback local ativo: usando headlines salvas dos logs do robô."]
        elif not used_cache:
            notes = (notes or []) + ["Sem cache macro e sem bullets em logs recentes."]

    fred_items = (
        raw_block.get("fred", {}).get("items", {})
        if isinstance(raw_block.get("fred"), dict)
        else {}
    )
    fin_items = (
        raw_block.get("finnhub", {}).get("items", {})
        if isinstance(raw_block.get("finnhub"), dict)
        else {}
    )

    enriched = []
    for h in highlights:
        title = str(h).strip()
        if not title:
            continue
        impact = _impact_label_from_headline(title)
        category = _news_category_from_headline(title)
        crypto_score = _crypto_relevance_score(title, category, impact)
        direction = _market_direction_hint(title)
        enriched.append(
            {
                "title": title,
                "impact": impact,
                "category": category,
                "crypto_relevance": crypto_score,
                "direction": direction,
            }
        )

    enriched.sort(key=lambda x: (x["crypto_relevance"], 2 if x["impact"] == "alto" else 1 if x["impact"] == "médio" else 0), reverse=True)
    payload["headlines"] = enriched[:20]
    payload["top_risks"] = enriched[:5]

    cat_map: Dict[str, list] = {}
    for it in enriched:
        cat = it["category"]
        cat_map.setdefault(cat, []).append(it)
    payload["categories"] = {k: v[:4] for k, v in cat_map.items()}

    watch = []
    if payload["macro"]["posture"] in ("risk-off", "sem_dados"):
        watch.append("Evitar aumento agressivo de exposição até melhora de contexto macro.")
    if any(it.get("impact") == "alto" for it in enriched):
        watch.append("Acompanhar notícias de alto impacto antes de novas entradas.")
    if any(it.get("category") == "Juros/Fed" for it in enriched):
        watch.append("Monitorar dados de juros/Fed: costumam mover liquidez para cripto.")
    if any(it.get("category") == "Regulação" for it in enriched):
        watch.append("Monitorar manchetes regulatórias; impacto pode ser rápido em BTC/ETH/XRP.")
    payload["watchlist"] = watch[:5]
    payload["notes"] = [str(n).strip() for n in notes if str(n).strip()][:10]

    # Painel econômico (com fallback quando fonte não estiver configurada)
    def _econ_signal(name: str, value: Optional[float]) -> str:
        if value is None:
            return "neutral"
        if name == "VIX":
            if value >= 24:
                return "red"
            if value >= 18:
                return "yellow"
            return "green"
        if name == "Curva 10Y-2Y":
            return "green" if value >= 0 else "red"
        if name in ("Fed Funds", "US10Y", "US2Y"):
            if value >= 4.75:
                return "red"
            if value >= 3.5:
                return "yellow"
            return "green"
        if name == "S&P 500 (dia)":
            if value <= -0.7:
                return "red"
            if value >= 0.7:
                return "green"
            return "yellow"
        if name == "DXY (dia)":
            if value >= 0.6:
                return "red"
            if value <= -0.6:
                return "green"
            return "yellow"
        return "neutral"

    def _impact_crypto(name: str, value: Optional[float], unit: str) -> str:
        if value is None:
            return "Sem leitura suficiente para inferir impacto em cripto."
        if name == "VIX":
            if value >= 24:
                return "Alta volatilidade global: tende a pressionar cripto no curto prazo."
            if value >= 18:
                return "Volatilidade moderada: manter gestão de risco mais conservadora."
            return "Volatilidade controlada: ambiente mais favorável para ativos de risco."
        if name == "Curva 10Y-2Y":
            if value < 0:
                return "Curva invertida: costuma elevar cautela para posições mais agressivas."
            return "Curva positiva: reduz pressão macro estrutural sobre ativos de risco."
        if name == "Fed Funds":
            if value >= 4.75:
                return "Juros altos drenam liquidez; entradas em cripto pedem seletividade."
            return "Juros menos restritivos ajudam o apetite por risco no médio prazo."
        if name == "S&P 500 (dia)" and unit == "%":
            if value <= -0.7:
                return "Ações em queda forte: costuma contaminar sentimento em cripto."
            if value >= 0.7:
                return "Ações em alta forte: normalmente melhora o apetite por cripto."
            return "Ações sem direção forte: impacto neutro para cripto agora."
        if name == "DXY (dia)" and unit == "%":
            if value >= 0.6:
                return "Dólar forte: tende a apertar condições para cripto."
            if value <= -0.6:
                return "Dólar enfraquecendo: costuma aliviar ativos de risco."
            return "Dólar lateral: efeito limitado em cripto no momento."
        return "Indicador de contexto estrutural para leitura macro."

    def _econ_card(name: str, value: Optional[float], unit: str, note: str, source: str) -> Dict[str, Any]:
        return {
            "name": name,
            "value": value,
            "unit": unit,
            "note": note,
            "source": source,
            "available": value is not None,
            "signal": _econ_signal(name, value),
            "impact_crypto": _impact_crypto(name, value, unit),
            "delta": None,
            "delta_pct": None,
        }

    fed_funds = _safe_float((fred_items.get("fed_funds") or {}).get("value"))
    us10y = _safe_float((fred_items.get("us10y") or {}).get("value"))
    us2y = _safe_float((fred_items.get("us2y") or {}).get("value"))
    spread_10_2 = (us10y - us2y) if (us10y is not None and us2y is not None) else None
    cpi_index = _safe_float((fred_items.get("cpi_yoy") or {}).get("value"))

    vix_fin = _safe_float((fin_items.get("vix") or {}).get("c"))
    vix_fred = _safe_float((fred_items.get("vix") or {}).get("value"))
    vix = vix_fin if vix_fin is not None else vix_fred
    vix_source = "FINNHUB" if vix_fin is not None else ("FRED" if vix_fred is not None else "FINNHUB")

    spx_dp = _safe_float((fin_items.get("spx") or {}).get("dp"))
    spx_level = _safe_float((fred_items.get("sp500") or {}).get("value"))
    spx_source = "FINNHUB" if spx_dp is not None else ("FRED" if spx_level is not None else "FINNHUB")

    dxy_dp = _safe_float((fin_items.get("dxy") or {}).get("dp"))
    dxy_level = _safe_float((fred_items.get("dxy_broad") or {}).get("value"))
    dxy_source = "FINNHUB" if dxy_dp is not None else ("FRED" if dxy_level is not None else "FINNHUB")

    spread_note = "Curva de juros sem dados."
    if spread_10_2 is not None:
        if spread_10_2 < 0:
            spread_note = "Curva invertida: maior cautela para risco."
        else:
            spread_note = "Curva positiva: ambiente macro menos pressionado."

    vix_note = "VIX sem dados."
    if vix is not None:
        if vix >= 25:
            vix_note = "Volatilidade alta (risk-off)."
        elif vix >= 20:
            vix_note = "Volatilidade em alerta."
        else:
            vix_note = "Volatilidade controlada."

    spx_note = "S&P sem dados."
    if spx_dp is not None:
        if spx_dp <= -1.0:
            spx_note = "Ações em queda forte (aversão a risco)."
        elif spx_dp >= 1.0:
            spx_note = "Ações em alta forte (apetite a risco)."
        else:
            spx_note = "Movimento neutro de ações."
    elif spx_level is not None:
        spx_note = "Nível de fechamento via FRED (sem variação diária)."

    dxy_note = "DXY sem dados."
    if dxy_dp is not None:
        if dxy_dp >= 0.6:
            dxy_note = "Dólar forte, costuma apertar ativos de risco."
        elif dxy_dp <= -0.6:
            dxy_note = "Dólar mais fraco, tende a aliviar risco."
        else:
            dxy_note = "Dólar sem direção forte."
    elif dxy_level is not None:
        dxy_note = "Nível de fechamento via FRED (sem variação diária)."

    econ_cards = [
        _econ_card("Fed Funds", fed_funds, "%", "Juro básico dos EUA.", "FRED"),
        _econ_card("US10Y", us10y, "%", "Treasury 10 anos.", "FRED"),
        _econ_card("US2Y", us2y, "%", "Treasury 2 anos.", "FRED"),
        _econ_card("Curva 10Y-2Y", spread_10_2, "pp", spread_note, "FRED"),
        _econ_card("CPI (índice)", cpi_index, "", "Nível de preços (série CPIAUCSL).", "FRED"),
        _econ_card("VIX", vix, "", vix_note, vix_source),
        _econ_card("S&P 500 (dia)", spx_dp if spx_dp is not None else spx_level, "%" if spx_dp is not None else "", spx_note, spx_source),
        _econ_card("DXY (dia)", dxy_dp if dxy_dp is not None else dxy_level, "%" if dxy_dp is not None else "", dxy_note, dxy_source),
    ]

    prev_state = _read_json(ECON_PANEL_STATE_FILE) or {}
    prev_values = prev_state.get("values", {}) if isinstance(prev_state.get("values"), dict) else {}
    now_values: Dict[str, float] = {}
    for card in econ_cards:
        name = str(card.get("name", ""))
        value = _safe_float(card.get("value"))
        prev = _safe_float(prev_values.get(name)) if isinstance(prev_values, dict) else None
        if value is not None:
            now_values[name] = value
        if value is not None and prev is not None:
            delta = value - prev
            card["delta"] = delta
            if prev != 0:
                card["delta_pct"] = (delta / abs(prev)) * 100.0

    _write_json(
        ECON_PANEL_STATE_FILE,
        {"ts": int(datetime.now(timezone.utc).timestamp()), "values": now_values},
    )
    payload["economic_panel"] = econ_cards

    # Resumo executivo (3 linhas para leitura rápida)
    posture = payload["macro"]["posture"]
    score = payload["macro"]["macro_score"]
    if score is None:
        line1 = "Contexto macro: sem score numérico (fontes macro incompletas)."
    else:
        line1 = f"Contexto macro: score {score}/100 com postura {posture}."

    if payload["top_risks"]:
        top = payload["top_risks"][0]
        line2 = f"Risco dominante: {top.get('category', '-')}, impacto {top.get('impact', '-')}, direção {top.get('direction', '-')}"
    else:
        line2 = "Risco dominante: sem manchetes suficientes no momento."

    if payload["watchlist"]:
        line3 = f"Ação de hoje: {payload['watchlist'][0]}"
    else:
        line3 = "Ação de hoje: manter leitura de risco antes de novas entradas."

    payload["executive_summary"] = [line1, line2, line3]
    return payload


def _safe_float(v: Any) -> Optional[float]:
    try:
        n = float(v)
        return n
    except Exception:
        return None


def _json_safe(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj


def build_live_payload() -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "symbols": {},
    }
    # Usa o mesmo macro snapshot da aba Global News para evitar divergência.
    macro_snapshot = build_global_news_payload().get("macro", {})
    global_posture = str((macro_snapshot or {}).get("posture", "sem_dados") or "sem_dados")
    for sym in ("BTCUSDT", "ETHUSDT", "XRPUSDT"):
        row = _iter_jsonl_last(LOG_DIR / f"{sym}.jsonl")
        if not row:
            continue
        vol = row.get("volume") if isinstance(row.get("volume"), dict) else {}
        context = row.get("context_score") if isinstance(row.get("context_score"), dict) else {}
        rr = row.get("rr_range_4h") if isinstance(row.get("rr_range_4h"), dict) else {}
        dq = row.get("data_quality") if isinstance(row.get("data_quality"), dict) else {}
        rg = row.get("risk_guardrails") if isinstance(row.get("risk_guardrails"), dict) else {}
        macro_line = str(row.get("macro_news_line", "") or "")
        posture = global_posture
        # Fallback legado: se não houver snapshot global, tenta extrair da linha do log.
        if posture == "sem_dados" and "postura:" in macro_line:
            try:
                posture = macro_line.split("postura:", 1)[1].strip().split("|")[0].strip()
            except Exception:
                posture = "sem_dados"

        price = _safe_float(row.get("price"))
        rr_up = _safe_float(rr.get("upside_pct"))
        rr_down = _safe_float(rr.get("downside_pct"))
        rr_atr_risk_pct = _safe_float(rr.get("rr_atr_risk_pct"))
        rr_adj = _safe_float(rr.get("rr_adj"))
        rr_atr = _safe_float(rr.get("rr_atr"))
        dq_score = _safe_float(dq.get("score"))
        dq_threshold = _safe_float(dq.get("threshold"))
        rg_trade = _safe_float(rg.get("trade_capital_pct"))
        rg_trade_limit = _safe_float(rg.get("trade_limit_pct"))
        rg_port_proj = _safe_float(rg.get("portfolio_projected_pct"))
        rg_port_limit = _safe_float(rg.get("portfolio_limit_pct"))
        rg_blocked = bool(rg.get("blocked", False))
        v1 = _safe_float(vol.get("vol1_ratio"))
        v4 = _safe_float(vol.get("vol4_ratio"))
        stage = str(row.get("stage", "WAIT"))
        regime_1w = str(row.get("regime_1w", ""))
        regime_4h = str(row.get("regime_4h", ""))

        target1 = None
        target2 = None
        stop_structural = None
        stop_operational = None
        risk_structural_pct = rr_down
        risk_operational_pct = None
        if price is not None and rr_up is not None:
            target1 = price * (1.0 + (max(0.0, rr_up) * 0.5 / 100.0))
            target2 = price * (1.0 + (max(0.0, rr_up) / 100.0))
        if price is not None and rr_down is not None:
            down_cap = min(max(0.0, rr_down), 20.0)
            stop_structural = price * (1.0 - (down_cap / 100.0))

            # Stop operacional: mais curto para execução tática (horas/1 dia),
            # limitado por ATR e teto máximo.
            if rr_atr_risk_pct is not None:
                op_from_atr = rr_atr_risk_pct * 1.10
            else:
                op_from_atr = down_cap
            op_capped = min(max(op_from_atr, 1.20), 3.20)
            op_final = min(op_capped, down_cap)
            risk_operational_pct = op_final
            stop_operational = price * (1.0 - (op_final / 100.0))

        trend_ok = "ALTA" in regime_1w
        structure_ok = "BAIXA" not in regime_4h
        volume_ok = (v1 is not None and v1 >= 1.05) and (v4 is not None and v4 >= 1.00)
        rr_ok = (rr_adj is not None and rr_adj >= 1.0) or (rr_atr is not None and rr_atr >= 1.2)
        macro_state = "ok"
        if posture == "risk-off":
            macro_state = "fail"
        elif posture == "sem_dados":
            macro_state = "na"
        macro_ok = (macro_state == "ok")
        data_ok = (dq_score is None or dq_threshold is None or dq_score >= dq_threshold)
        checks = [trend_ok, structure_ok, volume_ok, rr_ok, data_ok]
        checks_ok = sum(1 for x in checks if x)
        checks_total = len(checks)
        if macro_state != "na":
            checks_total += 1
            if macro_ok:
                checks_ok += 1
        confidence = int(round((checks_ok / max(1, checks_total)) * 100))

        if stage in ("FULL", "MEDIUM", "SMALL"):
            action = "COMPRAR"
        else:
            action = "AGUARDAR"
        if rg_blocked:
            action = "AGUARDAR"

        vol1_gap = None if v1 is None else max(0.0, 1.05 - v1)
        vol4_gap = None if v4 is None else max(0.0, 1.00 - v4)
        rr_adj_gap = None if rr_adj is None else max(0.0, 1.0 - rr_adj)
        rr_atr_gap = None if rr_atr is None else max(0.0, 1.2 - rr_atr)

        bottleneck = {"key": "ok", "label": "Sem gargalo dominante", "detail": "Condições principais estão aceitáveis."}
        if not structure_ok:
            bottleneck = {
                "key": "structure_4h",
                "label": "Estrutura 4H ainda em baixa",
                "detail": "Aguardar fechamento 4H com virada bullish para ganhar convicção.",
            }
        if not volume_ok:
            if (vol1_gap or 0.0) >= (vol4_gap or 0.0):
                bottleneck = {
                    "key": "volume_1h",
                    "label": "Volume 1H abaixo do mínimo",
                    "detail": f"Falta +{(vol1_gap or 0.0):.2f}x para atingir 1.05x.",
                }
            else:
                bottleneck = {
                    "key": "volume_4h",
                    "label": "Volume 4H abaixo do mínimo",
                    "detail": f"Falta +{(vol4_gap or 0.0):.2f}x para atingir 1.00x.",
                }
        elif not rr_ok:
            bottleneck = {
                "key": "rr",
                "label": "Assimetria risco/retorno fraca",
                "detail": (
                    f"Precisa RR>=1.0 (falta {rr_adj_gap:.2f}) ou RR_ATR>=1.2 (falta {rr_atr_gap:.2f})."
                    if rr_adj_gap is not None and rr_atr_gap is not None
                    else "Aguardando melhora da assimetria risco/retorno."
                ),
            }

        buy_now_steps: List[str] = []
        if not trend_ok:
            buy_now_steps.append("Esperar 1W voltar para tendência de alta.")
        if not structure_ok:
            buy_now_steps.append("Esperar fechamento 4H com estrutura bullish.")
        if not volume_ok:
            if vol1_gap is not None and vol1_gap > 0:
                buy_now_steps.append(f"Volume 1H: precisa +{vol1_gap:.2f}x para bater 1.05x.")
            if vol4_gap is not None and vol4_gap > 0:
                buy_now_steps.append(f"Volume 4H: precisa +{vol4_gap:.2f}x para bater 1.00x.")
        if not rr_ok:
            if rr_adj_gap is not None and rr_adj_gap > 0:
                buy_now_steps.append(f"RR ajustado: falta +{rr_adj_gap:.2f} para chegar em 1.00.")
            if rr_atr_gap is not None and rr_atr_gap > 0:
                buy_now_steps.append(f"RR_ATR: falta +{rr_atr_gap:.2f} para chegar em 1.20.")
        if macro_state == "fail":
            buy_now_steps.append("Macro em risk-off: evitar aumentar exposição agora.")
        if macro_state == "na":
            buy_now_steps.append("Macro sem dados (n/a): não bloqueia entrada, mas reduz contexto.")
        if not buy_now_steps:
            buy_now_steps.append("Condições centrais atendidas; executar com gestão de risco.")
        if rg_blocked:
            for gi in (rg.get("issues") or []):
                txt = str(gi).strip()
                if txt:
                    buy_now_steps.append(f"Guardrail: {txt}")

        target_alloc = {"BTCUSDT": 30.0, "ETHUSDT": 20.0, "XRPUSDT": 10.0}.get(sym, 0.0)
        stage_mult = {"SMALL": 0.20, "MEDIUM": 0.50, "FULL": 1.00}.get(stage, 0.0)
        suggested_alloc_pct = target_alloc * stage_mult
        risk_pct = risk_operational_pct if risk_operational_pct is not None else rr_down
        invalidated = False
        if action == "COMPRAR" and price is not None and stop_operational is not None and price <= stop_operational:
            invalidated = True

        scenario_base = "Entrada em rompimento/continuação com gestão de risco."
        scenario_alt = "Se perder momentum e volume, manter em espera."
        if "ALTA" in regime_1w and "BAIXA" in regime_4h:
            scenario_base = "Aguardar 4H melhorar; entradas apenas com gatilho forte 1H."
            scenario_alt = "Se 4H seguir em baixa, evitar novas compras."
        elif "BAIXA" in regime_1w:
            scenario_base = "Priorizar defesa; compras somente táticas e pequenas."
            scenario_alt = "Se 1W voltar para alta, reavaliar entradas."

        out["symbols"][sym] = {
            "ts_utc": row.get("ts_utc"),
            "price": price,
            "stage": stage,
            "regime_1w": regime_1w,
            "regime_4h": regime_4h,
            "vol1_ratio": v1,
            "vol4_ratio": v4,
            "context_score": context.get("value"),
            "context_label": context.get("label"),
            "rr_adj": rr_adj,
            "rr_atr": rr_atr,
            "rr_up_pct": rr_up,
            "rr_down_pct": rr_down,
            "trade_plan": {
                "action": action,
                "entry_price": price,
                "stop_price": stop_operational,
                "stop_operational_price": stop_operational,
                "stop_structural_price": stop_structural,
                "target1_price": target1,
                "target2_price": target2,
                "confidence": confidence,
                "suggested_alloc_pct": suggested_alloc_pct,
                "risk_pct": risk_pct,
                "risk_operational_pct": risk_operational_pct,
                "risk_structural_pct": risk_structural_pct,
                "invalidated": invalidated,
                "quality": {
                    "trend_1w": trend_ok,
                    "structure_4h": structure_ok,
                    "volume": volume_ok,
                    "rr": rr_ok,
                    "data": data_ok,
                    "macro": macro_ok,
                    "macro_state": macro_state,
                    "macro_posture": posture,
                },
                "data_quality_score": dq_score,
                "data_quality_threshold": dq_threshold,
                "risk_per_trade_pct": rg_trade,
                "risk_per_trade_limit_pct": rg_trade_limit,
                "risk_portfolio_projected_pct": rg_port_proj,
                "risk_portfolio_limit_pct": rg_port_limit,
                "guardrails_blocked": rg_blocked,
                "scenario_base": scenario_base,
                "scenario_alt": scenario_alt,
                "bottleneck": bottleneck,
                "buy_now_steps": buy_now_steps[:5],
            },
        }
    return out


def _latest_prices_map() -> Dict[str, float]:
    prices: Dict[str, float] = {}
    for sym in ("BTCUSDT", "ETHUSDT", "XRPUSDT"):
        row = _iter_jsonl_last(LOG_DIR / f"{sym}.jsonl")
        if isinstance(row, dict):
            p = _safe_float(row.get("price"))
            if p is not None:
                prices[sym] = p
    return prices


def build_recent_trades_payload(symbol: str = "", limit: int = 50) -> Dict[str, Any]:
    events = _read_jsonl(TRADE_HISTORY_FILE, limit=2000, symbol=symbol)
    latest_prices = _latest_prices_map()

    # Consolida eventos BUY/SELL em trades com status OPEN/CLOSED.
    open_by_symbol: Dict[str, Dict[str, Any]] = {}
    closed: list = []

    for ev in events:
        sym = str(ev.get("symbol", "")).upper()
        if not sym:
            continue
        side = str(ev.get("side", "")).upper()
        ts = _parse_iso_ts(ev.get("ts_utc"))
        signal_type = str(ev.get("signal_type", "")).upper()

        if side == "BUY":
            current = open_by_symbol.get(sym)
            if not isinstance(current, dict):
                open_by_symbol[sym] = {
                    "symbol": sym,
                    "side": "BUY",
                    "status": "OPEN",
                    "entry_ts": _fmt_iso(ts),
                    "entry_price": _safe_float(ev.get("entry_price")),
                    "target_price": _safe_float(ev.get("target_price")),
                    "expected_profit_pct": _safe_float(ev.get("expected_profit_pct")),
                    "stage": ev.get("stage"),
                    "last_signal": signal_type or "ENTRY",
                }
            else:
                # escala de posição: mantém entrada original, atualiza alvos/expectativa
                if _safe_float(ev.get("target_price")) is not None:
                    current["target_price"] = _safe_float(ev.get("target_price"))
                if _safe_float(ev.get("expected_profit_pct")) is not None:
                    current["expected_profit_pct"] = _safe_float(ev.get("expected_profit_pct"))
                if ev.get("stage"):
                    current["stage"] = ev.get("stage")
                current["last_signal"] = signal_type or "SCALE_IN"
                open_by_symbol[sym] = current
            continue

        if side == "SELL":
            current = open_by_symbol.get(sym)
            exit_price = _safe_float(ev.get("exit_price"))
            entry_price_ev = _safe_float(ev.get("entry_price"))

            if isinstance(current, dict):
                entry_price = _safe_float(current.get("entry_price"))
                if entry_price is None:
                    entry_price = entry_price_ev
                realized_pct = _safe_float(ev.get("realized_profit_pct"))
                if realized_pct is None and entry_price and exit_price:
                    realized_pct = ((exit_price / entry_price) - 1.0) * 100.0

                entry_dt = _parse_iso_ts(current.get("entry_ts"))
                hold_h = None
                if entry_dt and ts and ts >= entry_dt:
                    hold_h = (ts - entry_dt).total_seconds() / 3600.0

                trade = {
                    "symbol": sym,
                    "side": "BUY",
                    "status": "CLOSED",
                    "entry_ts": current.get("entry_ts"),
                    "exit_ts": _fmt_iso(ts),
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "target_price": _safe_float(current.get("target_price")),
                    "expected_profit_pct": _safe_float(current.get("expected_profit_pct")),
                    "realized_profit_pct": realized_pct,
                    "hold_hours": hold_h,
                    "stage": current.get("stage"),
                    "last_signal": signal_type or "EXIT",
                }
                closed.append(trade)
                open_by_symbol.pop(sym, None)
            else:
                # saída sem entrada local (fallback de consistência)
                realized_pct = _safe_float(ev.get("realized_profit_pct"))
                closed.append(
                    {
                        "symbol": sym,
                        "side": "BUY",
                        "status": "CLOSED",
                        "entry_ts": None,
                        "exit_ts": _fmt_iso(ts),
                        "entry_price": entry_price_ev,
                        "exit_price": exit_price,
                        "target_price": None,
                        "expected_profit_pct": None,
                        "realized_profit_pct": realized_pct,
                        "hold_hours": None,
                        "stage": ev.get("stage"),
                        "last_signal": signal_type or "EXIT",
                    }
                )

    open_trades = []
    now = datetime.now(timezone.utc)
    for sym, t in open_by_symbol.items():
        entry_price = _safe_float(t.get("entry_price"))
        last_price = latest_prices.get(sym)
        unrealized = None
        if entry_price and last_price:
            unrealized = ((last_price / entry_price) - 1.0) * 100.0

        entry_dt = _parse_iso_ts(t.get("entry_ts"))
        hold_h = None
        if entry_dt and now >= entry_dt:
            hold_h = (now - entry_dt).total_seconds() / 3600.0

        open_trades.append(
            {
                "symbol": sym,
                "side": "BUY",
                "status": "OPEN",
                "entry_ts": t.get("entry_ts"),
                "exit_ts": None,
                "entry_price": entry_price,
                "exit_price": None,
                "current_price": last_price,
                "target_price": _safe_float(t.get("target_price")),
                "expected_profit_pct": _safe_float(t.get("expected_profit_pct")),
                "realized_profit_pct": None,
                "unrealized_profit_pct": unrealized,
                "hold_hours": hold_h,
                "stage": t.get("stage"),
                "last_signal": t.get("last_signal"),
            }
        )

    all_trades = closed + open_trades

    def _sort_key(x: Dict[str, Any]) -> datetime:
        return _parse_iso_ts(x.get("exit_ts") or x.get("entry_ts")) or datetime.fromtimestamp(0, tz=timezone.utc)

    all_trades.sort(key=_sort_key, reverse=True)
    all_trades = all_trades[:limit]

    return {
        "symbol": symbol or "ALL",
        "count": len(all_trades),
        "trades": all_trades,
        "source": str(TRADE_HISTORY_FILE),
    }


def _refresh_runner() -> None:
    with REFRESH_LOCK:
        REFRESH_RUN_STATE["running"] = True
        REFRESH_RUN_STATE["started_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        REFRESH_RUN_STATE["finished_at"] = None
        REFRESH_RUN_STATE["exit_code"] = None
        REFRESH_RUN_STATE["message"] = "executando middleware.py..."

    venv_python = BASE_DIR / ".venv312" / "bin" / "python"
    py_exec = str(venv_python) if venv_python.exists() else sys.executable
    cmd = [py_exec, str(BASE_DIR / "middleware.py")]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=900,
        )
        with REFRESH_LOCK:
            REFRESH_RUN_STATE["running"] = False
            REFRESH_RUN_STATE["finished_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            REFRESH_RUN_STATE["exit_code"] = int(proc.returncode)
            if proc.returncode == 0:
                REFRESH_RUN_STATE["message"] = "ok"
            else:
                tail = (proc.stderr or proc.stdout or "").strip().splitlines()
                err = tail[-1] if tail else "erro ao executar middleware.py"
                REFRESH_RUN_STATE["message"] = err[:240]
    except subprocess.TimeoutExpired:
        with REFRESH_LOCK:
            REFRESH_RUN_STATE["running"] = False
            REFRESH_RUN_STATE["finished_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            REFRESH_RUN_STATE["exit_code"] = 124
            REFRESH_RUN_STATE["message"] = "timeout (900s) ao executar middleware.py"
    except Exception as e:
        with REFRESH_LOCK:
            REFRESH_RUN_STATE["running"] = False
            REFRESH_RUN_STATE["finished_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            REFRESH_RUN_STATE["exit_code"] = 1
            REFRESH_RUN_STATE["message"] = f"falha ao iniciar refresh: {type(e).__name__}"


def start_refresh_run() -> Dict[str, Any]:
    with REFRESH_LOCK:
        if REFRESH_RUN_STATE.get("running"):
            return {
                "ok": False,
                "started": False,
                "status": dict(REFRESH_RUN_STATE),
                "message": "já existe atualização em andamento",
            }
        worker = threading.Thread(target=_refresh_runner, daemon=True)
        worker.start()
        return {
            "ok": True,
            "started": True,
            "status": dict(REFRESH_RUN_STATE),
            "message": "refresh iniciado",
        }


def get_refresh_status() -> Dict[str, Any]:
    with REFRESH_LOCK:
        return {"ok": True, "status": dict(REFRESH_RUN_STATE)}


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        raw = json.dumps(_json_safe(payload), ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/api/live":
            self._send_json(build_live_payload())
            return

        if parsed.path == "/api/backtest-summary":
            data = _read_json(BACKTEST_DIR / "backtest_summary.json")
            if data is None:
                self._send_json({"error": "backtest_summary.json não encontrado"}, status=404)
                return
            self._send_json(data)
            return

        if parsed.path == "/api/backtest-sweep":
            data = _read_json(BACKTEST_DIR / "backtest_sweep.json")
            if data is None:
                self._send_json({"error": "backtest_sweep.json não encontrado"}, status=404)
                return
            self._send_json(data)
            return

        if parsed.path == "/api/trades":
            query = parse_qs(parsed.query or "")
            symbol = (query.get("symbol", [""])[0] or "").upper()
            limit_raw = query.get("limit", ["20"])[0]
            try:
                limit = max(1, min(200, int(limit_raw)))
            except Exception:
                limit = 20

            data = _read_json(BACKTEST_DIR / "backtest_summary.json") or {}
            symbols = data.get("symbols") if isinstance(data.get("symbols"), dict) else {}
            if symbol and symbol in symbols:
                trades = symbols[symbol].get("trades", [])
                if isinstance(trades, list):
                    self._send_json({"symbol": symbol, "trades": trades[-limit:]})
                    return
            self._send_json({"symbol": symbol, "trades": []})
            return

        if parsed.path == "/api/recent-trades":
            query = parse_qs(parsed.query or "")
            symbol = (query.get("symbol", [""])[0] or "").upper()
            limit_raw = query.get("limit", ["50"])[0]
            try:
                limit = max(1, min(500, int(limit_raw)))
            except Exception:
                limit = 50
            self._send_json(build_recent_trades_payload(symbol=symbol, limit=limit))
            return

        if parsed.path == "/api/global-news":
            self._send_json(build_global_news_payload())
            return

        if parsed.path == "/api/refresh-status":
            self._send_json(get_refresh_status())
            return

        if parsed.path == "/":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/refresh-run":
            out = start_refresh_run()
            self._send_json(out, status=202 if out.get("started") else 409)
            return
        self._send_json({"error": "not_found"}, status=404)


def main() -> int:
    host = os.getenv("DASHBOARD_HOST", "127.0.0.1")
    port = int(os.getenv("DASHBOARD_PORT", "8000"))

    server = ThreadingHTTPServer((host, port), DashboardHandler)
    print(f"[dashboard] running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[dashboard] stopped")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
