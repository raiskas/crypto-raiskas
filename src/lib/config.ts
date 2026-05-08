const requireValue = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
};

// Configurações públicas/compartilhadas do Supabase
export const supabaseConfig = {
  // Em código cliente do Next.js, variáveis públicas precisam ser acessadas
  // diretamente para serem inlinadas no bundle.
  url: requireValue(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: requireValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-application-name": "crypto-raiskas",
      },
    },
  },
};

export const getServiceRoleKey = () =>
  requireValue(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
