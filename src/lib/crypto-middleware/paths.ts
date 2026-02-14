import path from "path";
import fs from "fs";

function dirExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function hasJsonlLogs(baseDir: string): boolean {
  const logsDir = path.join(baseDir, "logs");
  if (!dirExists(logsDir)) return false;
  try {
    return fs.readdirSync(logsDir).some((name) => name.endsWith(".jsonl"));
  } catch {
    return false;
  }
}

function scoreBaseDir(baseDir: string): number {
  if (!dirExists(baseDir)) return -1;
  let score = 0;
  if (fileExists(path.join(baseDir, "middleware.py"))) score += 50;
  if (hasJsonlLogs(baseDir)) score += 30;
  if (fileExists(path.join(baseDir, "data", "trade_history.jsonl"))) score += 20;
  if (fileExists(path.join(baseDir, "data", "backtests", "backtest_summary.json"))) score += 15;
  if (fileExists(path.join(baseDir, "data", "backtests", "backtest_sweep.json"))) score += 15;
  return score;
}

function resolveCryptoMwBaseDir(): string {
  const homeDir = process.env.HOME || "";
  const candidates = [
    process.env.CRYPTO_MW_BASE_DIR || "",
    path.join(process.cwd(), "tools", "crypto-middleware"),
    homeDir ? path.join(homeDir, "crypto-middleware") : "",
  ].filter(Boolean);

  let bestDir = candidates[0];
  let bestScore = -1;
  for (const dir of candidates) {
    const currentScore = scoreBaseDir(dir);
    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestDir = dir;
    }
  }
  return bestDir || path.join(process.cwd(), "tools", "crypto-middleware");
}

export const CRYPTO_MW_BASE_DIR = resolveCryptoMwBaseDir();
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
