import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Verifica se um usuário tem uma determinada permissão
 */
export async function hasPermission(
  userId: string,
  permissionName: string
): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Buscar grupos do usuário
    const { data: userGroups, error: userGroupsError } = await supabase
      .from('usuarios_grupos')
      .select('grupo_id')
      .eq('usuario_id', userId);

    if (userGroupsError || !userGroups.length) return false;

    // Buscar permissão pelo nome
    const { data: permission, error: permissionError } = await supabase
      .from('permissoes')
      .select('id')
      .eq('nome', permissionName)
      .single();

    if (permissionError || !permission) return false;

    // Verificar se algum dos grupos do usuário tem a permissão
    const groupIds = userGroups.map((ug) => ug.grupo_id);
    
    const { count, error: countError } = await supabase
      .from('grupos_permissoes')
      .select('*', { count: 'exact', head: true })
      .eq('permissao_id', permission.id)
      .in('grupo_id', groupIds);

    if (countError) return false;
    
    return count ? count > 0 : false;
  } catch (error) {
    console.error("Erro ao verificar permissão:", error);
    return false;
  }
}

/**
 * Verifica se um usuário pertence a um determinado grupo
 */
export async function isInGroup(
  userId: string,
  groupName: string,
  empresaId: string
): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Buscar o grupo pelo nome e empresa
    const { data: group, error: groupError } = await supabase
      .from('grupos')
      .select('id')
      .eq('nome', groupName)
      .eq('empresa_id', empresaId)
      .single();

    if (groupError || !group) return false;

    // Verificar se o usuário está nesse grupo
    const { count, error: countError } = await supabase
      .from('usuarios_grupos')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('grupo_id', group.id);

    if (countError) return false;
    
    return count ? count > 0 : false;
  } catch (error) {
    console.error("Erro ao verificar grupo:", error);
    return false;
  }
} 