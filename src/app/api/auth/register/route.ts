import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

// Inicializa o cliente Supabase com a chave de serviço para operações administrativas
const supabase = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, email, password, empresa_id } = body;
    
    console.log("[API:Register] Solicitação de registro para:", { email, nome });
    
    // Validar campos obrigatórios
    if (!nome || !email || !password) {
      console.error("[API:Register] Campos obrigatórios faltando");
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      );
    }
    
    // Verificar se o email já existe
    try {
      console.log("[API:Register] Verificando se email já existe em Auth");
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error("[API:Register] Erro ao verificar usuários:", listError);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }
      
      const existingUser = users?.find(u => u.email === email);
      
      if (existingUser) {
        console.error("[API:Register] Email já cadastrado:", email);
        return NextResponse.json(
          { error: "Email já cadastrado" },
          { status: 409 }
        );
      }
    } catch (verifyError: any) {
      console.error("[API:Register] Erro ao verificar usuários:", verifyError);
      return NextResponse.json(
        { error: "Erro ao verificar usuários existentes" },
        { status: 500 }
      );
    }
    
    // Verificar duplicação na tabela personalizada também
    try {
      console.log("[API:Register] Verificando se email já existe na tabela usuarios");
      const { data: existingDbUser, error: dbError } = await supabase
        .from("usuarios")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();
      
      if (existingDbUser) {
        console.error("[API:Register] Email já existe na tabela de usuários:", email);
        return NextResponse.json(
          { error: "Email já cadastrado" },
          { status: 409 }
        );
      }
    } catch (dbError: any) {
      // É esperado um erro se o usuário não existir (not found)
      console.log("[API:Register] Verificação na tabela usuarios ok, usuário não encontrado");
    }
    
    // Criar usuário na autenticação do Supabase
    let newUser;
    try {
      console.log("[API:Register] Criando usuário na autenticação");
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto confirmar email para simplificar
      });
      
      if (error) {
        console.error("[API:Register] Erro ao criar usuário na autenticação:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      newUser = data.user;
      console.log("[API:Register] Usuário criado na autenticação:", { id: newUser.id, email: newUser.email });
    } catch (createError: any) {
      console.error("[API:Register] Erro ao criar usuário na autenticação:", createError);
      return NextResponse.json(
        { error: "Erro ao criar usuário: " + createError.message },
        { status: 500 }
      );
    }
    
    // Criar registro na tabela de usuários personalizada
    try {
      console.log("[API:Register] Criando registro na tabela usuarios");
      const { data, error } = await supabase
        .from("usuarios")
        .insert({
          nome,
          email,
          empresa_id: empresa_id || null,
          auth_id: newUser.id, // Importante: associar com ID de autenticação
          ativo: true,
        })
        .select()
        .single();
      
      if (error) {
        console.error("[API:Register] Erro ao inserir na tabela usuarios:", error);
        
        // Verificar se é erro de duplicação
        if (error.code === '23505' && error.message.includes('usuarios_email_key')) {
          // Remover usuário da autenticação se o email já existir
          await supabase.auth.admin.deleteUser(newUser.id);
          return NextResponse.json(
            { error: "Este email já está cadastrado no sistema" },
            { status: 409 }
          );
        }
        
        // Se falhar na tabela personalizada, excluir o usuário da autenticação para evitar inconsistências
        await supabase.auth.admin.deleteUser(newUser.id);
        
        return NextResponse.json(
          { error: "Erro ao criar registro de usuário: " + error.message },
          { status: 500 }
        );
      }
      
      console.log("[API:Register] Registro criado com sucesso na tabela usuarios:", { id: data.id, nome: data.nome });
      
      // Retornar resposta de sucesso
      return NextResponse.json(
        { 
          message: "Usuário registrado com sucesso",
          user: { 
            id: data.id,
            nome: data.nome,
            email: data.email
          }
        },
        { status: 201 }
      );
    } catch (insertError: any) {
      console.error("[API:Register] Erro ao inserir na tabela usuarios:", insertError);
      
      // Limpar usuário da autenticação se o registro falhar
      await supabase.auth.admin.deleteUser(newUser.id);
      
      return NextResponse.json(
        { error: "Erro ao criar registro de usuário: " + insertError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[API:Register] Erro inesperado:", error);
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    );
  }
} 