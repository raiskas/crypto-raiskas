import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

export async function POST(request: NextRequest) {
  console.log("[API Logout] Recebida requisição POST para /api/auth/logout");

  const response = NextResponse.json({ success: true, message: 'Logout iniciado no servidor' }, { status: 200 });

  // Criar cliente Supabase no contexto do servidor
  const supabase = createServerClient<Database>(
    supabaseConfig.url!,
    supabaseConfig.anonKey!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          console.log(`[API Logout] Cookie SET: ${name}`);
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          console.log(`[API Logout] Cookie REMOVE: ${name}`);
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  try {
    // Chamar signOut no servidor para limpar os cookies associados à resposta
    const { error } = await supabase.auth.signOut(); 

    if (error) {
      console.error("[API Logout] Erro ao chamar supabase.auth.signOut:", error);
      // Mesmo com erro, tentamos retornar uma resposta que limpa os cookies
      // A resposta já foi criada com os manipuladores de cookie corretos
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log("[API Logout] supabase.auth.signOut chamado com sucesso no servidor.");
    // A resposta já contém as instruções para limpar os cookies
    return response;

  } catch (err: any) {
    console.error("[API Logout] Exceção ao tentar fazer logout no servidor:", err);
    return NextResponse.json({ success: false, error: err.message || 'Erro interno do servidor' }, { status: 500 });
  }
} 