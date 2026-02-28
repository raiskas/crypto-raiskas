import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/config";
import { Database } from "@/types/supabase";

const createSupabaseClient = () => {
  const cookieStore = cookies();
  return createServerClient<Database>(supabaseConfig.url!, supabaseConfig.serviceRoleKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
};

async function getInternalUserId(supabase: ReturnType<typeof createSupabaseClient>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Não autenticado", status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (profileError || !profile?.id) {
    return { error: "Perfil interno não encontrado", status: 404 as const };
  }

  return { userId: profile.id };
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();
  const db = supabase as any;

  try {
    const userResult = await getInternalUserId(supabase);
    if ("error" in userResult) {
      return NextResponse.json({ error: userResult.error }, { status: userResult.status });
    }

    const carteiraId = request.nextUrl.searchParams.get("carteira_id");
    if (!carteiraId) {
      return NextResponse.json({ error: "carteira_id é obrigatório" }, { status: 400 });
    }

    const { data: carteira, error: carteiraError } = await db
      .from("crypto_carteiras")
      .select("id, usuario_id")
      .eq("id", carteiraId)
      .eq("usuario_id", userResult.userId)
      .maybeSingle();

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    const { data, error } = await db
      .from("crypto_carteira_aportes")
      .select("*")
      .eq("carteira_id", carteiraId)
      .order("data_aporte", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error: "Tabela de aportes não encontrada. Execute a migração SQL de aportes.",
          details: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ aportes: data || [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();
  const db = supabase as any;

  try {
    const userResult = await getInternalUserId(supabase);
    if ("error" in userResult) {
      return NextResponse.json({ error: userResult.error }, { status: userResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const carteiraId = String(body.carteira_id || "");
    const valor = Number(body.valor ?? 0);
    const dataAporte = body.data_aporte ? String(body.data_aporte) : new Date().toISOString();
    const descricao = body.descricao ? String(body.descricao).trim() : null;

    if (!carteiraId) {
      return NextResponse.json({ error: "carteira_id é obrigatório" }, { status: 400 });
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "valor deve ser maior que zero" }, { status: 400 });
    }

    const { data: carteira, error: carteiraError } = await db
      .from("crypto_carteiras")
      .select("id, usuario_id")
      .eq("id", carteiraId)
      .eq("usuario_id", userResult.userId)
      .maybeSingle();

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    const { data, error } = await db
      .from("crypto_carteira_aportes")
      .insert({
        carteira_id: carteiraId,
        valor,
        data_aporte: dataAporte,
        descricao,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ aporte: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseClient();
  const db = supabase as any;

  try {
    const userResult = await getInternalUserId(supabase);
    if ("error" in userResult) {
      return NextResponse.json({ error: userResult.error }, { status: userResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const aporteId = String(body.id || "");
    const valor = Number(body.valor ?? 0);
    const dataAporte = body.data_aporte ? String(body.data_aporte) : null;
    const descricao = body.descricao ? String(body.descricao).trim() : null;

    if (!aporteId) {
      return NextResponse.json({ error: "id do aporte é obrigatório" }, { status: 400 });
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "valor deve ser maior que zero" }, { status: 400 });
    }

    const { data: aporteAtual, error: aporteErro } = await db
      .from("crypto_carteira_aportes")
      .select("id, carteira_id")
      .eq("id", aporteId)
      .maybeSingle();

    if (aporteErro || !aporteAtual) {
      return NextResponse.json({ error: "Aporte não encontrado" }, { status: 404 });
    }

    const { data: carteira, error: carteiraError } = await db
      .from("crypto_carteiras")
      .select("id, usuario_id")
      .eq("id", aporteAtual.carteira_id)
      .eq("usuario_id", userResult.userId)
      .maybeSingle();

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      valor,
      descricao,
      atualizado_em: new Date().toISOString(),
    };
    if (dataAporte) {
      updatePayload.data_aporte = dataAporte;
    }

    const { data, error } = await db
      .from("crypto_carteira_aportes")
      .update(updatePayload)
      .eq("id", aporteId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ aporte: data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseClient();
  const db = supabase as any;

  try {
    const userResult = await getInternalUserId(supabase);
    if ("error" in userResult) {
      return NextResponse.json({ error: userResult.error }, { status: userResult.status });
    }

    const aporteId = request.nextUrl.searchParams.get("id");
    if (!aporteId) {
      return NextResponse.json({ error: "id do aporte é obrigatório" }, { status: 400 });
    }

    const { data: aporteAtual, error: aporteErro } = await db
      .from("crypto_carteira_aportes")
      .select("id, carteira_id")
      .eq("id", aporteId)
      .maybeSingle();

    if (aporteErro || !aporteAtual) {
      return NextResponse.json({ error: "Aporte não encontrado" }, { status: 404 });
    }

    const { data: carteira, error: carteiraError } = await db
      .from("crypto_carteiras")
      .select("id, usuario_id")
      .eq("id", aporteAtual.carteira_id)
      .eq("usuario_id", userResult.userId)
      .maybeSingle();

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    const { error } = await db
      .from("crypto_carteira_aportes")
      .delete()
      .eq("id", aporteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
