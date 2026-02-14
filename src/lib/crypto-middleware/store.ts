import { promises as fs } from "fs";
import path from "path";
import { CryptoMiddlewareSignal } from "@/lib/crypto-middleware/types";

interface LatestSignalsFile {
  generated_at: string;
  signals: CryptoMiddlewareSignal[];
}

const DATA_DIR = path.join(process.cwd(), "tools", "crypto-middleware", "data");
const LATEST_FILE = path.join(DATA_DIR, "signals_latest.json");
const HISTORY_FILE = path.join(DATA_DIR, "signals_history.jsonl");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function saveSignalsToLocalStore(signals: CryptoMiddlewareSignal[]) {
  await ensureDataDir();
  const generatedAt = new Date().toISOString();

  const latestPayload: LatestSignalsFile = {
    generated_at: generatedAt,
    signals,
  };

  await fs.writeFile(LATEST_FILE, JSON.stringify(latestPayload, null, 2), "utf-8");

  const historyLines = signals
    .map((signal) => JSON.stringify({ generated_at: generatedAt, ...signal }))
    .join("\n");

  if (historyLines.length > 0) {
    await fs.appendFile(HISTORY_FILE, `${historyLines}\n`, "utf-8");
  }

  return generatedAt;
}

export async function readLatestSignalsFromLocalStore(): Promise<LatestSignalsFile> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(LATEST_FILE, "utf-8");
    const parsed = JSON.parse(raw) as LatestSignalsFile;
    if (!Array.isArray(parsed.signals)) {
      return { generated_at: new Date(0).toISOString(), signals: [] };
    }
    return parsed;
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      return { generated_at: new Date(0).toISOString(), signals: [] };
    }
    throw error;
  }
}
