import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

// Schema para validação da solicitação de redefinição forçada
const forceResetSchema = z.object({
  email: z.string().email("Email inválido"),
  new_password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  admin_key: z.string().min(1, "Chave administrativa é obrigatória"),
});

// Chave secreta para autorizar operações administrativas (deve ser armazenada em ambiente seguro)
const ADMIN_API_KEY = "crypto_raiskas_admin_2023"; // Substitua por uma chave segura gerada aleatoriamente em produção

// Inicializa o cliente Supabase com a chave de serviço
const initializeSupabaseClient = () => {
  return createClient<Database>(
    supabaseConfig.url,
    supabaseConfig.serviceRoleKey,
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

    const { email, new_password, admin_key } = validation.data;
    
    // Verificar chave administrativa
    if (admin_key !== ADMIN_API_KEY) {
      console.error("[API:ForceResetPassword] Tentativa de acesso com chave administrativa inválida");
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }
    
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