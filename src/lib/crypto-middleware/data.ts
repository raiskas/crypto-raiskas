import { promises as fs } from "fs";
import path from "path";
import { CRYPTO_MW_FILES, CRYPTO_MW_LOG_DIR, DEFAULT_SYMBOLS } from "@/lib/crypto-middleware/paths";

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readJsonlFile(filePath: string, limit = 2000): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((row): row is Record<string, unknown> => !!row);
    return rows.slice(-limit);
  } catch {
    return [];
  }
}

async function readLastJsonlRow(filePath: string): Promise<Record<string, unknown> | null> {
  const rows = await readJsonlFile(filePath, 1);
  return rows.length ? rows[rows.length - 1] : null;
}

export async function getBacktestSummary() {
  return readJsonFile<Record<string, unknown>>(CRYPTO_MW_FILES.backtestSummary);
}

export async function getBacktestSweep() {
  return readJsonFile<Record<string, unknown>>(CRYPTO_MW_FILES.backtestSweep);
}

export async function getLivePayload() {
  const symbols: Record<string, unknown> = {};

  for (const symbol of DEFAULT_SYMBOLS) {
    const row = await readLastJsonlRow(path.join(CRYPTO_MW_LOG_DIR, `${symbol}.jsonl`));
    if (!row) continue;

    const rr = (row.rr_range_4h ?? {}) as Record<string, unknown>;
    const context = (row.context_score ?? {}) as Record<string, unknown>;
    const vol = (row.volume ?? {}) as Record<string, unknown>;

    symbols[symbol] = {
      ts_utc: row.ts_utc ?? null,
      price: toNumber(row.price),
      stage: String(row.stage ?? "WAIT"),
      regime_1w: String(row.regime_1w ?? ""),
      regime_4h: String(row.regime_4h ?? ""),
      vol1_ratio: toNumber(vol.vol1_ratio),
      vol4_ratio: toNumber(vol.vol4_ratio),
      context_score: toNumber(context.value),
      rr_adj: toNumber(rr.rr_adj),
      rr_atr: toNumber(rr.rr_atr),
      rr_up_pct: toNumber(rr.upside_pct),
      rr_down_pct: toNumber(rr.downside_pct),
    };
  }

  return {
    generated_at: new Date().toISOString(),
    symbols,
  };
}

function inferImpact(title: string): "alto" | "médio" | "baixo" {
  const t = title.toLowerCase();
  if (/(fed|fomc|powell|cpi|inflation|war|conflict|sanction|regulation|sec)/.test(t)) return "alto";
  if (/(yield|treasury|bank|dollar|oil|gdp|employment)/.test(t)) return "médio";
  return "baixo";
}

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/(fed|fomc|powell|yield|treasury|interest rate)/.test(t)) return "Juros/Fed";
  if (/(cpi|inflation|ppi|prices)/.test(t)) return "Inflação";
  if (/(war|conflict|sanction|attack|geopolitical)/.test(t)) return "Geopolítica";
  if (/(sec|regulation|regulatory|law|ban|etf)/.test(t)) return "Regulação";
  if (/(bank|liquidity|credit|dollar|funding)/.test(t)) return "Liquidez";
  return "Mercado Global";
}

export async function getGlobalNewsPayload() {
  const payload = {
    generated_at: new Date().toISOString(),
    status: "sem_dados",
    macro: {
      badge: "🟡",
      macro_score: null as number | null,
      posture: "sem_dados",
      updated_ts: null as string | null,
    },
    headlines: [] as Array<Record<string, unknown>>,
    top_risks: [] as Array<Record<string, unknown>>,
    watchlist: [] as string[],
    notes: [] as string[],
  };

  const cache = await readJsonFile<Record<string, unknown>>(CRYPTO_MW_FILES.macroContextCache);
  const cacheData = cache && typeof cache.data === "object" ? (cache.data as Record<string, unknown>) : cache;
  if (cacheData && typeof cacheData === "object") {
    payload.status = "ok";
    payload.macro.badge = String(cacheData.badge ?? "🟡");
    payload.macro.macro_score = toNumber(cacheData.macro_score);
    payload.macro.posture = String(cacheData.posture ?? "sem_dados");
    if (typeof cache?.ts === "number") {
      payload.macro.updated_ts = new Date(cache.ts * 1000).toISOString();
    }
    const highlights = Array.isArray(cacheData.highlights) ? cacheData.highlights : [];
    const enriched = highlights
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .map((title) => ({
        title,
        impact: inferImpact(title),
        category: inferCategory(title),
      }));
    payload.headlines = enriched.slice(0, 20);
    payload.top_risks = enriched.slice(0, 5);
  }

  if (!payload.top_risks.length) {
    const fallbackHighlights: string[] = [];
    for (const symbol of DEFAULT_SYMBOLS) {
      const row = await readLastJsonlRow(path.join(CRYPTO_MW_LOG_DIR, `${symbol}.jsonl`));
      if (!row) continue;
      const bullets = Array.isArray(row.macro_bullets) ? row.macro_bullets : [];
      for (const bullet of bullets) {
        const title = String(bullet ?? "").trim();
        if (!title) continue;
        if (!fallbackHighlights.includes(title)) {
          fallbackHighlights.push(title);
        }
      }
      if (fallbackHighlights.length >= 20) break;
    }

    if (fallbackHighlights.length) {
      const enriched = fallbackHighlights.map((title) => ({
        title,
        impact: inferImpact(title),
        category: inferCategory(title),
      }));
      payload.status = "ok";
      payload.headlines = enriched.slice(0, 20);
      payload.top_risks = enriched.slice(0, 5);
      payload.notes.push("Fallback local ativo: usando macro_bullets dos logs.");
    }
  }

  if (!payload.top_risks.length) {
    payload.watchlist.push("Rodar middleware.py para atualizar cache macro e headlines.");
  } else {
    payload.watchlist.push("Monitorar top riscos antes de aumentar exposição.");
  }

  return payload;
}

export async function getRecentTradesPayload(symbol = "", limit = 50) {
  const rows = await readJsonlFile(CRYPTO_MW_FILES.tradeHistory, 5000);
  const sym = symbol.trim().toUpperCase();
  const filtered = rows.filter((row) => !sym || String(row.symbol ?? "").toUpperCase() === sym);

  const trades = filtered
    .map((row) => ({
      symbol: String(row.symbol ?? ""),
      side: String(row.side ?? ""),
      status: String(row.status ?? row.side ?? "OPEN"),
      ts_utc: String(row.ts_utc ?? ""),
      entry_price: toNumber(row.entry_price),
      exit_price: toNumber(row.exit_price),
      realized_profit_pct: toNumber(row.realized_profit_pct),
      expected_profit_pct: toNumber(row.expected_profit_pct),
      stage: row.stage ?? null,
      signal_type: row.signal_type ?? null,
    }))
    .slice(-limit)
    .reverse();

  return {
    symbol: sym || "ALL",
    count: trades.length,
    trades,
    source: CRYPTO_MW_FILES.tradeHistory,
  };
}
