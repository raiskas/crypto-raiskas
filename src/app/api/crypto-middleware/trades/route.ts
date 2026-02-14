import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppUser, ensurePermission } from "@/lib/crypto-middleware/auth";
import { getBacktestSummary } from "@/lib/crypto-middleware/data";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedAppUser();
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const canView = authUser.isMaster || (await ensurePermission(authUser.userId, "crypto_middleware_visualizar"));
  if (!canView) {
    return NextResponse.json({ error: "Sem permissão para visualizar o módulo." }, { status: 403 });
  }

  const symbol = (request.nextUrl.searchParams.get("symbol") ?? "").toUpperCase();
  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "20";
  const limit = Math.max(1, Math.min(200, Number(limitRaw) || 20));

  const summary = await getBacktestSummary();
  const symbols = summary && typeof summary.symbols === "object" ? (summary.symbols as Record<string, any>) : {};

  if (symbol && symbols[symbol] && Array.isArray(symbols[symbol].trades)) {
    const trades = symbols[symbol].trades.slice(-limit);
    return NextResponse.json({ symbol, trades });
  }

  return NextResponse.json({ symbol, trades: [] });
}
