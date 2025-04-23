# Guia de Desenvolvimento

Este guia fornece instruções detalhadas para desenvolvedores que estão começando a trabalhar no projeto Crypto Raiskas.

## Configuração do Ambiente de Desenvolvimento

### Requisitos

- **Node.js**: v18+ (preferencialmente v20+)
- **pnpm**: v8+
- **Editor**: VS Code ou outro editor com suporte TypeScript
- **Conta no Supabase**: Para acesso ao banco de dados e autenticação

### Passos para Configuração

1. **Clone o repositório**

   ```bash
   git clone <url-do-repositorio>
   cd crypto_raiskas
   ```

2. **Instale as dependências**

   ```bash
   pnpm install
   ```

3. **Configure as variáveis de ambiente**

   Crie um arquivo `.env.local` na raiz do projeto baseado no `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

   Edite o arquivo `.env.local` para incluir suas credenciais do Supabase:

   ```
   NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
   SUPABASE_SERVICE_ROLE_KEY=sua_chave_de_servico
   ```

4. **Configure o banco de dados**

   Utilize o script para inicializar o banco de dados:

   ```bash
   pnpm db:init
   ```

   Este script cria as tabelas necessárias e insere dados iniciais no Supabase.

5. **Inicie o servidor de desenvolvimento**

   ```bash
   pnpm dev
   ```

   Acesse a aplicação em `http://localhost:3000`

## Estrutura do Código

### Convenções e Padrões

- **TypeScript**: Use tipos estáticos sempre que possível
- **Components**: Prefira componentes de função com hooks
- **CSS**: Use Tailwind CSS para estilos
- **Formulários**: Use React Hook Form + Zod para validação
- **Estado**: Gerenciamento local com hooks useState/useReducer
- **Estado Compartilhado (Ex: Preços Crypto)**: Para dados que precisam ser acessíveis em múltiplos componentes do dashboard (como preços de criptomoedas atualizados), utilize o padrão Context API. Exemplo implementado: `PriceProvider` e `usePrice` (em `src/lib/context/PriceContext.tsx`) para o preço do Bitcoin. Use `usePrice()` em qualquer Client Component dentro do `(dashboard)/layout.tsx` para acessar o valor.
- **Rotas**: Siga a convenção de nomenclatura do Next.js App Router
- **Isolamento**: Coloque componentes específicos de página em seus diretórios

### Principais Diretórios

- **`/src/app`**: Páginas e layout da aplicação
- **`/src/components`**: Componentes reutilizáveis
- **`/src/lib`**: Funções utilitárias e bibliotecas
- **`/src/types`**: Definições de tipos TypeScript

## Fluxo de Trabalho de Desenvolvimento

### Adicionando Novas Features

1. **Comece com o banco de dados**:
   - Adicione tabelas/campos necessários no PostgreSQL
   - Atualize o arquivo `supabase-schema.sql`

2. **Crie componentes reutilizáveis**:
   - Coloque-os em `/src/components`
   - Siga o padrão existente para componentes

3. **Implemente páginas**:
   - Crie um novo diretório em `/src/app`
   - Implemente `page.tsx` seguindo o padrão App Router

4. **Adicione rotas de API**:
   - Crie endpoints em `/src/app/api`
   - Use validação Zod para dados de entrada
   - **Nota:** Já existem APIs para gerenciamento de usuários (`/api/admin/users`) e operações de cripto (`/api/crypto/...`). Verifique se pode reutilizar ou estender a lógica existente.

5. **Atualize o middleware**:
   - Adicione a rota ao middleware se ela for protegida

### Trabalhando com Autenticação

1. **Use o hook `useAuth`** para interagir com a autenticação no cliente
2. **Verifique permissões** antes de renderizar conteúdo sensível
3. **Proteja rotas de API** com verificações de autenticação e permissões

### Trabalhando com Estado Compartilhado (Preço Crypto)
*   Para acessar o preço atualizado do Bitcoin em qualquer componente do dashboard, use o hook `usePrice()` importado de `@/lib/context/PriceContext`.

## Padrões de Código

### Componentes

```tsx
// src/components/ExampleComponent.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ExampleComponentProps {
  initialValue: number;
  onChange?: (value: number) => void;
}

export function ExampleComponent({ 
  initialValue = 0, 
  onChange 
}: ExampleComponentProps) {
  const [value, setValue] = useState(initialValue);
  
  const handleIncrement = () => {
    const newValue = value + 1;
    setValue(newValue);
    onChange?.(newValue);
  };
  
  return (
    <div className="p-4 border rounded">
      <p>Valor atual: {value}</p>
      <Button onClick={handleIncrement}>Incrementar</Button>
    </div>
  );
}
```

### Página

```tsx
// src/app/example/page.tsx
"use client";

import { useState } from "react";
import { ExampleComponent } from "@/components/ExampleComponent";
import { useAuth } from "@/lib/hooks/use-auth";

export default function ExamplePage() {
  const { user } = useAuth();
  const [value, setValue] = useState(0);
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Página de Exemplo</h1>
      {user ? (
        <>
          <p>Olá, {user.email}</p>
          <ExampleComponent 
            initialValue={value} 
            onChange={setValue} 
          />
        </>
      ) : (
        <p>Carregando...</p>
      )}
    </div>
  );
}
```

### Rota de API

```tsx
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/utils/permissions";

// Schema de validação
const exampleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3),
});

export async function POST(request: NextRequest) {
  try {
    // Obter e validar os dados
    const body = await request.json();
    const validation = exampleSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { name, id } = validation.data;
    
    // Criar cliente Supabase
    const supabase = await createServerSupabaseClient();
    
    // Obter sessão atual
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }
    
    // Verificar permissão
    const userId = session.user.id;
    const hasAccess = await hasPermission(userId, "example_create");
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Sem permissão" },
        { status: 403 }
      );
    }
    
    // Processar a solicitação
    // ...
    
    return NextResponse.json(
      { message: "Sucesso", data: { id: "novo_id" } },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error("Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
```

## Testes e Depuração

### Logs

Use logs para diagnóstico em áreas críticas:

```typescript
console.log("Dados recebidos:", dados);
console.error("Erro ao processar solicitação:", erro);
```

Use o console do navegador e os logs do servidor para solucionar problemas.

### Verificando Autenticação

Para verificar se um usuário está autenticado:

1. Abra o Console no DevTools
2. Execute:
   ```javascript
   const { data } = await window.supabase.auth.getSession();
   console.log(data.session);
   ```

## Fluxo de Trabalho Git

Siga estas práticas para o controle de versão:

1. **Branches**:
   - `main`: Código de produção
   - `develop`: Código de desenvolvimento
   - `feature/nome-da-feature`: Implementação de novas funcionalidades
   - `bugfix/nome-do-bug`: Correções de bugs

2. **Commits**:
   ```
   [tipo]: Breve descrição da alteração
   
   Descrição mais detalhada se necessário.
   ```
   
   Tipos comuns:
   - `feat`: Nova funcionalidade
   - `fix`: Correção de bug
   - `docs`: Alterações na documentação
   - `style`: Formatação, ponto e vírgula ausentes; sem alteração de código
   - `refactor`: Refatoração de código de produção
   - `test`: Adição de testes, refatoração de testes; sem alteração no código de produção
   - `chore`: Atualização de tarefas de compilação, configurações de gerenciadores de pacotes, etc.

3. **Pull Requests**:
   - Descreva claramente o que foi implementado
   - Referencie issues relacionadas
   - Solicite revisão de pelo menos um colega de equipe

## Implantação

### Ambiente de Desenvolvimento

- Acessível através de `http://localhost:3000`
- Usa o banco de dados configurado no Supabase

### Ambiente de Produção

- Build para produção:
  ```bash
  pnpm build
  ```

- Iniciar em produção:
  ```bash
  pnpm start
  ```

## Recursos Adicionais

- [Documentação do Next.js](https://nextjs.org/docs)
- [Documentação do Supabase](https://supabase.io/docs)
- [Documentação do Tailwind CSS](https://tailwindcss.com/docs)
- [Documentação do React Hook Form](https://react-hook-form.com/get-started)
- [Documentação do Zod](https://zod.dev/)

## Problemas Conhecidos e Soluções Pendentes

Esta seção documenta problemas identificados que requerem atenção ou soluções que dependem de outras partes do sistema (como o backend).

1.  **Edição de Grupo - Carregamento Incompleto de Dados:**
    *   **Problema:** Ao editar um grupo (`/admin/grupos`), o modal não pré-seleciona a "Empresa" associada nem marca as "Telas Permitidas".
    *   **Diagnóstico:** A API `GET /api/admin/groups` (ou similar) que busca a lista inicial de grupos não está retornando os campos `empresa_id` e `telas_permitidas`. O frontend (`GroupSection.tsx`) está preparado para recebê-los.
    *   **Solução Pendente (Backend):** Modificar a API de listagem de grupos no backend para incluir `empresa_id` e `telas_permitidas` na consulta e na resposta.

2.  **Erros de Tipo com React Hook Form / Zod:**
    *   **Problema:** Ocasionalmente, ocorrem erros de tipo complexos na integração entre `react-hook-form`, `zod` e componentes de UI (shadcn/ui), especialmente em formulários de modais (usuários, grupos).
    *   **Solução Temporária (Pragmática):** Comentários `// @ts-ignore` foram aplicados para suprimir esses erros e permitir o desenvolvimento. Uma revisão futura das tipagens pode ser necessária.

3.  **Configuração de Imagens Externas (Next.js):**
    *   **Problema:** Erro `hostname "..." is not configured...` ao usar `<Image>` com fontes externas (ex: `cryptoicons.org`).
    *   **Solução Aplicada:** O hostname foi adicionado a `images.remotePatterns` em `next.config.js`. Lembre-se de reiniciar o servidor de dev após modificar `next.config.js`.

4.  **Cache da API CoinGecko na Vercel (Resolvido):**
    *   **Problema Anterio:** O preço do Bitcoin buscado da CoinGecko não atualizava na Vercel, exceto após um novo deploy.
    *   **Solução Aplicada:** Foi criada uma API route intermediária (`/api/preco`) que usa o cache `fetch` do Next.js com `revalidate: 60` para garantir a atualização periódica no servidor.

## Contribuições

(...)

---

Documentação criada em: 09/04/2024 