import unittest

from middleware import decide_stage


class DecideStageTests(unittest.TestCase):
    def test_full_when_1w_and_4h_up(self):
        stage = decide_stage(
            regime_1w="TENDÊNCIA DE ALTA",
            regime_4h="TENDÊNCIA DE ALTA",
            a1h=[],
            a4h=[],
            lvl={"signal_1h_bullish_trigger_strong": False, "signal_1h_fakeout_range4h": False},
            piv={"signal_4h_bullish_turn_strong": False, "signal_4h_bearish_turn_strong": False},
        )
        self.assertEqual(stage, "FULL")

    def test_wait_when_4h_bearish_turn_in_1w_up(self):
        stage = decide_stage(
            regime_1w="TENDÊNCIA DE ALTA",
            regime_4h="RANGE / CONSOLIDAÇÃO",
            a1h=[],
            a4h=[],
            lvl={"signal_1h_bullish_trigger_strong": True, "signal_1h_fakeout_range4h": False},
            piv={"signal_4h_bullish_turn_strong": False, "signal_4h_bearish_turn_strong": True},
        )
        self.assertEqual(stage, "WAIT")

    def test_small_when_bullish_1h_without_fakeout(self):
        stage = decide_stage(
            regime_1w="RANGE / TRANSIÇÃO",
            regime_4h="RANGE / CONSOLIDAÇÃO",
            a1h=[],
            a4h=[],
            lvl={"signal_1h_bullish_trigger_strong": True, "signal_1h_fakeout_range4h": False},
            piv={"signal_4h_bullish_turn_strong": False, "signal_4h_bearish_turn_strong": False},
        )
        self.assertEqual(stage, "SMALL")

    def test_wait_when_fakeout(self):
        stage = decide_stage(
            regime_1w="RANGE / TRANSIÇÃO",
            regime_4h="RANGE / CONSOLIDAÇÃO",
            a1h=[],
            a4h=[],
            lvl={"signal_1h_bullish_trigger_strong": True, "signal_1h_fakeout_range4h": True},
            piv={"signal_4h_bullish_turn_strong": False, "signal_4h_bearish_turn_strong": False},
        )
        self.assertEqual(stage, "WAIT")

    def test_text_fallback_still_works(self):
        stage = decide_stage(
            regime_1w="RANGE / TRANSIÇÃO",
            regime_4h="RANGE / CONSOLIDAÇÃO",
            a1h=["1H: breakout acima do topo do range 4H (vol ok)"],
            a4h=[],
            lvl=None,
            piv=None,
        )
        self.assertEqual(stage, "SMALL")

    def test_continuation_mode_enables_small_in_1w_up(self):
        stage = decide_stage(
            regime_1w="TENDÊNCIA DE ALTA",
            regime_4h="TENDÊNCIA DE BAIXA",
            a1h=[],
            a4h=[],
            lvl={"signal_1h_bullish_trigger_strong": False, "signal_1h_fakeout_range4h": False},
            piv={"signal_4h_bullish_turn_strong": False, "signal_4h_bearish_turn_strong": False},
            market_ctx={"continuation_ok": True},
        )
        self.assertEqual(stage, "SMALL")

    def test_continuation_mode_respects_fakeout_block(self):
        stage = decide_stage(
            regime_1w="TENDÊNCIA DE ALTA",
            regime_4h="TENDÊNCIA DE BAIXA",
            a1h=[],
            a4h=[],
            lvl={"signal_1h_bullish_trigger_strong": False, "signal_1h_fakeout_range4h": True},
            piv={"signal_4h_bullish_turn_strong": False, "signal_4h_bearish_turn_strong": False},
            market_ctx={"continuation_ok": True},
        )
        self.assertEqual(stage, "WAIT")

    def test_continuation_override_enables_small_in_1w_up(self):
        stage = decide_stage(
            regime_1w="TENDÊNCIA DE ALTA",
            regime_4h="TENDÊNCIA DE BAIXA",
            a1h=[],
            a4h=[],
            lvl={"signal_1h_bullish_trigger_strong": False, "signal_1h_fakeout_range4h": False},
            piv={"signal_4h_bullish_turn_strong": False, "signal_4h_bearish_turn_strong": False},
            market_ctx={"continuation_override_ok": True},
        )
        self.assertEqual(stage, "SMALL")

    def test_continuation_override_respects_fakeout_block(self):
        stage = decide_stage(
            regime_1w="TENDÊNCIA DE ALTA",
            regime_4h="TENDÊNCIA DE BAIXA",
            a1h=[],
            a4h=[],
            lvl={"signal_1h_bullish_trigger_strong": False, "signal_1h_fakeout_range4h": True},
            piv={"signal_4h_bullish_turn_strong": False, "signal_4h_bearish_turn_strong": False},
            market_ctx={"continuation_override_ok": True},
        )
        self.assertEqual(stage, "WAIT")


if __name__ == "__main__":
    unittest.main()
