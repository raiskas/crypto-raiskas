#!/usr/bin/env python3
"""
Backtest simples a partir dos JSONL gerados pelo middleware.

Metodologia v1:
- Entrada: quando estágio entra em um dos estágios ativos (default: SMALL,MEDIUM,FULL)
  e não existe posição aberta no ativo.
- Saída: quando estágio vira WAIT, ou quando atinge max_hold_hours (default: 24h),
  ou no último registro disponível (forced_eod).
- Retorno bruto: (exit_price / entry_price - 1)
- Retorno líquido: retorno bruto - taxa (2 * fee_bps)
"""

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple

DEFAULT_LOG_FILES = [
    "logs/BTCUSDT.jsonl",
    "logs/ETHUSDT.jsonl",
    "logs/XRPUSDT.jsonl",
]


@dataclass
class Snapshot:
    ts: datetime
    symbol: str
    price: float
    stage: str


@dataclass
class Trade:
    symbol: str
    entry_ts: datetime
    exit_ts: datetime
    entry_price: float
    exit_price: float
    entry_stage: str
    exit_stage: str
    reason: str
    hold_hours: float
    gross_return: float
    net_return: float


def _parse_ts(ts_utc: str) -> datetime:
    return datetime.fromisoformat(ts_utc.replace("Z", "+00:00")).astimezone(timezone.utc)


def load_snapshots(path: str) -> List[Snapshot]:
    rows: List[Snapshot] = []
    with open(path, "r", encoding="utf-8") as f:
        for ln in f:
            ln = ln.strip()
            if not ln:
                continue
            try:
                d = json.loads(ln)
            except Exception:
                continue
            ts_raw = d.get("ts_utc")
            price = d.get("price")
            symbol = d.get("symbol")
            stage = d.get("stage")
            if not ts_raw or not symbol or stage is None:
                continue
            try:
                p = float(price)
                if not math.isfinite(p) or p <= 0:
                    continue
                rows.append(
                    Snapshot(
                        ts=_parse_ts(str(ts_raw)),
                        symbol=str(symbol),
                        price=p,
                        stage=str(stage),
                    )
                )
            except Exception:
                continue
    rows.sort(key=lambda x: x.ts)
    return rows


def _compute_trade(entry: Snapshot, exit_snap: Snapshot, fee_bps: float, reason: str) -> Trade:
    gross = (exit_snap.price / entry.price) - 1.0
    fee_round_trip = 2.0 * (fee_bps / 10_000.0)
    net = gross - fee_round_trip
    hold_hours = max(0.0, (exit_snap.ts - entry.ts).total_seconds() / 3600.0)
    return Trade(
        symbol=entry.symbol,
        entry_ts=entry.ts,
        exit_ts=exit_snap.ts,
        entry_price=entry.price,
        exit_price=exit_snap.price,
        entry_stage=entry.stage,
        exit_stage=exit_snap.stage,
        reason=reason,
        hold_hours=hold_hours,
        gross_return=gross,
        net_return=net,
    )


def backtest_symbol(
    rows: List[Snapshot],
    active_stages: set,
    wait_stage: str,
    max_hold_hours: float,
    fee_bps: float,
) -> List[Trade]:
    trades: List[Trade] = []
    open_entry: Optional[Snapshot] = None

    for snap in rows:
        if open_entry is None:
            if snap.stage in active_stages:
                open_entry = snap
            continue

        hold_h = (snap.ts - open_entry.ts).total_seconds() / 3600.0

        if snap.stage == wait_stage:
            trades.append(_compute_trade(open_entry, snap, fee_bps, reason="stage_wait"))
            open_entry = None
            continue

        if hold_h >= max_hold_hours:
            trades.append(_compute_trade(open_entry, snap, fee_bps, reason="timeout"))
            open_entry = None
            # abre novamente se continua ativo após timeout
            if snap.stage in active_stages:
                open_entry = snap

    if open_entry is not None and rows:
        trades.append(_compute_trade(open_entry, rows[-1], fee_bps, reason="forced_eod"))

    return trades


def summarize_trades(trades: List[Trade]) -> Dict[str, float]:
    if not trades:
        return {
            "trades": 0,
            "win_rate": 0.0,
            "avg_net_return": 0.0,
            "median_net_return": 0.0,
            "cum_net_return": 0.0,
            "profit_factor": 0.0,
            "avg_hold_hours": 0.0,
        }

    nets = [t.net_return for t in trades]
    wins = [x for x in nets if x > 0]
    losses = [x for x in nets if x < 0]

    nets_sorted = sorted(nets)
    mid = len(nets_sorted) // 2
    if len(nets_sorted) % 2 == 0:
        median = (nets_sorted[mid - 1] + nets_sorted[mid]) / 2.0
    else:
        median = nets_sorted[mid]

    gross_profit = sum(wins)
    gross_loss_abs = abs(sum(losses))
    if gross_loss_abs > 0:
        pf = gross_profit / gross_loss_abs
    else:
        pf = float("inf") if gross_profit > 0 else 0.0

    cum = 1.0
    for n in nets:
        cum *= (1.0 + n)
    cum -= 1.0

    return {
        "trades": len(trades),
        "win_rate": len(wins) / len(trades),
        "avg_net_return": sum(nets) / len(nets),
        "median_net_return": median,
        "cum_net_return": cum,
        "profit_factor": pf,
        "avg_hold_hours": sum(t.hold_hours for t in trades) / len(trades),
    }


def _pct(x: float) -> str:
    return f"{x * 100:.2f}%"


def _fmt_pf(x: float) -> str:
    if math.isinf(x):
        return "inf"
    return f"{x:.2f}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Backtest a partir dos logs JSONL do middleware")
    ap.add_argument("--logs", nargs="+", default=DEFAULT_LOG_FILES, help="Arquivos JSONL de entrada")
    ap.add_argument("--active-stages", default="SMALL,MEDIUM,FULL", help="Estágios que abrem posição")
    ap.add_argument("--wait-stage", default="WAIT", help="Estágio que fecha posição")
    ap.add_argument("--max-hold-hours", type=float, default=24.0, help="Tempo máximo de hold para fechar posição")
    ap.add_argument("--fee-bps", type=float, default=5.0, help="Taxa por lado em bps (round-trip = 2x)")
    ap.add_argument("--output", default="data/backtests/backtest_summary.json", help="Arquivo JSON de saída")
    args = ap.parse_args()

    active = {x.strip() for x in args.active_stages.split(",") if x.strip()}

    per_symbol: Dict[str, Dict[str, object]] = {}
    all_trades: List[Trade] = []

    for p in args.logs:
        if not os.path.exists(p):
            continue
        snaps = load_snapshots(p)
        if not snaps:
            continue
        sym = snaps[0].symbol
        trades = backtest_symbol(
            rows=snaps,
            active_stages=active,
            wait_stage=args.wait_stage,
            max_hold_hours=args.max_hold_hours,
            fee_bps=args.fee_bps,
        )
        stats = summarize_trades(trades)
        per_symbol[sym] = {
            "rows": len(snaps),
            "period": {
                "start": snaps[0].ts.isoformat().replace("+00:00", "Z"),
                "end": snaps[-1].ts.isoformat().replace("+00:00", "Z"),
            },
            "stats": stats,
            "trades": [
                {
                    **asdict(t),
                    "entry_ts": t.entry_ts.isoformat().replace("+00:00", "Z"),
                    "exit_ts": t.exit_ts.isoformat().replace("+00:00", "Z"),
                }
                for t in trades
            ],
        }
        all_trades.extend(trades)

    portfolio_stats = summarize_trades(all_trades)

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "config": {
            "active_stages": sorted(active),
            "wait_stage": args.wait_stage,
            "max_hold_hours": args.max_hold_hours,
            "fee_bps_per_side": args.fee_bps,
        },
        "symbols": per_symbol,
        "portfolio": portfolio_stats,
    }

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("=== Backtest Summary ===")
    print(f"config: active={sorted(active)} wait={args.wait_stage} max_hold_h={args.max_hold_hours} fee_bps={args.fee_bps}")
    for sym in sorted(per_symbol.keys()):
        st = per_symbol[sym]["stats"]
        print(
            f"{sym}: trades={st['trades']} win_rate={_pct(st['win_rate'])} "
            f"avg={_pct(st['avg_net_return'])} median={_pct(st['median_net_return'])} "
            f"cum={_pct(st['cum_net_return'])} pf={_fmt_pf(st['profit_factor'])} "
            f"avg_hold={st['avg_hold_hours']:.2f}h"
        )

    st = portfolio_stats
    print("--- portfolio ---")
    print(
        f"trades={st['trades']} win_rate={_pct(st['win_rate'])} "
        f"avg={_pct(st['avg_net_return'])} median={_pct(st['median_net_return'])} "
        f"cum={_pct(st['cum_net_return'])} pf={_fmt_pf(st['profit_factor'])} "
        f"avg_hold={st['avg_hold_hours']:.2f}h"
    )
    print(f"saved: {args.output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
