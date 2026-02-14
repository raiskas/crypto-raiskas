import { NextResponse, type NextRequest } from 'next/server';
import { Database } from '@/lib/database.types';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { AUTH_ROUTES, HOME_ROUTE, PUBLIC_ROUTES } from '@/lib/config/routes';

// Mapeamento de rotas para módulos de permissão necessários
const PERMISSION_MAP: { [key: string]: string } = {
  '/admin': 'admin_panel',
  '/admin/usuarios': 'admin_usuarios',
  '/admin/grupos': 'admin_grupos',
  '/admin/empresas': 'admin_panel',
  '/configuracoes': 'configuracoes',
  '/crypto': 'crypto',
  '/crypto-middleware': 'crypto_middleware',
  '/crypto/nova-operacao': 'crypto',
  '/vendas': 'vendas',
  '/crypto/operacoes': 'crypto_operacoes' // Adicione outros mapeamentos conforme necessário
};

// --- Lógica Principal do Middleware (Revisada para Priorizar Rotas Públicas) ---
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`\n[Middleware] Requisição recebida para: ${pathname}`);

  // IGNORAR _next, api, e arquivos estáticos (com extensões comuns)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    // pathname.includes('.') // REMOVIDO - Usar regex mais específico abaixo
    /\.(png|jpg|jpeg|gif|svg|ico|js|css|woff2|woff|ttf|eot)$/.test(pathname) // Regex para extensões comuns
  ) {
    console.log(`[Middleware] DECISÃO: Rota interna/API/asset (${pathname}). Ignorando middleware.`);
    return NextResponse.next();
  }

  // Logar cookies recebidos (para depuração)
  console.log("[Middleware] Cookies Recebidos:", JSON.stringify(request.cookies.getAll(), null, 2));

  // Permitir todas as chamadas de API sem verificação de autenticação
  if (pathname.startsWith('/api/')) {
    console.log(`[Middleware] DECISÃO: Rota de API (${pathname}). Permitindo acesso direto.`);
    return NextResponse.next();
  }

  // --- PRIORIDADE MÁXIMA: Permitir acesso irrestrito a rotas públicas --- 
  if (PUBLIC_ROUTES.includes(pathname)) {
    console.log(`[Middleware] DECISÃO: Rota pública (${pathname}). Permitindo acesso direto.`);
    // Retorna NextResponse.next() simples, sem criar cliente supabase ou verificar sessão
    return NextResponse.next(); 
  }

  // --- Se NÃO for rota pública, aí sim verificamos autenticação --- 
  console.log("[Middleware] Rota não pública. Prosseguindo com verificação de autenticação...");

  let response = NextResponse.next({ 
    request: {
      headers: request.headers,
    },
  });

  // Criar cliente Supabase (APENAS para rotas não públicas)
  console.log("[Middleware] Criando cliente Supabase...");
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name)?.value;
          return cookie;
        },
        set(name: string, value: string, options: CookieOptions) {
          console.log(`[Middleware] Cookie SET: ${name}`);
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          console.log(`[Middleware] Cookie REMOVE: ${name}`);
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Obter sessão
  console.log("[Middleware] --- PRE: supabase.auth.getSession() ---");
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log(`[Middleware] --- POST: supabase.auth.getSession() --- Erro: ${!!sessionError}, Sessão: ${session ? 'presente' : 'ausente'}`);

  if (sessionError) {
    console.error('[Middleware] Erro ao obter sessão:', sessionError.message);
    // Se erro de sessão, redirecionar para signin (mas essa rota já foi tratada acima)
    // Talvez logar o erro e permitir a passagem? Ou redirecionar com erro específico?
    // Por segurança, vamos redirecionar para signin com erro, caso chegue aqui.
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/signin';
    redirectUrl.searchParams.set('error', 'session_error_middleware');
    console.log("[Middleware] Redirecionando para /signin (erro de sessão)");
    return NextResponse.redirect(redirectUrl);
  }

  // Verificar usuário
  console.log("[Middleware] --- PRE: supabase.auth.getUser() ---");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log(`[Middleware] --- POST: supabase.auth.getUser() --- Erro: ${!!authError}, Usuário: ${user ? user.email : 'ausente'}`);

  // Derivar isAuthenticated APENAS APÓS ambas as verificações (para rotas não públicas)
  const isAuthenticated = !!user;
  console.log(`[Middleware] Status de autenticação para rota não pública: ${isAuthenticated}`);

  // --- Lógica para ROTAS PROTEGIDAS --- 

  // 1. Redirecionar usuário logado tentando acessar rotas de autenticação (já tratado acima, mas seguro deixar)
  // if (isAuthenticated && AUTH_ROUTES.includes(pathname)) { ... } // Esta condição não será atingida devido à verificação inicial

  // 2. Permitir acesso a rotas públicas (já tratado acima)
  // if (PUBLIC_ROUTES.includes(pathname)) { ... }

  // 3. Se NÃO está autenticado e tenta acessar rota protegida (que não é pública)
  if (!isAuthenticated) { 
    console.log(`[Middleware] DECISÃO: Usuário não logado acessando rota protegida (${pathname}). Redirecionando para /signin`);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/signin';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 4. Se está autenticado, verificar permissão para a rota protegida
  if (isAuthenticated) { // Não precisa mais verificar se não é AUTH/PUBLIC, pois já foram tratadas
    console.log(`[Middleware] Usuário logado (${user.email}) acessando rota protegida (${pathname}). Verificando permissão...`);
    
    // Encontrar módulo de permissão necessário (Lógica revisada para prefixo mais longo)
    let requiredModule: string | null = null;
    let longestPrefix = '';

    for (const routePrefix in PERMISSION_MAP) {
      if (pathname.startsWith(routePrefix)) {
        // Se o prefixo atual for mais longo que o melhor encontrado até agora
        if (routePrefix.length > longestPrefix.length) {
          longestPrefix = routePrefix;
          requiredModule = PERMISSION_MAP[routePrefix];
        }
        // Não usar break, continuar verificando todos os prefixos
      }
    }

    // Se a rota não requer permissão específica (COMO /home)
    if (!requiredModule) {
      console.log(`[Middleware] DECISÃO: Rota ${pathname} não requer módulo de permissão específico. Permitindo acesso.`);
      return response; // Permite acesso
    }

    console.log(`[Middleware] Rota ${pathname} requer permissão no módulo \'${requiredModule}\'.`);

    // --- Implementação da Lógica de Permissão de Grupo ---
    console.log(`[Middleware] Verificando permissões de grupo para ${user?.email}...`); // Mensagem ajustada

    // 1. Obter o ID interno do usuário (tabela usuarios) a partir do ID de autenticação
    const { data: userData, error: dbError } = await supabase
        .from('usuarios')
        .select('id') // Apenas o ID interno é necessário aqui
        .eq('auth_id', user.id)
        .single();

    if (dbError || !userData) {
        console.error(`[Middleware] Erro ao buscar ID interno do usuário ${user.id} ou usuário não encontrado na tabela 'usuarios'. Erro: ${dbError?.message}`);
        return NextResponse.redirect(new URL(HOME_ROUTE + '?error=user_profile_not_found', request.url));
    }
    const userId = userData.id;
    console.log(`[Middleware] ID interno do usuário: ${userId}`);

    // ---- INÍCIO: Lógica REVISADA para verificar is_master ----
    // 2. Buscar TODOS os grupos do usuário, incluindo o status 'is_master'
    console.log(`[Middleware] Buscando TODOS os grupos para usuário ${userId}...`);
    const { data: userGroupsData, error: groupsError } = await supabase
      .from('usuarios_grupos')
      .select(`
        grupo_id,
        grupos ( id, nome, is_master ) 
      `)
      .eq('usuario_id', userId); // Busca todos os grupos do usuário

    if (groupsError) {
        console.error(`[Middleware] Erro ao buscar grupos para usuário ${userId}: ${groupsError.message}`);
        return NextResponse.redirect(new URL(HOME_ROUTE + '?error=groups_fetch_error', request.url));
    }

    // @ts-ignore - Remover esta linha
    const isMemberOfMasterGroup = userGroupsData?.some(ug => ug.grupos?.is_master === true) ?? false;
    console.log(`[Middleware] Verificação JS - Usuário ${user?.email} pertence a grupo master? ${isMemberOfMasterGroup}`);

    // Se o usuário pertence a um grupo master (verificado via JS)
    if (isMemberOfMasterGroup) {
        console.log(`[Middleware] DECISÃO: Usuário ${user?.email} (ID: ${userId}) pertence a um grupo master (verificado via JS). Acesso permitido a ${pathname}.`);
        return response; // Permite acesso
    }

    // Se chegou aqui, o usuário NÃO pertence a nenhum grupo master. Prosseguir com verificação RPC.
    console.log(`[Middleware] Usuário ${user?.email} (ID: ${userId}) não é master (verificado via JS). Verificando permissões específicas via RPC...`);
    // ---- FIM: Lógica REVISADA ----

    // --- INÍCIO: Chamadas RPC de Teste (Manter por enquanto para depuração) ---
    try {
      console.log(`[Middleware][TESTE] Chamando RPC para 'crypto'...`);
      // @ts-ignore
      const { data: permCrypto, error: errCrypto } = await supabase.rpc('check_user_permission', { user_id_param: userId, module_param: 'crypto' });
      console.log(`[Middleware][TESTE] Resultado para 'crypto':`, { permCrypto, errCrypto });

      console.log(`[Middleware][TESTE] Chamando RPC para 'admin_usuarios'...`);
      // @ts-ignore
      const { data: permAdminUsers, error: errAdminUsers } = await supabase.rpc('check_user_permission', { user_id_param: userId, module_param: 'admin_usuarios' });
      console.log(`[Middleware][TESTE] Resultado para 'admin_usuarios':`, { permAdminUsers, errAdminUsers });
      
      console.log(`[Middleware][TESTE] Chamando RPC para 'perm_invalida'...`);
      // @ts-ignore
      const { data: permInvalida, error: errInvalida } = await supabase.rpc('check_user_permission', { user_id_param: userId, module_param: 'perm_invalida' });
      console.log(`[Middleware][TESTE] Resultado para 'perm_invalida':`, { permInvalida, errInvalida });

    } catch (testError) {
        console.error("[Middleware][TESTE] Erro durante chamadas RPC de teste:", testError);
    }
    // --- FIM: Chamadas RPC de Teste ---

    // 3. Verificar permissão usando a função RPC do banco de dados (CHAMADA REAL)
    console.log(`[Middleware] --- PRE: Chamando RPC check_user_permission (REAL) --- Parâmetros: userId=${userId}, module=${requiredModule}`);
    // @ts-ignore - Ignorar erro de tipo temporariamente até regenerar tipos do Supabase
    const { data: hasPermission, error: rpcError } = await supabase.rpc('check_user_permission', {
      user_id_param: userId,
      module_param: requiredModule
    });
    console.log(`[Middleware] --- POST: Chamada RPC --- Erro: ${!!rpcError}, Permissão: ${hasPermission}`);

    if (rpcError) {
      console.error(`[Middleware] Erro ao chamar RPC check_user_permission: ${rpcError.message}`);
      return NextResponse.redirect(new URL(HOME_ROUTE + '?error=permission_rpc_error', request.url));
    }

    // Se a função RPC retornou true, o usuário tem permissão
    if (hasPermission === true) {
      console.log(`[Middleware] DECISÃO: Usuário ${user?.email} tem permissão para ${pathname} (verificado via RPC). Acesso permitido.`);
      return response; // Permite acesso
    }
    // --- Fim da Implementação (agora usando RPC) ---

    // Se chegou aqui, não é master e a função RPC retornou false
    console.warn(`[Middleware] DECISÃO: Usuário ${user?.email} NÃO tem permissão para ${pathname} (verificado via RPC). Redirecionando para ${HOME_ROUTE} com erro.`);
    return NextResponse.redirect(new URL(HOME_ROUTE + '?error=unauthorized', request.url));
  }

  // Fallback (não deve ser atingido idealmente)
  console.warn(`[Middleware] Nenhuma regra de tratamento encontrada para ${pathname}. Permitindo passagem por padrão.`);
  return response;
}

// Configurar quais rotas devem passar pelo middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes que não precisam de autenticação)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 
