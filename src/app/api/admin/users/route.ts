import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { supabaseConfig } from '@/lib/config';

// Cliente Supabase com chave administrativa
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

// Endpoint para listar todos os usuários
export async function GET(request: NextRequest) {
  try {
    console.log("[API:AdminUsers] Listando usuários");
    
    // Buscar usuários da autenticação
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("[API:AdminUsers] Erro ao listar usuários auth:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    
    // Buscar dados adicionais da tabela personalizada
    const { data: dbUsers, error: dbError } = await supabase
      .from('usuarios')
      .select('id, nome, email, empresa_id, ativo, auth_id');
    
    if (dbError) {
      console.error("[API:AdminUsers] Erro ao listar usuários do banco:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    
    // Combinar os dados dos dois sistemas
    const mergedUsers = users.map(authUser => {
      const dbUser = dbUsers?.find(db => db.auth_id === authUser.id);
      return {
        id: authUser.id,
        email: authUser.email,
        nome: dbUser?.nome || "",
        empresa_id: dbUser?.empresa_id || null,
        ativo: dbUser?.ativo || false,
        criado_em: authUser.created_at,
        ultimo_login: authUser.last_sign_in_at,
        confirmado: !!authUser.email_confirmed_at,
        db_id: dbUser?.id || null,
      };
    });
    
    return NextResponse.json({ users: mergedUsers });
  } catch (error: any) {
    console.error("[API:AdminUsers] Erro inesperado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Endpoint para criar novo usuário
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, email, password, empresa_id, ativo = true } = body;
    
    console.log("[API:AdminUsers] Criando novo usuário:", email);
    
    // Validar campos obrigatórios
    if (!nome || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      );
    }
    
    // 1. Verificar se o email já existe na tabela personalizada
    try {
      const { data: existingDbUser, error: dbCheckError } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();
      
      if (existingDbUser) {
        console.warn("[API:AdminUsers] Email já existe na tabela usuarios:", email);
        return NextResponse.json(
          { error: "Este email já está registrado no sistema" },
          { status: 409 }
        );
      }
    } catch (err) {
      // Ignoramos o erro Not Found, que é esperado quando não encontra o usuário
      console.log("[API:AdminUsers] Verificação na tabela usuarios ok, usuário não encontrado");
    }
    
    // 2. Verificar se o email já existe na autenticação
    const { data: { users } } = await supabase.auth.admin.listUsers();
    if (users?.some(u => u.email === email)) {
      console.warn("[API:AdminUsers] Email já existe na autenticação:", email);
      return NextResponse.json(
        { error: "Este email já está registrado" },
        { status: 409 }
      );
    }
    
    // 3. Criar usuário na autenticação
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar email automaticamente
    });
    
    if (authError) {
      console.error("[API:AdminUsers] Erro ao criar usuário na autenticação:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    
    // 4. Criar registro na tabela personalizada
    try {
      const { data: dbUser, error: dbError } = await supabase
        .from('usuarios')
        .insert({
          nome,
          email,
          empresa_id: empresa_id || null,
          auth_id: authUser.user.id,
          ativo,
        })
        .select()
        .single();
      
      if (dbError) {
        console.error("[API:AdminUsers] Erro ao inserir na tabela usuarios:", dbError);
        
        // Verificar se é erro de duplicação
        if (dbError.code === '23505' && dbError.message.includes('usuarios_email_key')) {
          // Remover usuário da autenticação se já existir o email no banco
          await supabase.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json(
            { error: "Este email já está registrado no sistema" },
            { status: 409 }
          );
        }
        
        // Remover usuário da autenticação para outros erros
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return NextResponse.json({ error: dbError.message }, { status: 500 });
      }
      
      return NextResponse.json(
        { 
          message: "Usuário criado com sucesso",
          user: {
            id: authUser.user.id,
            nome,
            email,
            empresa_id: empresa_id || null,
            ativo,
            db_id: dbUser.id,
          }
        },
        { status: 201 }
      );
    } catch (error: any) {
      // Remover usuário da autenticação se falhar a inserção no banco
      await supabase.auth.admin.deleteUser(authUser.user.id);
      console.error("[API:AdminUsers] Erro ao inserir na tabela usuarios:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[API:AdminUsers] Erro inesperado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Patch para atualizar usuário
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nome, email, password, empresa_id, ativo } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: "ID do usuário é obrigatório" },
        { status: 400 }
      );
    }
    
    console.log("[API:AdminUsers] Atualizando usuário:", id);
    
    // Atualizar senha se fornecida
    if (password) {
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(id, {
        password,
      });
      
      if (updateAuthError) {
        console.error("[API:AdminUsers] Erro ao atualizar senha:", updateAuthError);
        return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
      }
      
      console.log("[API:AdminUsers] Senha atualizada com sucesso");
    }
    
    // Buscar registro da tabela personalizada
    const { data: dbUser, error: findError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_id', id)
      .single();
    
    if (findError) {
      console.error("[API:AdminUsers] Erro ao buscar registro de usuário:", findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }
    
    // Atualizar registro na tabela personalizada
    const updateData: any = {};
    if (nome) updateData.nome = nome;
    if (email) updateData.email = email;
    if (empresa_id !== undefined) updateData.empresa_id = empresa_id;
    if (ativo !== undefined) updateData.ativo = ativo;
    
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update(updateData)
        .eq('id', dbUser.id);
      
      if (updateError) {
        console.error("[API:AdminUsers] Erro ao atualizar registro:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      
      console.log("[API:AdminUsers] Usuário atualizado com sucesso");
    }
    
    return NextResponse.json({ message: "Usuário atualizado com sucesso" });
  } catch (error: any) {
    console.error("[API:AdminUsers] Erro inesperado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Endpoint para deletar usuário
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "ID do usuário é obrigatório" },
        { status: 400 }
      );
    }
    
    console.log("[API:AdminUsers] Deletando usuário:", id);
    
    // Deletar usuário da autenticação
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
    
    if (deleteAuthError) {
      console.error("[API:AdminUsers] Erro ao deletar usuário da autenticação:", deleteAuthError);
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    }
    
    // Deletar ou apenas inativar na tabela personalizada
    const { error: deleteDbError } = await supabase
      .from('usuarios')
      .update({ ativo: false })
      .eq('auth_id', id);
    
    if (deleteDbError) {
      console.error("[API:AdminUsers] Erro ao inativar usuário no banco:", deleteDbError);
      // Não retornar erro, pois o usuário já foi removido da autenticação
      console.warn("[API:AdminUsers] Usuário removido da autenticação, mas não do banco");
    }
    
    return NextResponse.json({ message: "Usuário removido com sucesso" });
  } catch (error: any) {
    console.error("[API:AdminUsers] Erro inesperado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 