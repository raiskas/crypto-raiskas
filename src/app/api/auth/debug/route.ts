import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

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

// API para diagnosticar problemas de autenticação
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, action } = body;
    
    console.log("[API:Debug] Solicitação de diagnóstico para:", { email, action });
    
    if (!email) {
      return NextResponse.json(
        { error: "Email é obrigatório" },
        { status: 400 }
      );
    }
    
    // Criar cliente Supabase
    let supabase;
    try {
      supabase = initializeSupabaseClient();
      console.log("[API:Debug] Cliente Supabase criado com sucesso");
    } catch (error: any) {
      console.error("[API:Debug] Erro ao criar cliente Supabase:", error);
      return NextResponse.json(
        { error: `Erro de configuração: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Verificar se o usuário existe na autenticação
    try {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error("[API:Debug] Erro ao verificar usuários:", listError);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }
      
      const existingUser = users?.find(u => u.email === email);
      
      if (!existingUser) {
        console.warn("[API:Debug] Email não encontrado no sistema:", email);
        return NextResponse.json(
          { error: "Usuário não encontrado", status: "NOT_FOUND" },
          { status: 404 }
        );
      }
      
      console.log("[API:Debug] Usuário encontrado:", {
        id: existingUser.id,
        email: existingUser.email,
        emailConfirmed: existingUser.email_confirmed_at,
        createdAt: existingUser.created_at,
        updatedAt: existingUser.updated_at,
        lastSignIn: existingUser.last_sign_in_at,
        userMetadata: existingUser.user_metadata,
        appMetadata: existingUser.app_metadata
      });
      
      // Verificar se existe na tabela usuarios também
      const { data: dbUserData, error: dbUserError } = await supabase
        .from("usuarios")
        .select("id, nome, email, empresa_id, ativo, auth_id")
        .eq("email", email)
        .single();
      
      const dbUserStatus = !dbUserError ? "FOUND" : "NOT_FOUND";
      
      // Verificar problemas comuns
      let issues = [];
      let actions = [];
      
      // 1. Verificar se o email está confirmado
      if (!existingUser.email_confirmed_at) {
        issues.push("EMAIL_NOT_CONFIRMED");
        actions.push("CONFIRM_EMAIL");
      }
      
      // 2. Verificar se o usuário está registrado na tabela customizada
      if (dbUserError) {
        issues.push("NO_CUSTOM_RECORD");
        actions.push("CREATE_CUSTOM_RECORD");
      } else if (dbUserData.auth_id !== existingUser.id) {
        issues.push("AUTH_ID_MISMATCH");
        actions.push("FIX_AUTH_ID");
      }
      
      // 3. Verificar se o usuário estiver inativo
      if (dbUserData && !dbUserData.ativo) {
        issues.push("USER_INACTIVE");
        actions.push("ACTIVATE_USER");
      }
      
      // Executar ações de correção, se solicitado
      const result: any = {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          emailConfirmed: !!existingUser.email_confirmed_at,
          customRecord: dbUserStatus,
        },
        issues,
        recommendedActions: actions,
        actionsPerformed: []
      };
      
      if (action === "FIX_ISSUES") {
        console.log("[API:Debug] Executando ações corretivas para:", email);
        
        // 1. Confirmar email, se necessário
        if (actions.includes("CONFIRM_EMAIL")) {
          try {
            await supabase.auth.admin.updateUserById(existingUser.id, {
              email_confirm: true
            });
            result.actionsPerformed.push("EMAIL_CONFIRMED");
          } catch (confirmError: any) {
            console.error("[API:Debug] Erro ao confirmar email:", confirmError);
          }
        }
        
        // 2. Corrigir auth_id se houver divergência
        if (actions.includes("FIX_AUTH_ID") && dbUserData) {
          try {
            await supabase
              .from("usuarios")
              .update({ auth_id: existingUser.id })
              .eq("id", dbUserData.id);
            result.actionsPerformed.push("AUTH_ID_FIXED");
          } catch (updateError: any) {
            console.error("[API:Debug] Erro ao corrigir auth_id:", updateError);
          }
        }
        
        // 3. Ativar usuário, se estiver inativo
        if (actions.includes("ACTIVATE_USER") && dbUserData) {
          try {
            await supabase
              .from("usuarios")
              .update({ ativo: true })
              .eq("id", dbUserData.id);
            result.actionsPerformed.push("USER_ACTIVATED");
          } catch (activateError: any) {
            console.error("[API:Debug] Erro ao ativar usuário:", activateError);
          }
        }
      }
      
      console.log("[API:Debug] Diagnóstico completo para:", email);
      return NextResponse.json(result, { status: 200 });
      
    } catch (processError: any) {
      console.error("[API:Debug] Erro ao processar diagnóstico:", processError);
      return NextResponse.json({ error: processError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[API:Debug] Erro inesperado:", error);
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    );
  }
} 