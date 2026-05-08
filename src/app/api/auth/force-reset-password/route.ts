import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { getServiceRoleKey, supabaseConfig } from '@/lib/config';
import { requireMasterUser } from "@/lib/server/admin-auth";

// Schema para validação da solicitação de redefinição forçada
const forceResetSchema = z.object({
  email: z.string().email("Email inválido"),
  new_password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

// Inicializa o cliente Supabase com a chave de serviço
const initializeSupabaseClient = () => {
  return createClient<Database>(
    supabaseConfig.url,
    getServiceRoleKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
};

// Função para forçar a redefinição de senha por admin
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMasterUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Obter e validar os dados da requisição
    const body = await request.json();
    console.log("[API:ForceResetPassword] Solicitação recebida para:", body.email);
    
    const validation = forceResetSchema.safeParse(body);
    if (!validation.success) {
      console.log("[API:ForceResetPassword] Erro de validação:", validation.error.format());
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { email, new_password } = validation.data;
    
    // Criar cliente Supabase
    let supabase;
    try {
      supabase = initializeSupabaseClient();
      console.log("[API:ForceResetPassword] Cliente Supabase criado com sucesso");
    } catch (error: any) {
      console.error("[API:ForceResetPassword] Erro ao criar cliente Supabase:", error);
      return NextResponse.json(
        { error: `Erro de configuração: ${error.message}` },
        { status: 500 }
      );
    }
    
    try {
      // Verificar se o usuário existe na autenticação
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error("[API:ForceResetPassword] Erro ao buscar usuários:", listError);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }
      
      const existingUser = users?.find(u => u.email === email);
      
      if (!existingUser) {
        console.warn("[API:ForceResetPassword] Email não encontrado no sistema:", email);
        return NextResponse.json(
          { error: "Usuário não encontrado" },
          { status: 404 }
        );
      }
      
      // Atualizar a senha diretamente
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: new_password }
      );
      
      if (updateError) {
        console.error("[API:ForceResetPassword] Erro ao atualizar senha:", updateError);
        return NextResponse.json(
          { error: `Falha ao atualizar senha: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      console.log("[API:ForceResetPassword] Senha atualizada com sucesso para:", email);
      
      // Registrar a operação em log (apenas no console)
      console.log("[API:ForceResetPassword] Registro de auditoria: Redefinição forçada para usuário", {
        usuario_id: existingUser.id,
        email: existingUser.email,
        data: new Date().toISOString()
      });
      
      return NextResponse.json(
        { 
          message: "Senha redefinida com sucesso", 
          user_id: existingUser.id 
        },
        { status: 200 }
      );
      
    } catch (processError: any) {
      console.error("[API:ForceResetPassword] Erro ao processar redefinição:", processError);
      return NextResponse.json({ error: processError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[API:ForceResetPassword] Erro inesperado:", error);
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    );
  }
} 
