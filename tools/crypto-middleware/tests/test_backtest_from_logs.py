import unittest
from datetime import datetime, timezone, timedelta

from scripts.backtest_from_logs import Snapshot, backtest_symbol, summarize_trades


class BacktestFromLogsTests(unittest.TestCase):
    def test_stage_wait_exit(self):
        t0 = datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc)
        rows = [
            Snapshot(ts=t0, symbol="BTCUSDT", price=100.0, stage="WAIT"),
            Snapshot(ts=t0 + timedelta(hours=1), symbol="BTCUSDT", price=101.0, stage="SMALL"),
            Snapshot(ts=t0 + timedelta(hours=2), symbol="BTCUSDT", price=103.0, stage="SMALL"),
            Snapshot(ts=t0 + timedelta(hours=3), symbol="BTCUSDT", price=104.0, stage="WAIT"),
        ]
        trades = backtest_symbol(rows, {"SMALL", "MEDIUM", "FULL"}, "WAIT", 24.0, 0.0)
        self.assertEqual(len(trades), 1)
        self.assertEqual(trades[0].reason, "stage_wait")
        self.assertAlmostEqual(trades[0].gross_return, 104.0 / 101.0 - 1.0, places=8)

    def test_timeout_exit(self):
        t0 = datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc)
        rows = [
            Snapshot(ts=t0, symbol="ETHUSDT", price=200.0, stage="SMALL"),
            Snapshot(ts=t0 + timedelta(hours=10), symbol="ETHUSDT", price=210.0, stage="SMALL"),
            Snapshot(ts=t0 + timedelta(hours=26), symbol="ETHUSDT", price=220.0, stage="SMALL"),
        ]
        trades = backtest_symbol(rows, {"SMALL", "MEDIUM", "FULL"}, "WAIT", 24.0, 0.0)
        self.assertEqual(len(trades), 2)
        self.assertEqual(trades[0].reason, "timeout")
        self.assertEqual(trades[1].reason, "forced_eod")

    def test_summary_values(self):
        t0 = datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc)
        rows = [
            Snapshot(ts=t0, symbol="XRPUSDT", price=1.0, stage="SMALL"),
            Snapshot(ts=t0 + timedelta(hours=1), symbol="XRPUSDT", price=1.1, stage="WAIT"),
            Snapshot(ts=t0 + timedelta(hours=2), symbol="XRPUSDT", price=1.0, stage="SMALL"),
            Snapshot(ts=t0 + timedelta(hours=3), symbol="XRPUSDT", price=0.9, stage="WAIT"),
        ]
        trades = backtest_symbol(rows, {"SMALL", "MEDIUM", "FULL"}, "WAIT", 24.0, 0.0)
        stats = summarize_trades(trades)
        self.assertEqual(stats["trades"], 2)
        self.assertAlmostEqual(stats["win_rate"], 0.5, places=8)


if __name__ == "__main__":
    unittest.main()
