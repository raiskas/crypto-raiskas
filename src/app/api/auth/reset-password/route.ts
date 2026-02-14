import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

// Schema para validação da solicitação de redefinição
const requestResetSchema = z.object({
  email: z.string().email("Email inválido"),
});

// Schema para validação da confirmação de redefinição
const confirmResetSchema = z.object({
  token: z.string().min(1, "Token de redefinição é obrigatório"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

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

// Função para solicitar a redefinição de senha
export async function POST(request: NextRequest) {
  try {
    // Obter e validar os dados da requisição
    const body = await request.json();
    console.log("[API:ResetPassword] Solicitação recebida para:", body.email);
    
    const validation = requestResetSchema.safeParse(body);
    if (!validation.success) {
      console.log("[API:ResetPassword] Erro de validação:", validation.error.format());
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { email } = validation.data;
    
    // Criar cliente Supabase
    let supabase;
    try {
      supabase = initializeSupabaseClient();
      console.log("[API:ResetPassword] Cliente Supabase criado com sucesso");
    } catch (error: any) {
      console.error("[API:ResetPassword] Erro ao criar cliente Supabase:", error);
      return NextResponse.json(
        { error: `Erro de configuração: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Verificar se o usuário existe na autenticação
    try {
      // Buscar usuários pelo email
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      const existingUser = users?.find(u => u.email === email);
      
      if (listError) {
        console.error("[API:ResetPassword] Erro ao verificar usuários:", listError);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }
      
      if (!existingUser) {
        console.warn("[API:ResetPassword] Email não encontrado no sistema:", email);
        // Por segurança, não informamos que o email não existe
        return NextResponse.json(
          { message: "Se o email estiver registrado, você receberá as instruções para redefinir sua senha" },
          { status: 200 }
        );
      }
      
      // Enviar email de redefinição
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email,
      });
      
      if (error) {
        console.error("[API:ResetPassword] Erro ao gerar link de recuperação:", error);
        return NextResponse.json(
          { error: `Falha ao processar solicitação: ${error.message}` },
          { status: 500 }
        );
      }
      
      console.log("[API:ResetPassword] Link de recuperação gerado com sucesso para:", email);
      
      return NextResponse.json(
        { message: "Instruções de recuperação enviadas para seu email" },
        { status: 200 }
      );
      
    } catch (checkError: any) {
      console.error("[API:ResetPassword] Erro ao processar solicitação:", checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[API:ResetPassword] Erro inesperado:", error);
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    );
  }
}

// Função para confirmar a redefinição de senha (via PATCH)
export async function PATCH(request: NextRequest) {
  try {
    // Obter e validar os dados da requisição
    const body = await request.json();
    console.log("[API:ResetPassword] Confirmação de redefinição recebida");
    
    const validation = confirmResetSchema.safeParse(body);
    if (!validation.success) {
      console.log("[API:ResetPassword] Erro de validação:", validation.error.format());
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;
    
    // Criar cliente Supabase
    let supabase;
    try {
      supabase = initializeSupabaseClient();
      console.log("[API:ResetPassword] Cliente Supabase criado com sucesso");
    } catch (error: any) {
      console.error("[API:ResetPassword] Erro ao criar cliente Supabase:", error);
      return NextResponse.json(
        { error: `Erro de configuração: ${error.message}` },
        { status: 500 }
      );
    }
    
    try {
      // Verificar e atualizar a senha
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
      });
      
      if (error) {
        console.error("[API:ResetPassword] Erro ao verificar token:", error);
        return NextResponse.json(
          { error: "Token inválido ou expirado. Solicite uma nova redefinição de senha." },
          { status: 400 }
        );
      }
      
      if (!data.user) {
        console.error("[API:ResetPassword] Usuário não encontrado após verificação do token");
        return NextResponse.json(
          { error: "Falha ao identificar usuário" },
          { status: 500 }
        );
      }
      
      // Atualizar a senha do usuário
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        data.user.id,
        { password }
      );
      
      if (updateError) {
        console.error("[API:ResetPassword] Erro ao atualizar senha:", updateError);
        return NextResponse.json(
          { error: `Falha ao atualizar senha: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      console.log("[API:ResetPassword] Senha atualizada com sucesso para usuário ID:", data.user.id);
      
      return NextResponse.json(
        { message: "Senha atualizada com sucesso. Você já pode fazer login com sua nova senha." },
        { status: 200 }
      );
      
    } catch (processError: any) {
      console.error("[API:ResetPassword] Erro ao processar redefinição:", processError);
      return NextResponse.json({ error: processError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[API:ResetPassword] Erro inesperado:", error);
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    );
  }
} 