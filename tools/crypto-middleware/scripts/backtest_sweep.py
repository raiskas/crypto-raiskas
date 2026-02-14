#!/usr/bin/env python3
"""
Sweep de parâmetros para o backtest baseado nos logs do middleware.

Cenários padrão:
- Stage set: SMALL
- Stage set: SMALL,MEDIUM,FULL
- Max hold hours: 4, 8, 24, 48
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

# Permite executar como script direto: python3 scripts/backtest_sweep.py
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.backtest_from_logs import (
    DEFAULT_LOG_FILES,
    backtest_symbol,
    load_snapshots,
    summarize_trades,
)


def _fmt_pct(x: float) -> str:
    return f"{x * 100:.2f}%"


def _fmt_pf(x: float) -> str:
    if x == float("inf"):
        return "inf"
    return f"{x:.2f}"


def run_sweep(logs: List[str], fee_bps: float, holds: List[float]) -> Dict[str, object]:
    symbols_data = {}
    for path in logs:
        if not os.path.exists(path):
            continue
        snaps = load_snapshots(path)
        if not snaps:
            continue
        symbols_data[snaps[0].symbol] = snaps

    scenarios = {
        "small_only": {"SMALL"},
        "small_medium_full": {"SMALL", "MEDIUM", "FULL"},
    }

    rows = []
    for scenario_name, active in scenarios.items():
        for hold in holds:
            all_trades = []
            per_symbol_stats = {}
            for sym, snaps in symbols_data.items():
                trades = backtest_symbol(
                    rows=snaps,
                    active_stages=active,
                    wait_stage="WAIT",
                    max_hold_hours=hold,
                    fee_bps=fee_bps,
                )
                stats = summarize_trades(trades)
                per_symbol_stats[sym] = stats
                all_trades.extend(trades)

            portfolio = summarize_trades(all_trades)
            rows.append(
                {
                    "scenario": scenario_name,
                    "active_stages": sorted(active),
                    "max_hold_hours": hold,
                    "portfolio": portfolio,
                    "symbols": per_symbol_stats,
                }
            )

    rows.sort(
        key=lambda r: (
            -r["portfolio"]["cum_net_return"],
            -r["portfolio"]["profit_factor"] if r["portfolio"]["profit_factor"] != float("inf") else -999.0,
            -r["portfolio"]["win_rate"],
        )
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "config": {
            "fee_bps_per_side": fee_bps,
            "holds": holds,
            "scenarios": {k: sorted(v) for k, v in scenarios.items()},
            "logs": logs,
        },
        "results": rows,
    }


def to_markdown(data: Dict[str, object]) -> str:
    lines = []
    lines.append("# Backtest Sweep Report")
    lines.append("")
    lines.append(f"Generated at: {data['generated_at']}")
    lines.append("")
    cfg = data["config"]
    lines.append(f"Fee (bps/side): {cfg['fee_bps_per_side']}")
    lines.append(f"Holds tested (h): {', '.join(str(x) for x in cfg['holds'])}")
    lines.append("")
    lines.append("## Ranking (portfolio)")
    lines.append("")
    lines.append("| Rank | Scenario | Hold(h) | Trades | Win Rate | Avg Net | Cum Net | PF | Avg Hold |")
    lines.append("|---:|---|---:|---:|---:|---:|---:|---:|---:|")

    for i, row in enumerate(data["results"], start=1):
        p = row["portfolio"]
        lines.append(
            "| {rank} | {sc} | {hold:.0f} | {tr} | {wr} | {avg} | {cum} | {pf} | {ah:.2f}h |".format(
                rank=i,
                sc=row["scenario"],
                hold=row["max_hold_hours"],
                tr=p["trades"],
                wr=_fmt_pct(p["win_rate"]),
                avg=_fmt_pct(p["avg_net_return"]),
                cum=_fmt_pct(p["cum_net_return"]),
                pf=_fmt_pf(p["profit_factor"]),
                ah=p["avg_hold_hours"],
            )
        )

    lines.append("")
    lines.append("## Best Scenario by Symbol")
    lines.append("")

    # picks best per symbol by cum return inside all rows
    symbols = set()
    for row in data["results"]:
        symbols.update(row["symbols"].keys())

    for sym in sorted(symbols):
        best = None
        for row in data["results"]:
            st = row["symbols"].get(sym)
            if not st:
                continue
            key = (st["cum_net_return"], st["profit_factor"], st["win_rate"])
            if best is None or key > best[0]:
                best = (key, row, st)
        if best is None:
            continue
        _, row, st = best
        lines.append(
            "- {sym}: {sc} @ {hold:.0f}h | trades={tr} | win_rate={wr} | cum={cum} | pf={pf}".format(
                sym=sym,
                sc=row["scenario"],
                hold=row["max_hold_hours"],
                tr=st["trades"],
                wr=_fmt_pct(st["win_rate"]),
                cum=_fmt_pct(st["cum_net_return"]),
                pf=_fmt_pf(st["profit_factor"]),
            )
        )

    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Varre parâmetros de backtest")
    ap.add_argument("--logs", nargs="+", default=DEFAULT_LOG_FILES)
    ap.add_argument("--fee-bps", type=float, default=5.0)
    ap.add_argument("--holds", default="4,8,24,48", help="Holds em horas, CSV")
    ap.add_argument("--json-output", default="data/backtests/backtest_sweep.json")
    ap.add_argument("--md-output", default="data/backtests/backtest_sweep_report.md")
    args = ap.parse_args()

    holds = []
    for x in args.holds.split(","):
        x = x.strip()
        if not x:
            continue
        holds.append(float(x))

    result = run_sweep(args.logs, fee_bps=args.fee_bps, holds=holds)

    os.makedirs(os.path.dirname(args.json_output), exist_ok=True)
    with open(args.json_output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    report = to_markdown(result)
    os.makedirs(os.path.dirname(args.md_output), exist_ok=True)
    with open(args.md_output, "w", encoding="utf-8") as f:
        f.write(report)

    print(report)
    print(f"saved json: {args.json_output}")
    print(f"saved md: {args.md_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
