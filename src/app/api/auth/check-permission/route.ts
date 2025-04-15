import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getUserByAuthId } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Criar cliente Supabase para verificar a sessão
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Verificar sessão do usuário
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Obter o body da requisição
    const body = await request.json();
    const { permission } = body;

    if (!permission) {
      return NextResponse.json(
        { error: "Permissão não especificada" },
        { status: 400 }
      );
    }

    // Buscar o usuário no banco pelo auth_id
    const user = await getUserByAuthId(session.user.id);

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Verificar a permissão (simplificado para exemplo)
    // Em um sistema real, faríamos uma consulta mais complexa verificando grupos e permissões
    const hasAccess = await checkUserPermission(user.id, permission);

    return NextResponse.json({ hasPermission: hasAccess });
  } catch (error) {
    console.error("Erro ao verificar permissão:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// Função simplificada para verificar permissões
// Em um ambiente real, essa lógica estaria em um arquivo separado
async function checkUserPermission(userId: string, permissionName: string): Promise<boolean> {
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server');
    const supabase = createServerSupabaseClient();
    
    // 1. Buscar grupos do usuário
    const { data: userGroups } = await supabase
      .from('usuarios_grupos')
      .select('grupo_id')
      .eq('usuario_id', userId);
    
    if (!userGroups || userGroups.length === 0) return false;
    
    // 2. Buscar permissão pelo nome
    const { data: permission } = await supabase
      .from('permissoes')
      .select('id')
      .eq('nome', permissionName)
      .single();
    
    if (!permission) return false;
    
    // 3. Verificar se algum dos grupos do usuário tem a permissão
    const groupIds = userGroups.map(ug => ug.grupo_id);
    
    const { count } = await supabase
      .from('grupos_permissoes')
      .select('*', { count: 'exact', head: true })
      .eq('permissao_id', permission.id)
      .in('grupo_id', groupIds);
    
    return count ? count > 0 : false;
  } catch (error) {
    console.error('Erro ao verificar permissão:', error);
    return false;
  }
} 