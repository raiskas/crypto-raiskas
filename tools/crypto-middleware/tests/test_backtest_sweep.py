import unittest
from datetime import datetime, timezone

from scripts.backtest_sweep import run_sweep


class BacktestSweepTests(unittest.TestCase):
    def test_run_sweep_has_expected_rows(self):
        # usa logs reais do projeto; se estiverem ausentes, o teste valida estrutura mínima
        out = run_sweep(
            logs=["logs/BTCUSDT.jsonl", "logs/ETHUSDT.jsonl", "logs/XRPUSDT.jsonl"],
            fee_bps=5.0,
            holds=[4.0, 8.0],
        )
        self.assertIn("results", out)
        # 2 cenários x 2 holds
        self.assertEqual(len(out["results"]), 4)
        self.assertIn("config", out)
        self.assertEqual(sorted(out["config"]["holds"]), [4.0, 8.0])


if __name__ == "__main__":
    unittest.main()
