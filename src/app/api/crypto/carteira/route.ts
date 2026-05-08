import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getServiceRoleKey, supabaseConfig } from "@/lib/config";
import { Database } from "@/types/supabase";

const createSupabaseClient = () => {
  const cookieStore = cookies();
  return createServerClient<Database>(supabaseConfig.url!, getServiceRoleKey(), {
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

type CarteiraDb = {
  id: string;
  usuario_id: string;
  nome: string;
  valor_inicial: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
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
    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true";

    let carteirasQuery = db
      .from("crypto_carteiras")
      .select("*")
      .eq("usuario_id", userResult.userId);

    if (!includeInactive) {
      carteirasQuery = carteirasQuery.eq("ativo", true);
    }

    const { data: carteiras, error } = await carteirasQuery.order("criado_em", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error:
            "Tabela de carteiras não encontrada. Execute a migração SQL de carteira (crypto_carteiras).",
          details: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    const listaCarteiras = (carteiras || []) as CarteiraDb[];
    const carteirasAtivas = listaCarteiras.filter((item) => item.ativo);

    if (carteirasAtivas.length === 0) {
      return NextResponse.json({ carteira: null, carteiras: listaCarteiras, aportes: [] }, { status: 200 });
    }

    const carteiraSelecionada =
      (carteiraId ? carteirasAtivas.find((item) => item.id === carteiraId) : null) || carteirasAtivas[0];

    const { data: aportesData, error: aportesError } = await db
      .from("crypto_carteira_aportes")
      .select("*")
      .eq("carteira_id", carteiraSelecionada.id)
      .order("data_aporte", { ascending: true });

    if (aportesError) {
      return NextResponse.json(
        {
          carteira: carteiraSelecionada,
          carteiras: listaCarteiras,
          aportes: [],
          warning:
            "Tabela de aportes não encontrada. Execute a migração SQL de aportes para habilitar aportes futuros.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { carteira: carteiraSelecionada, carteiras: listaCarteiras, aportes: aportesData || [] },
      { status: 200 }
    );
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
    const nome = typeof body.nome === "string" && body.nome.trim() ? body.nome.trim() : "Carteira Principal";
    const valorInicial = Number(body.valor_inicial ?? 0);
    if (!Number.isFinite(valorInicial) || valorInicial < 0) {
      return NextResponse.json({ error: "valor_inicial inválido" }, { status: 400 });
    }

    const { data: created, error: createError } = await db
      .from("crypto_carteiras")
      .insert({
        usuario_id: userResult.userId,
        nome,
        valor_inicial: valorInicial,
        ativo: true,
      })
      .select("*")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({ carteira: created as CarteiraDb }, { status: 201 });
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
    const carteiraId = typeof body.id === "string" ? body.id.trim() : "";

    if (!carteiraId) {
      return NextResponse.json({ error: "id da carteira é obrigatório" }, { status: 400 });
    }

    const { data: carteiraAtual, error: carteiraError } = await db
      .from("crypto_carteiras")
      .select("*")
      .eq("id", carteiraId)
      .eq("usuario_id", userResult.userId)
      .maybeSingle();

    if (carteiraError || !carteiraAtual) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      atualizado_em: new Date().toISOString(),
    };

    if (typeof body.nome === "string" && body.nome.trim()) {
      updatePayload.nome = body.nome.trim();
    }

    if (body.valor_inicial !== undefined) {
      const valorInicial = Number(body.valor_inicial);
      if (!Number.isFinite(valorInicial) || valorInicial < 0) {
        return NextResponse.json({ error: "valor_inicial inválido" }, { status: 400 });
      }
      updatePayload.valor_inicial = valorInicial;
    }

    if (body.ativo !== undefined) {
      updatePayload.ativo = Boolean(body.ativo);
    }

    const { data: updated, error: updateError } = await db
      .from("crypto_carteiras")
      .update(updatePayload)
      .eq("id", carteiraId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ carteira: updated as CarteiraDb }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
