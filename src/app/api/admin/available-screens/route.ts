import { NextRequest, NextResponse } from "next/server";
import fs from 'fs/promises'; // Usar a versão de promises do fs
import path from 'path';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { getServiceRoleKey, supabaseConfig } from '@/lib/config';
import { requireMasterUser } from "@/lib/server/admin-auth";

// Helper para criar cliente Supabase (copiado de outra API para consistência)
const createSupabaseClient = (cookieStore: ReturnType<typeof cookies>) => {
  return createServerClient<Database>(
    supabaseConfig.url!,
    getServiceRoleKey(), // Usar service role para operações admin
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: any) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
        },
      },
    }
  );
};

export async function GET(request: NextRequest) {
  console.log("[API:AdminAvailableScreens:GET] Buscando telas disponíveis");

  try {
    const auth = await requireMasterUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 2. Ler o arquivo de configuração
    const configPath = path.resolve(process.cwd(), 'screens.config.json');
    console.log(`[API:AdminAvailableScreens:GET] Lendo arquivo de configuração em: ${configPath}`);
    
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const availableScreens = JSON.parse(fileContent);

    // 3. Retornar a lista de telas
    return NextResponse.json({ screens: availableScreens });

  } catch (error: any) {
    console.error("[API:AdminAvailableScreens:GET] Erro inesperado:", error);
    if (error.code === 'ENOENT') {
       console.error(`[API:AdminAvailableScreens:GET] Arquivo screens.config.json não encontrado em ${path.resolve(process.cwd(), 'screens.config.json')}`);
      return NextResponse.json({ error: "Arquivo de configuração de telas não encontrado." }, { status: 500 });
    } else if (error instanceof SyntaxError) {
        console.error("[API:AdminAvailableScreens:GET] Erro ao parsear screens.config.json. Verifique se é um JSON válido.");
        return NextResponse.json({ error: "Erro ao ler configuração de telas (JSON inválido)." }, { status: 500 });
    }
    return NextResponse.json({ error: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
} 
