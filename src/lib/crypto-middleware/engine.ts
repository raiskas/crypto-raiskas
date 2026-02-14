import {
  CryptoMiddlewareSignal,
  CryptoMiddlewareStage,
  MacroContext,
} from "@/lib/crypto-middleware/types";

type SupportedSymbol = "BTCUSDT" | "ETHUSDT" | "XRPUSDT";

interface KrakenOhlcResponse {
  error: string[];
  result: Record<string, unknown>;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const KRAKEN_PAIRS: Record<SupportedSymbol, string> = {
  BTCUSDT: "XBTUSD",
  ETHUSDT: "ETHUSD",
  XRPUSDT: "XRPUSD",
};

const SUPPORTED_SYMBOLS: SupportedSymbol[] = ["BTCUSDT", "ETHUSDT", "XRPUSDT"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha em ${url}: ${response.status}`);
  }

  return (await response.json()) as T;
}

function parseKrakenCandles(payload: KrakenOhlcResponse): Candle[] {
  const resultKeys = Object.keys(payload.result).filter((key) => key !== "last");
  if (resultKeys.length === 0) {
    return [];
  }

  const firstKey = resultKeys[0];
  const rows = payload.result[firstKey] as unknown[];
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      if (!Array.isArray(row) || row.length < 7) {
        return null;
      }
      return {
        time: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[6]),
      } as Candle;
    })
    .filter((row): row is Candle => row !== null && Number.isFinite(row.close));
}

async function fetchOhlc(symbol: SupportedSymbol, intervalMinutes: number): Promise<Candle[]> {
  const pair = KRAKEN_PAIRS[symbol];
  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${intervalMinutes}`;
  const data = await fetchJson<KrakenOhlcResponse>(url);

  if (data.error.length > 0) {
    throw new Error(`Kraken retornou erro para ${symbol}: ${data.error.join(",")}`);
  }

  return parseKrakenCandles(data);
}

function ema(values: number[], period: number): number {
  if (values.length === 0) {
    return 0;
  }
  const alpha = 2 / (period + 1);
  let current = values[0];
  for (let i = 1; i < values.length; i += 1) {
    current = alpha * values[i] + (1 - alpha) * current;
  }
  return current;
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) {
    return 50;
  }

  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

async function buildMacroContext(): Promise<MacroContext> {
  const [globalData, btcMarket] = await Promise.all([
    fetchJson<{ data?: { market_cap_change_percentage_24h_usd?: number } }>(
      "https://api.coingecko.com/api/v3/global"
    ),
    fetchJson<
      Array<{
        price_change_percentage_24h?: number;
      }>
    >(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&sparkline=false"
    ),
  ]);

  const btc24h = btcMarket[0]?.price_change_percentage_24h ?? 0;
  const totalMcap24h = globalData.data?.market_cap_change_percentage_24h_usd ?? 0;

  let score = 50;
  score += btc24h >= 0 ? 10 : -10;
  score += totalMcap24h >= 0 ? 10 : -10;
  score = clamp(score, 0, 100);

  const badge = score >= 65 ? "risk_on" : score <= 35 ? "risk_off" : "neutro";
  const highlights = [
    `BTC 24h: ${btc24h.toFixed(2)}%`,
    `Market Cap global 24h: ${totalMcap24h.toFixed(2)}%`,
  ];

  return { badge, macro_score: score, highlights };
}

function decideStage(score: number): CryptoMiddlewareStage {
  if (score >= 75) return "FULL";
  if (score >= 62) return "MEDIUM";
  if (score >= 50) return "SMALL";
  return "WAIT";
}

function parseTrend(ema50: number, ema200: number): "bull" | "bear" {
  return ema50 >= ema200 ? "bull" : "bear";
}

export async function runCryptoMiddleware(symbols?: string[]): Promise<CryptoMiddlewareSignal[]> {
  const macro = await buildMacroContext();
  const symbolSet = new Set(
    (symbols ?? SUPPORTED_SYMBOLS).filter((value): value is SupportedSymbol =>
      SUPPORTED_SYMBOLS.includes(value as SupportedSymbol)
    )
  );

  if (symbolSet.size === 0) {
    symbolSet.add("BTCUSDT");
  }

  const results: CryptoMiddlewareSignal[] = [];

  for (const symbol of symbolSet) {
    const [candles1h, candles4h, candles1w] = await Promise.all([
      fetchOhlc(symbol, 60),
      fetchOhlc(symbol, 240),
      fetchOhlc(symbol, 10080),
    ]);

    if (candles1h.length < 220 || candles4h.length < 220 || candles1w.length < 60) {
      throw new Error(`Dados insuficientes para ${symbol}`);
    }

    const closes1h = candles1h.map((item) => item.close);
    const closes4h = candles4h.map((item) => item.close);
    const closes1w = candles1w.map((item) => item.close);

    const currentPrice = closes1h[closes1h.length - 1];
    const ema50_1h = ema(closes1h.slice(-220), 50);
    const ema200_1h = ema(closes1h.slice(-220), 200);
    const ema50_4h = ema(closes4h.slice(-220), 50);
    const ema200_4h = ema(closes4h.slice(-220), 200);
    const ema50_1w = ema(closes1w.slice(-220), 50);
    const ema200_1w = ema(closes1w.slice(-220), 200);
    const rsi_1h = rsi(closes1h.slice(-120), 14);

    const trend_4h = parseTrend(ema50_4h, ema200_4h);
    const trend_1w = parseTrend(ema50_1w, ema200_1w);

    let score = 50;
    score += trend_1w === "bull" ? 18 : -12;
    score += trend_4h === "bull" ? 16 : -10;
    score += currentPrice >= ema50_1h ? 8 : -6;
    score += rsi_1h >= 45 && rsi_1h <= 68 ? 8 : -4;
    score += (macro.macro_score - 50) * 0.5;
    score = clamp(score, 0, 100);

    const stage = decideStage(score);
    const highlights = [
      `Trend 1W: ${trend_1w.toUpperCase()}`,
      `Trend 4H: ${trend_4h.toUpperCase()}`,
      `RSI 1H: ${rsi_1h.toFixed(2)}`,
      `Macro: ${macro.badge} (${macro.macro_score.toFixed(1)})`,
    ];

    results.push({
      symbol,
      stage,
      score: Number(score.toFixed(2)),
      price: Number(currentPrice.toFixed(8)),
      rsi_1h: Number(rsi_1h.toFixed(2)),
      ema_50_1h: Number(ema50_1h.toFixed(8)),
      ema_200_1h: Number(ema200_1h.toFixed(8)),
      trend_4h,
      trend_1w,
      macro,
      highlights,
      raw_payload: {
        candles_1h: candles1h.length,
        candles_4h: candles4h.length,
        candles_1w: candles1w.length,
      },
    });
  }

  return results;
}
