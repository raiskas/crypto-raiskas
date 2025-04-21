// Tipos compartilhados para a área administrativa

// Estrutura de um Usuário (combinando Auth + DB)
export interface User {
  id: string; // auth_id
  db_id: string | null; // id da tabela usuarios
  nome: string;
  email?: string;
  empresa_id: string | null;
  ativo: boolean;
  criado_em: string | null;
  ultimo_login: string | null;
  confirmado: boolean;
  grupo_id?: string | null; // ADICIONADO AQUI
  // Adicionar outros campos da tabela usuarios se necessário
  is_master?: boolean;
  telefone?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_complemento?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_cep?: string | null;
}

// Estrutura de um Grupo de Permissão
export interface Group {
  id: string;
  nome: string;
  descricao?: string | null;
  empresa_id?: string | null; // Pode ser útil
  is_master?: boolean | null;
  telas_permitidas?: string[] | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

// REAPLICANDO: Estrutura para Empresa
export interface Empresa {
    id: string;
    nome: string;
    cnpj?: string | null;
    ativo?: boolean | null;
    // Adicionar outros campos se forem necessários no frontend
}

// Você pode adicionar outras interfaces compartilhadas aqui
// export interface Permissao { ... }
// export interface Tela { ... } 