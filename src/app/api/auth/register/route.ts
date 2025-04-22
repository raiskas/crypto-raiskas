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
    // Password não é mais enviado/necessário para esta API
    const { nome, email } = body; 
    
    console.log("[API:Register Simplified] Solicitação de registro para:", { email, nome });
    
    // Validar campos obrigatórios - REMOVER 'password' DA VERIFICAÇÃO
    if (!nome || !email) {
      console.error("[API:Register Simplified] Nome ou email faltando");
      return NextResponse.json(
        // Mensagem de erro atualizada
        { error: "Nome e email são obrigatórios" }, 
        { status: 400 }
      );
    }
    
    // >>> O RESTANTE DA API (verificar email, criar auth user, inserir usuario) <<< 
    // >>> PRECISA SER REVISADO PARA O NOVO FLUXO ONDE AUTH USER JÁ FOI CRIADO <<< 
    // >>> NO CLIENT-SIDE PELO useAuth hook. <<< 

    // **** AJUSTE DA LÓGICA DA API ****
    // A API agora recebe auth_id, nome, email do hook useAuth.
    // Ela NÃO precisa mais criar o usuário em supabase.auth.admin
    // Ela SÓ precisa inserir na tabela 'usuarios'.

    // Pegar auth_id que agora é enviado pelo hook useAuth
    const { auth_id } = body;
    if (!auth_id) {
       console.error("[API:Register Simplified] auth_id faltando no corpo da requisição");
       return NextResponse.json(
        { error: "ID de autenticação ausente" }, 
        { status: 400 }
      );
    }

    // Verificar duplicação na tabela personalizada (mantém)
    try {
      console.log("[API:Register Simplified] Verificando se email já existe na tabela usuarios");
      const { data: existingDbUser, error: dbError } = await supabase
        .from("usuarios")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();
      
      if (dbError && dbError.code !== 'PGRST116') { // Ignorar 'not found' mas logar outros erros
         console.error("[API:Register Simplified] Erro DB ao verificar email duplicado:", dbError);
         throw dbError; // Lançar outros erros de DB
      }

      if (existingDbUser) {
        console.error("[API:Register Simplified] Email já existe na tabela de usuários:", email);
        // Neste fluxo, se o email existe aqui mas não em Auth, algo está inconsistente.
        // Poderíamos tentar limpar Auth user aqui, mas é complexo.
        // Por ora, retornar erro claro.
        return NextResponse.json(
          { error: "Email já cadastrado no sistema." },
          { status: 409 } // Conflito
        );
      }
      console.log("[API:Register Simplified] Verificação de email duplicado na tabela usuarios OK.");
    } catch (dbError: any) {
       console.error("[API:Register Simplified] Erro não esperado ao verificar email duplicado em usuarios:", dbError);
       return NextResponse.json({ error: "Erro ao verificar dados existentes." }, { status: 500 });
    }

    // REMOVER Bloco: Criar usuário na autenticação do Supabase (já feito no cliente)
    /*
    let newUser;
    try { ... supabase.auth.admin.createUser ... } catch { ... }
    */

    // Criar registro na tabela de usuários personalizada
    try {
      console.log("[API:Register Simplified] Criando registro na tabela usuarios para auth_id:", auth_id);
      const { data, error } = await supabase
        .from("usuarios")
        .insert({
          nome,
          email,
          empresa_id: null, // Definir explicitamente como null
          auth_id: auth_id, // Usar o auth_id recebido
          ativo: true,
        })
        .select()
        .single();
      
      if (error) {
        console.error("[API:Register Simplified] Erro ao inserir na tabela usuarios:", error);
        // Neste ponto, o usuário Auth existe, mas o usuário DB falhou.
        // A reversão ideal seria feita aqui, mas requer privilégios admin.
        // Logar a inconsistência é crucial.
        console.error(`[API:Register Simplified] INCONSISTÊNCIA: Usuário Auth (${auth_id}) criado, mas falha ao criar usuário DB. Requer atenção manual.`);
        
        // Tratar erro de duplicação se ocorrer (embora a verificação anterior deva pegar)
        if (error.code === '23505' && error.message.includes('usuarios_email_key')) {
          return NextResponse.json({ error: "Este email já está cadastrado." }, { status: 409 });
        }
        if (error.code === '23505' && error.message.includes('usuarios_auth_id_key')) {
          return NextResponse.json({ error: "ID de autenticação já cadastrado." }, { status: 409 });
        }
        
        return NextResponse.json({ error: "Erro ao salvar registro do usuário." }, { status: 500 });
      }
      
      console.log("[API:Register Simplified] Registro criado com sucesso na tabela usuarios:", { id: data.id, nome: data.nome });
      
      // Retornar resposta de sucesso
      return NextResponse.json(
        { 
          message: "Usuário registrado com sucesso",
          user: { 
            id: data.id, // ID da tabela usuarios
            nome: data.nome,
            email: data.email
          }
        },
        { status: 201 }
      );
    } catch (insertError: any) {
      console.error("[API:Register Simplified] Erro catch ao inserir na tabela usuarios:", insertError);
      // Logar inconsistência
      console.error(`[API:Register Simplified] INCONSISTÊNCIA: Usuário Auth (${auth_id}) criado, mas falha GERAL ao criar usuário DB. Requer atenção manual.`);
      return NextResponse.json({ error: "Erro ao finalizar o registro do usuário." }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[API:Register Simplified] Erro inesperado no handler POST:", error);
    return NextResponse.json({ error: `Erro interno do servidor.` }, { status: 500 });
  }
} 