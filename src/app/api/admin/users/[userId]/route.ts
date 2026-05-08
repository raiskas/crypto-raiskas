import { NextResponse } from "next/server";
import { requireMasterUser } from "@/lib/server/admin-auth";

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const auth = await requireMasterUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userIdToFetch = params.userId;

  const { data: userDataFromDb, error: dbError } = await auth.context.serviceClient
    .from("usuarios")
    .select("id, nome, email, auth_id, empresa_id, ativo")
    .eq("auth_id", userIdToFetch)
    .single();

  if (dbError) {
    if (dbError.code === "PGRST116") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json(userDataFromDb);
}
