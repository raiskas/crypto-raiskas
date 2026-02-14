export type CryptoMiddlewareStage = "WAIT" | "SMALL" | "MEDIUM" | "FULL";

export interface MacroContext {
  badge: "risk_on" | "neutro" | "risk_off";
  macro_score: number;
  highlights: string[];
}

export interface CryptoMiddlewareSignal {
  symbol: string;
  stage: CryptoMiddlewareStage;
  score: number;
  price: number;
  rsi_1h: number;
  ema_50_1h: number;
  ema_200_1h: number;
  trend_4h: "bull" | "bear";
  trend_1w: "bull" | "bear";
  macro: MacroContext;
  highlights: string[];
  raw_payload: Record<string, unknown>;
}
