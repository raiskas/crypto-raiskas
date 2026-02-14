#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "data" / "backtests" / "backtest_summary.json"
DST = BASE / "data" / "trade_history.jsonl"


def main() -> int:
    if not SRC.exists():
        print(f"source not found: {SRC}")
        return 1

    data = json.loads(SRC.read_text(encoding="utf-8"))
    symbols = data.get("symbols") if isinstance(data.get("symbols"), dict) else {}

    events = []
    for sym, payload in symbols.items():
        trades = payload.get("trades") if isinstance(payload, dict) else None
        if not isinstance(trades, list):
            continue
        for t in trades:
            entry_ts = t.get("entry_ts")
            exit_ts = t.get("exit_ts")
            entry_price = t.get("entry_price")
            exit_price = t.get("exit_price")
            if entry_ts and entry_price is not None:
                events.append(
                    {
                        "ts_utc": entry_ts,
                        "symbol": sym,
                        "side": "BUY",
                        "signal_type": "BACKFILL_ENTRY",
                        "stage": t.get("entry_stage"),
                        "entry_price": entry_price,
                        "current_price": entry_price,
                    }
                )
            if exit_ts and exit_price is not None:
                events.append(
                    {
                        "ts_utc": exit_ts,
                        "symbol": sym,
                        "side": "SELL",
                        "signal_type": "BACKFILL_EXIT",
                        "stage": t.get("exit_stage"),
                        "entry_price": entry_price,
                        "exit_price": exit_price,
                        "realized_profit_pct": (float(t.get("net_return", 0.0)) * 100.0),
                    }
                )

    events.sort(key=lambda x: x.get("ts_utc", ""))
    DST.parent.mkdir(parents=True, exist_ok=True)
    with DST.open("w", encoding="utf-8") as f:
        for ev in events:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    print(f"wrote {len(events)} events to {DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
