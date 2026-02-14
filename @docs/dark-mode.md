# Implementação de Dark Mode

Este documento detalha a implementação do Dark Mode no projeto Crypto Raiskas, explicando como a funcionalidade foi construída, como utilizá-la e como expandir/personalizar temas no futuro.

## Visão Geral

A implementação do Dark Mode utiliza o pacote `next-themes` em conjunto com Tailwind CSS para oferecer uma experiência de temas consistente em toda a aplicação. A implementação suporta três modos:

- **Claro**: Tema padrão com fundo claro e texto escuro
- **Escuro**: Tema alternativo com fundo escuro e texto claro
- **Sistema**: Ajusta-se automaticamente com base nas preferências do sistema operacional do usuário

## Componentes Principais

### ThemeProvider

O `ThemeProvider` é o componente central que gerencia o estado do tema. Ele é implementado em `src/components/theme-provider.tsx` e é responsável por:

- Fornecer o contexto de tema para toda a aplicação
- Persistir a escolha do tema no localStorage
- Sincronizar com as preferências do sistema do usuário

```tsx
// src/components/theme-provider.tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

### ThemeToggle

O `ThemeToggle` é um componente de interface que permite ao usuário alternar entre os temas disponíveis. Ele é implementado em `src/components/theme-toggle.tsx` e fornece:

- Um botão com ícones que se alternam (sol/lua)
- Um menu dropdown para seleção de temas
- Feedback visual do tema ativo

```tsx
// src/components/theme-toggle.tsx (resumido)
export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="icon">
          <Sun className="... dark:scale-0" />
          <Moon className="... dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Integrações nos Layouts

O Dark Mode está integrado em toda a aplicação através de modificações em três layouts principais:

### RootLayout

O `RootLayout` envolve toda a aplicação com o `ThemeProvider` e adiciona `suppressHydrationWarning` para evitar erros de hidratação do tema durante o carregamento da página.

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### DashboardLayout e AuthLayout

Estes layouts incluem os componentes de cabeçalho respectivos que contêm o botão `ThemeToggle`:

```tsx
// src/app/(dashboard)/layout.tsx (resumido)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireAuth={true}>
      <div className="flex min-h-screen flex-col">
        <DashboardHeader />
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  );
}
```

## Configuração de Estilos

Os estilos para os temas claro e escuro estão definidos em `src/app/globals.css` usando variáveis CSS personalizadas e classes Tailwind. A aplicação usa as seguintes estratégias:

1. Variáveis CSS para definir cores específicas para cada tema
2. Classe `.dark` aplicada ao elemento `html` quando o tema escuro está ativo
3. Utilitários Tailwind como `dark:bg-slate-900` para estilos condicionais

## Como Utilizar o Dark Mode em Novos Componentes

Ao desenvolver novos componentes, siga estas práticas:

1. **Use classes semânticas do Tailwind**:
   ```tsx
   // Preferir
   <div className="bg-background text-foreground">
     <p className="text-muted-foreground">Conteúdo</p>
   </div>
   
   // Evitar
   <div className="bg-white text-black">
     <p className="text-gray-500">Conteúdo</p>
   </div>
   ```

2. **Para casos específicos, use modificadores `dark:`**:
   ```tsx
   <div className="border border-gray-200 dark:border-gray-700">
     <span className="text-blue-500 dark:text-blue-400">Destaque</span>
   </div>
   ```

3. **Cores de marca podem ser aplicadas diretamente**:
   ```tsx
   <button className="bg-primary text-primary-foreground">
     Botão Principal
   </button>
   ```

## Verificando o Tema Ativo no JavaScript

Para lógica que depende do tema atual, utilize o hook `useTheme`:

```tsx
import { useTheme } from "next-themes";

function MyComponent() {
  const { theme, setTheme } = useTheme();
  
  return (
    <div>
      <p>Tema atual: {theme}</p>
      <button onClick={() => setTheme("dark")}>
        Mudar para escuro
      </button>
    </div>
  );
}
```

## Personalizações Futuras

Para personalizar ou adicionar novos temas:

1. **Adicionando novas variáveis no `globals.css`**:
   ```css
   :root {
     /* Variáveis existentes... */
     --nova-cor: #valor;
   }
   
   .dark {
     /* Variáveis do tema escuro... */
     --nova-cor: #valor-escuro;
   }
   ```

2. **Adicionando novos temas**:
   - Modifique o `ThemeProvider` para incluir `themes={['light', 'dark', 'system', 'novo-tema']}`
   - Crie as classes CSS correspondentes
   - Adicione a opção ao `ThemeToggle`

## Testes

Para garantir o funcionamento correto do Dark Mode, consulte `tests/theme.test.ts` para exemplos de estratégias de teste, incluindo:

- Testes unitários para os componentes `ThemeProvider` e `ThemeToggle`
- Testes de integração com Cypress ou Playwright
- Guia para testes manuais 