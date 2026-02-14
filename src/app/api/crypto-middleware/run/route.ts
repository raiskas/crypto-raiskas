import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runCryptoMiddleware } from "@/lib/crypto-middleware/engine";
import {
  ensurePermission,
  getAuthenticatedAppUser,
} from "@/lib/crypto-middleware/auth";
import { saveSignalsToLocalStore } from "@/lib/crypto-middleware/store";

const requestSchema = z.object({
  symbols: z.array(z.string().min(3).max(20)).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedAppUser();
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const canRun =
      authUser.isMaster ||
      (await ensurePermission(authUser.userId, "crypto_middleware_executar"));
    if (!canRun) {
      return NextResponse.json(
        { error: "Sem permissão para executar o Crypto Middleware." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const payload = requestSchema.parse(body);
    const signals = await runCryptoMiddleware(payload.symbols);
    const generatedAt = await saveSignalsToLocalStore(signals);
    const normalizedSignals = signals.map((signal) => ({
      id: `${signal.symbol}-${generatedAt}`,
      symbol: signal.symbol,
      stage: signal.stage,
      score: signal.score,
      price: signal.price,
      rsi_1h: signal.rsi_1h,
      ema_50_1h: signal.ema_50_1h,
      ema_200_1h: signal.ema_200_1h,
      trend_4h: signal.trend_4h,
      trend_1w: signal.trend_1w,
      macro_badge: signal.macro.badge,
      macro_score: signal.macro.macro_score,
      highlights: signal.highlights ?? [],
      criado_em: generatedAt,
    }));
    return NextResponse.json({ signals: normalizedSignals, generated_at: generatedAt }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Payload inválido.", details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Erro interno ao executar middleware.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
