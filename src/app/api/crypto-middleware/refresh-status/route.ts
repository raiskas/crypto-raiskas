import { NextResponse } from "next/server";
import { getAuthenticatedAppUser, ensurePermission } from "@/lib/crypto-middleware/auth";
import { getRefreshStatus } from "@/lib/crypto-middleware/refresh";

export async function GET() {
  const authUser = await getAuthenticatedAppUser();
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const canRun = authUser.isMaster || (await ensurePermission(authUser.userId, "crypto_middleware_executar"));
  if (!canRun) {
    return NextResponse.json({ error: "Sem permissão para consultar refresh." }, { status: 403 });
  }

  return NextResponse.json(getRefreshStatus());
}
