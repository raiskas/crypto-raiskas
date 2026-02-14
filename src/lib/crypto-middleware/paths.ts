import path from "path";

export const CRYPTO_MW_BASE_DIR = path.join(process.cwd(), "tools", "crypto-middleware");
export const CRYPTO_MW_LOG_DIR = path.join(CRYPTO_MW_BASE_DIR, "logs");
export const CRYPTO_MW_DATA_DIR = path.join(CRYPTO_MW_BASE_DIR, "data");
export const CRYPTO_MW_BACKTEST_DIR = path.join(CRYPTO_MW_DATA_DIR, "backtests");
export const CRYPTO_MW_CACHE_DIR = path.join(CRYPTO_MW_BASE_DIR, "cache");

export const CRYPTO_MW_FILES = {
  signalsLatest: path.join(CRYPTO_MW_DATA_DIR, "signals_latest.json"),
  signalsHistory: path.join(CRYPTO_MW_DATA_DIR, "signals_history.jsonl"),
  tradeHistory: path.join(CRYPTO_MW_DATA_DIR, "trade_history.jsonl"),
  backtestSummary: path.join(CRYPTO_MW_BACKTEST_DIR, "backtest_summary.json"),
  backtestSweep: path.join(CRYPTO_MW_BACKTEST_DIR, "backtest_sweep.json"),
  macroContextCache: path.join(CRYPTO_MW_CACHE_DIR, "macro_context.json"),
} as const;

export const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "XRPUSDT"] as const;
