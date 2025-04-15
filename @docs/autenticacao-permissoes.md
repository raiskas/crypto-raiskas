# Sistema de Autenticação e Permissões

## Visão Geral

O Crypto Raiskas implementa um sistema robusto de autenticação e controle de acesso baseado em permissões. Este documento detalha o funcionamento desse sistema e como utilizá-lo corretamente na aplicação.

## Arquitetura de Autenticação

### Camadas de Autenticação

O sistema utiliza uma abordagem em camadas:

1. **Supabase Auth**: Gerencia o registro, login e sessões dos usuários
2. **Tabelas Personalizadas**: Armazenam dados adicionais dos usuários e seus relacionamentos
3. **Middleware**: Protege rotas com base no estado de autenticação
4. **Verificação de Permissões**: Controla o acesso a funcionalidades específicas

### Fluxo de Dados

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Supabase   │     │  Tabelas    │     │ Funcionalidades│
│     Auth    │────▶│ Customizadas│────▶│   da App     │
└─────────────┘     └─────────────┘     └──────────────┘
        │                                      ▲
        │                                      │
        └──────────────────────────────────────┘
                   Verificação direta
```

## Componentes do Sistema

### 1. Hook de Autenticação (`useAuth`)

O hook `useAuth` é o principal ponto de interação com o sistema de autenticação no frontend. Ele oferece:

- Gerenciamento de estado do usuário
- Funções para login, registro e logout
- Verificação do estado de autenticação

```typescript
const { user, loading, sessionChecked, signIn, signUp, signOut } = useAuth();
```

**Exemplo de uso para login:**

```tsx
const handleLogin = async () => {
  const result = await signIn(email, password);
  if (result.success) {
    // Login bem-sucedido
  } else {
    // Tratar erro
  }
};
```

### 2. Middleware de Proteção de Rotas

O middleware (`src/middleware.ts`) verifica o estado de autenticação do usuário e controla o acesso às rotas:

- Usuários não autenticados são redirecionados para `/signin` ao tentar acessar rotas protegidas
- Usuários autenticados são redirecionados para `/home` ao tentar acessar páginas de autenticação
- A raiz (`/`) redireciona com base no estado de autenticação

### 3. Modelo de Dados para Permissões

O sistema utiliza um modelo de permissões baseado em grupos:

- **Permissões**: Representam ações específicas que podem ser executadas
- **Grupos**: Agrupam permissões e são atribuídos a usuários
- **Usuários**: Pertencem a um ou mais grupos e herdam suas permissões

```
┌──────────┐     ┌─────────────┐     ┌────────────┐
│ Usuários │────▶│   Grupos    │────▶│ Permissões │
└──────────┘     └─────────────┘     └────────────┘
```

### 4. Utilidades de Verificação de Permissões

O arquivo `src/lib/utils/permissions.ts` contém funções para verificar permissões:

- `hasPermission(userId, permissionName)`: Verifica se um usuário tem uma permissão específica
- `isInGroup(userId, groupName, empresaId)`: Verifica se um usuário pertence a um grupo

## Integração de Autenticação e Banco de Dados

### Criação de Usuário

Ao registrar um novo usuário:

1. Um registro é criado no Supabase Auth com e-mail e senha
2. A API `/api/auth/register` é chamada para:
   - Criar uma empresa na tabela `empresas`
   - Criar um usuário na tabela `usuarios` vinculado à empresa e ao auth_id
   - Criar um grupo "Administradores" para a empresa
   - Adicionar o usuário ao grupo
   - Conceder todas as permissões ao grupo

### Verificação de Autenticação

A verificação da autenticação ocorre em múltiplos níveis:

1. **Lado do cliente**: O hook `useAuth` verifica a sessão e atualiza o estado
2. **Middleware**: Protege rotas com base na presença de uma sessão válida
3. **API**: Rotas de API protegidas verificam a autenticação antes de processar solicitações

## Permissões Padrão

O sistema vem com as seguintes permissões pré-configuradas:

| Nome | Descrição | Módulo |
|------|-----------|--------|
| `usuario_visualizar` | Visualizar usuários | usuarios |
| `usuario_criar` | Criar usuários | usuarios |
| `usuario_editar` | Editar usuários | usuarios |
| `usuario_excluir` | Excluir usuários | usuarios |
| `grupo_visualizar` | Visualizar grupos | grupos |
| `grupo_criar` | Criar grupos | grupos |
| `grupo_editar` | Editar grupos | grupos |
| `grupo_excluir` | Excluir grupos | grupos |
| `venda_visualizar` | Visualizar vendas | vendas |
| `venda_criar` | Criar vendas | vendas |
| `venda_editar` | Editar vendas | vendas |
| `venda_excluir` | Excluir vendas | vendas |

## Modelo Multi-Tenant

O sistema é projetado para suportar múltiplas empresas (multitenancy):

- Cada empresa tem seus próprios usuários, grupos e permissões
- Os dados são isolados por empresa usando o campo `empresa_id`
- Todas as consultas de dados incluem filtros por empresa do usuário logado

## Como Implementar Verificação de Permissões

### No Servidor (Server Components ou API Routes)

```typescript
import { hasPermission } from "@/lib/utils/permissions";

// Em uma rota de API
export async function GET(request) {
  const userId = "..."; // Obter do contexto de autenticação
  
  // Verificar permissão
  const canViewUsers = await hasPermission(userId, "usuario_visualizar");
  
  if (!canViewUsers) {
    return new Response(JSON.stringify({ error: "Sem permissão" }), {
      status: 403,
    });
  }
  
  // Continuar processamento...
}
```

### No Cliente (Client Components)

```tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";

function ProtectedComponent() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  
  useEffect(() => {
    async function checkPermission() {
      if (user) {
        // Chamar uma API para verificar permissão
        const response = await fetch(`/api/check-permission?permission=venda_criar`);
        const data = await response.json();
        setHasAccess(data.hasPermission);
      }
    }
    
    checkPermission();
  }, [user]);
  
  if (!hasAccess) {
    return <p>Você não tem permissão para acessar este conteúdo.</p>;
  }
  
  return <div>Conteúdo protegido aqui...</div>;
}
```

## Boas Práticas

1. **Sempre verifique permissões**:
   - No servidor antes de executar operações sensíveis
   - No cliente para esconder elementos UI inacessíveis

2. **Não confie apenas em esconder elementos de UI**:
   - Sempre implemente verificações de permissão no backend/API
   - Considere UI condicional como conveniência, não como segurança

3. **Tenha cuidado com escopo de permissões**:
   - Defina permissões granulares
   - Agrupe permissões logicamente em grupos

4. **Permissões por módulo**:
   - Organize permissões por módulos funcionais
   - Cada módulo deve ter seu conjunto de permissões CRUD

## Troubleshooting

### Problemas Comuns

1. **Usuário autenticado mas sem acesso a recursos**:
   - Verifique se o usuário está conectado a uma empresa
   - Verifique se o usuário pertence a pelo menos um grupo
   - Verifique se os grupos têm as permissões necessárias

2. **Erro "Supabase client is not initialized"**:
   - Verifique se as variáveis de ambiente estão configuradas corretamente
   - Reinicie o servidor de desenvolvimento

3. **Redirecionamento em loop**:
   - Verifique o middleware e as regras de redirecionamento
   - Verifique o estado de autenticação no hook `useAuth`

## Ampliando o Sistema

### Adicionando Novas Permissões

1. Adicione registros à tabela `permissoes` seguindo o padrão existente:
   ```sql
   INSERT INTO permissoes (nome, descricao, modulo) VALUES
     ('nova_permissao', 'Descrição da permissão', 'modulo');
   ```

2. Atualize o arquivo `supabase-schema.sql` para incluir a nova permissão

### Criando Novos Grupos

Grupos podem ser criados dinamicamente via UI ou diretamente no banco de dados:

```sql
INSERT INTO grupos (nome, descricao, empresa_id) VALUES
  ('Novo Grupo', 'Descrição do grupo', 'empresa_uuid');
```

---

Documentação criada em: 09/04/2024 