import { NextResponse } from "next/server";
import { getAuthenticatedAppUser, ensurePermission } from "@/lib/crypto-middleware/auth";
import { getBacktestSummary } from "@/lib/crypto-middleware/data";

export async function GET() {
  const authUser = await getAuthenticatedAppUser();
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const canView = authUser.isMaster || (await ensurePermission(authUser.userId, "crypto_middleware_visualizar"));
  if (!canView) {
    return NextResponse.json({ error: "Sem permissão para visualizar o módulo." }, { status: 403 });
  }

  const data = await getBacktestSummary();
  if (!data) {
    return NextResponse.json({ error: "backtest_summary.json não encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}
