export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string
          nome: string
          cnpj: string | null
          email: string | null
          telefone: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          cnpj?: string | null
          email?: string | null
          telefone?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          cnpj?: string | null
          email?: string | null
          telefone?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      grupos: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          empresa_id: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          empresa_id: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          descricao?: string | null
          empresa_id?: string
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_empresa_id_fkey"
            columns: ["empresa_id"]
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          }
        ]
      }
      grupos_permissoes: {
        Row: {
          grupo_id: string
          permissao_id: string
          criado_em: string
        }
        Insert: {
          grupo_id: string
          permissao_id: string
          criado_em?: string
        }
        Update: {
          grupo_id?: string
          permissao_id?: string
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_permissoes_grupo_id_fkey"
            columns: ["grupo_id"]
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_permissoes_permissao_id_fkey"
            columns: ["permissao_id"]
            referencedRelation: "permissoes"
            referencedColumns: ["id"]
          }
        ]
      }
      permissoes: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          modulo: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          modulo: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          descricao?: string | null
          modulo?: string
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          id: string
          auth_id: string
          nome: string
          email: string
          empresa_id: string
          ativo: boolean
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          auth_id: string
          nome: string
          email: string
          empresa_id: string
          ativo?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          auth_id?: string
          nome?: string
          email?: string
          empresa_id?: string
          ativo?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          }
        ]
      }
      usuarios_grupos: {
        Row: {
          usuario_id: string
          grupo_id: string
          criado_em: string
        }
        Insert: {
          usuario_id: string
          grupo_id: string
          criado_em?: string
        }
        Update: {
          usuario_id?: string
          grupo_id?: string
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_grupos_grupo_id_fkey"
            columns: ["grupo_id"]
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_grupos_usuario_id_fkey"
            columns: ["usuario_id"]
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          }
        ]
      }
      vendas: {
        Row: {
          id: string
          numero: string
          cliente: string
          valor_total: number
          data_venda: string
          status: string
          empresa_id: string
          usuario_id: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          numero: string
          cliente: string
          valor_total: number
          data_venda?: string
          status?: string
          empresa_id: string
          usuario_id?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          numero?: string
          cliente?: string
          valor_total?: number
          data_venda?: string
          status?: string
          empresa_id?: string
          usuario_id?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_empresa_id_fkey"
            columns: ["empresa_id"]
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_usuario_id_fkey"
            columns: ["usuario_id"]
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          }
        ]
      }
      crypto_operacoes: {
        Row: {
          id: string
          usuario_id: string
          moeda_id: string
          simbolo: string
          nome: string
          tipo: string
          quantidade: number
          preco_unitario: number
          valor_total: number
          taxa: number
          data_operacao: string
          exchange: string
          notas: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          usuario_id: string
          moeda_id: string
          simbolo: string
          nome: string
          tipo: string
          quantidade: number
          preco_unitario: number
          valor_total: number
          taxa: number
          data_operacao: string
          exchange: string
          notas?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          moeda_id?: string
          simbolo?: string
          nome?: string
          tipo?: string
          quantidade?: number
          preco_unitario?: number
          valor_total?: number
          taxa?: number
          data_operacao?: string
          exchange?: string
          notas?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_operacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 