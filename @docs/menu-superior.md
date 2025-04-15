# Menu Superior (TopNav) - Documentação

Este documento detalha a implementação do menu superior no projeto Crypto Raiskas, sua estrutura, funcionamento e possíveis melhorias futuras.

## Visão Geral

O menu superior (TopNav) é um componente de navegação moderno que fornece acesso a todas as principais páginas e funcionalidades do sistema. Ele foi projetado para:

- Oferecer uma experiência de navegação limpa e moderna
- Ser completamente responsivo para todos os dispositivos
- Utilizar animações suaves para aumentar a qualidade da interação
- Destacar visualmente a seção atual da aplicação
- Integrar-se perfeitamente com o sistema de temas (claro/escuro)

## Componentes Principais

### TopNav (`src/components/layouts/top-nav.tsx`)

Este é o componente principal que implementa o menu superior. Ele inclui:

- Estrutura de itens de menu e menus dropdown
- Indicação visual clara do item de menu ativo
- Versão responsiva com menu hamburger para dispositivos móveis
- Integração com as informações de usuário
- Controles para alternar tema e fazer logout

### DashboardLayout (`src/app/(dashboard)/layout.tsx`)

O layout do dashboard foi modificado para usar o menu superior, simplificando a hierarquia de componentes e melhorando a utilização do espaço na tela.

## Características Principais

### Design Moderno

- Gradiente sutil no logo
- Indicador de ativo com linha colorida abaixo do item
- Sombra suave para dar sensação de elevação
- Espaçamento e tipografia cuidadosamente ajustados

### Responsividade

- **Desktop**: Menu completo na horizontal
- **Tablet/Mobile**: Menu hamburger com abertura vertical e animação suave
- Adaptação automática a diferentes tamanhos de tela

### Funcionalidades

- Menus dropdown para categorias com muitos itens
- Destaque visual para o item atual
- Informações do usuário integradas
- Suporte a toggle de tema (claro/escuro)
- Animações suaves para melhorar a experiência

## Estratégias de Teste

Foram definidas várias estratégias de teste para o menu superior:

1. **Testes Unitários**: Verificando renderização, estados e interações
2. **Testes de Integração**: Verificando navegação real e comportamento responsivo
3. **Testes Manuais**: Verificando aspectos visuais, UX e compatibilidade

Consulte o arquivo `tests/top-nav.test.tsx` para exemplos detalhados.

## Possíveis Melhorias Futuras

### 1. Menu Dinâmico Baseado em Permissões

**Problema**: O menu é estático e igual para todos os usuários.

**Solução Proposta**: Implementar um sistema de permissões que ajuste dinamicamente os itens do menu.

```typescript
const fetchMenuItems = async (userId: string) => {
  const response = await fetch(`/api/user/${userId}/menu`);
  const data = await response.json();
  return data.menuItems;
};

// No componente
useEffect(() => {
  if (user) {
    fetchMenuItems(user.id).then(setMenuItems);
  }
}, [user]);
```

### 2. Menu Persistente com Scroll

**Problema**: Em páginas longas, o usuário precisa rolar até o topo para acessar o menu.

**Solução Proposta**: Adicionar comportamento de scroll inteligente, onde o menu desaparece ao rolar para baixo e reaparece ao iniciar rolagem para cima.

```typescript
useEffect(() => {
  let lastScrollY = window.scrollY;
  
  const handleScroll = () => {
    const scrollY = window.scrollY;
    const header = document.querySelector('header');
    
    if (scrollY > lastScrollY) {
      // Rolando para baixo - esconder
      header.classList.add('header-hidden');
    } else {
      // Rolando para cima - mostrar
      header.classList.remove('header-hidden');
    }
    
    lastScrollY = scrollY;
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

### 3. Notificações Integradas

**Problema**: O usuário não tem feedback visual imediato sobre notificações do sistema.

**Solução Proposta**: Adicionar um sistema de notificações integrado ao menu.

```typescript
interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// No componente
const [notifications, setNotifications] = useState<Notification[]>([]);
const unreadCount = notifications.filter(n => !n.read).length;

// Adicionar ao menu
<div className="ml-4 relative">
  <button className="p-2 rounded-full hover:bg-accent">
    <Bell className="h-5 w-5" />
    {unreadCount > 0 && (
      <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
        {unreadCount}
      </span>
    )}
  </button>
</div>
```

### 4. Melhorias de Acessibilidade

**Problema**: A acessibilidade atual pode ser aprimorada.

**Solução Proposta**: 
- Adicionar atributos ARIA completos
- Melhorar o suporte a navegação por teclado
- Implementar modos de alto contraste

```typescript
// Exemplo para o botão de menu mobile
<button
  aria-expanded={isMobileMenuOpen}
  aria-controls="mobile-menu"
  aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
  className="md:hidden"
  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
>
  {isMobileMenuOpen ? <X size={20} /> : <MenuIcon size={20} />}
</button>

// Para o menu mobile
<div 
  id="mobile-menu"
  role="navigation"
  aria-label="Menu de navegação mobile"
  className={cn(
    "md:hidden border-t overflow-hidden transition-all",
    isMobileMenuOpen ? "max-h-96" : "max-h-0"
  )}
>
```

### 5. Temas Personalizados

**Problema**: O sistema oferece apenas tema claro e escuro.

**Solução Proposta**: Permitir que usuários personalizem as cores do sistema.

```typescript
interface Theme {
  name: string;
  primary: string;
  secondary: string;
  background: string;
  // outras cores...
}

const userThemes: Theme[] = [
  { name: "Default", primary: "#3b82f6", ... },
  { name: "Ocean", primary: "#0ea5e9", ... },
  { name: "Forest", primary: "#10b981", ... },
];

// Adicionar seletor de tema no menu
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button variant="ghost" size="sm">
      <Palette className="h-4 w-4 mr-2" />
      <span>Tema</span>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {userThemes.map(theme => (
      <DropdownMenuItem 
        key={theme.name}
        onClick={() => setCurrentTheme(theme)}
      >
        {theme.name}
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

### 6. Menu Contextual

**Problema**: O menu não se adapta ao contexto da página atual.

**Solução Proposta**: Implementar um submenu contextual que muda conforme a seção atual.

```typescript
// Definir submenus contextuais por seção
const contextualMenus: Record<string, MenuItem[]> = {
  '/admin': [
    { title: "Visão Geral", href: "/admin", icon: <Home /> },
    { title: "Usuários", href: "/admin/usuarios", icon: <Users /> },
    // outros itens...
  ],
  '/vendas': [
    { title: "Dashboard", href: "/vendas", icon: <BarChart /> },
    { title: "Nova Venda", href: "/vendas/nova", icon: <Plus /> },
    // outros itens...
  ],
};

// No componente
const currentSection = Object.keys(contextualMenus)
  .find(path => pathname.startsWith(path)) || '';
const contextMenu = contextualMenus[currentSection] || [];

// Renderizar um submenu contextual abaixo do menu principal
{contextMenu.length > 0 && (
  <div className="bg-accent/10 border-b">
    <div className="container flex overflow-x-auto">
      {contextMenu.map(item => (
        <Link 
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center px-3 py-2 text-sm",
            pathname === item.href && "text-primary"
          )}
        >
          {item.icon}
          <span className="ml-2">{item.title}</span>
        </Link>
      ))}
    </div>
  </div>
)}
```

## Conclusão

O menu superior implementado fornece uma solução moderna e eficiente para navegação no sistema Crypto Raiskas. As melhorias futuras sugeridas podem ser implementadas incrementalmente conforme a aplicação evolui e as necessidades dos usuários se tornam mais claras. 