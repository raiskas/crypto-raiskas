import { NextResponse } from "next/server";
import {
  ensurePermission,
  getAuthenticatedAppUser,
} from "@/lib/crypto-middleware/auth";
import { readLatestSignalsFromLocalStore } from "@/lib/crypto-middleware/store";

function normalizeSignal(signal: Record<string, unknown>, generatedAt: string) {
  const macroObj = (signal.macro ?? {}) as { badge?: string; macro_score?: number };
  return {
    id:
      (typeof signal.id === "string" && signal.id) ||
      `${String(signal.symbol ?? "UNKNOWN")}-${generatedAt}`,
    symbol: String(signal.symbol ?? ""),
    stage: String(signal.stage ?? "WAIT"),
    score: Number(signal.score ?? 0),
    price: Number(signal.price ?? 0),
    rsi_1h: Number(signal.rsi_1h ?? 0),
    ema_50_1h: Number(signal.ema_50_1h ?? 0),
    ema_200_1h: Number(signal.ema_200_1h ?? 0),
    trend_4h: String(signal.trend_4h ?? "bear"),
    trend_1w: String(signal.trend_1w ?? "bear"),
    macro_badge:
      String(signal.macro_badge ?? macroObj.badge ?? "neutro"),
    macro_score: Number(signal.macro_score ?? macroObj.macro_score ?? 0),
    highlights: (Array.isArray(signal.highlights) ? signal.highlights : []) as string[],
    criado_em: (typeof signal.criado_em === "string" ? signal.criado_em : generatedAt),
  };
}

export async function GET() {
  try {
    const authUser = await getAuthenticatedAppUser();
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const canView =
      authUser.isMaster ||
      (await ensurePermission(authUser.userId, "crypto_middleware_visualizar"));
    if (!canView) {
      return NextResponse.json(
        { error: "Sem permissão para visualizar o Crypto Middleware." },
        { status: 403 }
      );
    }

    const latest = await readLatestSignalsFromLocalStore();

    const normalizedSignals = (latest.signals as unknown[]).map((item) =>
      normalizeSignal(item as Record<string, unknown>, latest.generated_at)
    );

    return NextResponse.json({
      signals: normalizedSignals,
      generated_at: latest.generated_at,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao buscar sinais.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
