import { NextResponse } from "next/server";
import { getAuthenticatedAppUser, ensurePermission } from "@/lib/crypto-middleware/auth";
import { startRefreshRun } from "@/lib/crypto-middleware/refresh";

export async function POST() {
  const authUser = await getAuthenticatedAppUser();
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const canRun = authUser.isMaster || (await ensurePermission(authUser.userId, "crypto_middleware_executar"));
  if (!canRun) {
    return NextResponse.json({ error: "Sem permissão para executar refresh." }, { status: 403 });
  }

  const out = startRefreshRun();
  return NextResponse.json(out, { status: out.started ? 202 : 409 });
}
