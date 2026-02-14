import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { supabaseConfig } from "@/lib/config";
import { hasPermission } from "@/lib/utils/permissions";

export interface AuthenticatedAppUser {
  authId: string;
  userId: string;
  isMaster: boolean;
}

function createAuthClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
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
}

export function createServiceClient() {
  return createClient<Database>(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getAuthenticatedAppUser(): Promise<AuthenticatedAppUser | null> {
  const authClient = createAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const serviceClient = createServiceClient();
  const { data: appUser, error: userError } = await serviceClient
    .from("usuarios")
    .select("id, is_master")
    .eq("auth_id", user.id)
    .single();

  if (userError || !appUser) {
    return null;
  }

  return { authId: user.id, userId: appUser.id, isMaster: appUser.is_master === true };
}

export async function ensurePermission(userId: string, permissionName: string): Promise<boolean> {
  const serviceClient = createServiceClient();

  // 1) Respeitar padrão de grupo master / telas_permitidas (conforme docs)
  const { data: userGroups, error: groupsError } = await serviceClient
    .from("usuarios_grupos")
    .select("grupo_id, grupos!inner(is_master, telas_permitidas)")
    .eq("usuario_id", userId);

  if (!groupsError && userGroups && userGroups.length > 0) {
    const groups = userGroups
      .map((item) => item.grupos)
      .filter((group): group is { is_master: boolean; telas_permitidas: string[] } => !!group);

    if (groups.some((group) => group.is_master === true)) {
      return true;
    }

    const allowedScreens = new Set(
      groups.flatMap((group) => group.telas_permitidas || []).map((screen) => String(screen).trim())
    );

    const hasCryptoMiddlewareScreen =
      allowedScreens.has("crypto-middleware") ||
      allowedScreens.has("crypto_middleware") ||
      allowedScreens.has("crypto");

    if (hasCryptoMiddlewareScreen) {
      return true;
    }
  }

  // 2) Fallback: permissão nominal (modelo clássico grupos_permissoes)
  return hasPermission(userId, permissionName);
}
