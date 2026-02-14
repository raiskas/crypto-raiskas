import unittest

from middleware import (
    assess_ohlcv_quality,
    data_quality_assessment,
    risk_capital_pct_from_stage,
)


def _mk_candles(count: int, step_ms: int, start_ms: int = 0):
    out = []
    px = 100.0
    for i in range(count):
        t0 = start_ms + (i * step_ms)
        c = px + 0.1
        out.append(
            {
                "open_time": t0,
                "open": px,
                "high": c + 0.2,
                "low": px - 0.2,
                "close": c,
                "volume": 10.0,
                "close_time": t0 + step_ms - 1,
            }
        )
        px = c
    return out


class ReliabilityGuardsTests(unittest.TestCase):
    def test_assess_ohlcv_quality_high_for_clean_series(self):
        k = _mk_candles(160, 60 * 60 * 1000)
        score, issues = assess_ohlcv_quality("1H", k, min_bars=120, expected_step_ms=60 * 60 * 1000)
        self.assertGreaterEqual(score, 95)
        self.assertEqual(issues, [])

    def test_assess_ohlcv_quality_penalizes_invalid_and_short(self):
        k = _mk_candles(20, 60 * 60 * 1000)
        k[5]["high"] = k[5]["low"] - 1.0  # inválido
        score, issues = assess_ohlcv_quality("1H", k, min_bars=120, expected_step_ms=60 * 60 * 1000)
        self.assertLess(score, 70)
        self.assertTrue(any("histórico curto" in x for x in issues))
        self.assertTrue(any("candles inválidos" in x for x in issues))

    def test_data_quality_assessment_returns_weighted_score(self):
        k1h = _mk_candles(120, 60 * 60 * 1000)
        k4h = _mk_candles(180, 4 * 60 * 60 * 1000)
        k1w = _mk_candles(80, 7 * 24 * 60 * 60 * 1000)
        score, issues, detail = data_quality_assessment(k1h, k4h, k1w)
        self.assertGreaterEqual(score, 95)
        self.assertEqual(issues, [])
        self.assertGreaterEqual(detail.get("score_1h", 0), 95)
        self.assertGreaterEqual(detail.get("score_4h", 0), 95)
        self.assertGreaterEqual(detail.get("score_1w", 0), 95)

    def test_risk_capital_pct_from_stage(self):
        # SMALL BTC: 30% alvo * 0.2 = 6% aloc; risco downside 5% => 0.30% do capital.
        r = risk_capital_pct_from_stage("BTCUSDT", "SMALL", 5.0)
        self.assertAlmostEqual(r, 0.30, places=6)
        self.assertEqual(risk_capital_pct_from_stage("BTCUSDT", "WAIT", 5.0), 0.0)
        self.assertEqual(risk_capital_pct_from_stage("BTCUSDT", "SMALL", None), 0.0)


if __name__ == "__main__":
    unittest.main()
