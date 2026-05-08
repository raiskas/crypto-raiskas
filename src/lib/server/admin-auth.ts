import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getServiceRoleKey, supabaseConfig } from "@/lib/config";

export type AdminAuthContext = {
  authUserId: string;
  internalUser: {
    id: string;
    email: string;
    nome: string;
    empresa_id: string | null;
    ativo: boolean;
  };
  isMaster: boolean;
  serviceClient: ReturnType<typeof createClient<Database>>;
};

const createCookieClient = () => {
  const cookieStore = cookies();

  return createServerClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {}
      },
    },
  });
};

export const createServiceClient = () =>
  createClient<Database>(supabaseConfig.url, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

export async function getAdminAuthContext(): Promise<
  | { ok: true; context: AdminAuthContext }
  | { ok: false; status: number; error: string }
> {
  const cookieClient = createCookieClient();
  const {
    data: { session },
    error: sessionError,
  } = await cookieClient.auth.getSession();

  if (sessionError || !session?.user) {
    return {
      ok: false,
      status: 401,
      error: "Usuário não autenticado.",
    };
  }

  const serviceClient = createServiceClient();

  const { data: internalUser, error: userError } = await serviceClient
    .from("usuarios")
    .select("id, email, nome, empresa_id, ativo")
    .eq("auth_id", session.user.id)
    .single();

  if (userError || !internalUser) {
    return {
      ok: false,
      status: 403,
      error: "Perfil interno do usuário não encontrado.",
    };
  }

  const { data: masterGroups, error: groupError } = await serviceClient
    .from("usuarios_grupos")
    .select("grupo_id, grupos!inner(is_master)")
    .eq("usuario_id", internalUser.id)
    .eq("grupos.is_master", true)
    .limit(1);

  if (groupError) {
    return {
      ok: false,
      status: 500,
      error: "Erro ao validar permissões do usuário.",
    };
  }

  return {
    ok: true,
    context: {
      authUserId: session.user.id,
      internalUser,
      isMaster: (masterGroups?.length ?? 0) > 0,
      serviceClient,
    },
  };
}

export async function requireMasterUser() {
  const auth = await getAdminAuthContext();
  if (!auth.ok) return auth;

  if (!auth.context.internalUser.ativo) {
    return {
      ok: false as const,
      status: 403,
      error: "Usuário inativo.",
    };
  }

  if (!auth.context.isMaster) {
    return {
      ok: false as const,
      status: 403,
      error: "Apenas usuários master podem executar esta ação.",
    };
  }

  return auth;
}
