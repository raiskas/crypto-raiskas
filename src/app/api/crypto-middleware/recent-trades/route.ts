import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppUser, ensurePermission } from "@/lib/crypto-middleware/auth";
import { getRecentTradesPayload } from "@/lib/crypto-middleware/data";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedAppUser();
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const canView = authUser.isMaster || (await ensurePermission(authUser.userId, "crypto_middleware_visualizar"));
  if (!canView) {
    return NextResponse.json({ error: "Sem permissão para visualizar o módulo." }, { status: 403 });
  }

  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "50";
  const limit = Math.max(1, Math.min(500, Number(limitRaw) || 50));
  const payload = await getRecentTradesPayload(symbol, limit);
  return NextResponse.json(payload);
}
