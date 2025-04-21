// src/types/admin.ts

// Interface para dados de Usuário (combinando o que temos)
export interface User {
    id: string; // Auth ID (geralmente UUID)
    db_id: string | number | null; // ID do banco de dados (pode ser string ou number, ajuste conforme seu DB)
    email: string;
    nome: string;
    empresa_id?: string | null;
    empresa?: { id: string; nome: string } | null; // Objeto da empresa relacionada
    grupo?: { id: string; nome: string } | null; // Objeto do grupo relacionado (primeiro encontrado)
    grupo_id?: string | null; // ID do grupo (mantido para compatibilidade)
    ativo: boolean;
    criado_em: string; // Data/Hora como string (ISO 8601 preferencialmente)
    ultimo_login?: string | null;
    confirmado?: boolean;
    is_master?: boolean;
    // Adicionar outros campos se necessário (ex: telefone, endereço etc. que vêm da API)
}

// Interface para dados de Grupo (incluindo permissões)
export interface Group {
    id: string | number; // ID do grupo (pode ser string ou number, ajuste conforme seu DB)
    nome: string;
    empresa_id: string | null; // ID da empresa, se houver
    empresa?: { id: string; nome: string } | null; // Objeto da empresa relacionada (opcional)
    descricao?: string | null;
    is_master?: boolean; // Flag para acesso total
    telas_permitidas?: string[]; // Array com IDs das telas permitidas
    criado_em?: string; // Data/Hora como string
    atualizado_em?: string; // Data/Hora como string
}

// Interface básica para Empresa
export interface Empresa {
    id: string;
    nome: string;
    // Adicionar outros campos conforme necessário
} 