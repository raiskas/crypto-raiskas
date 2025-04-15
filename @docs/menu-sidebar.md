# Menu Lateral (Sidebar) - Documentação

Este documento detalha a implementação do menu lateral no projeto Crypto Raiskas, sua estrutura, funcionamento e possíveis melhorias futuras.

## Visão Geral

O menu lateral (sidebar) é um componente de navegação que fornece acesso a todas as principais páginas e funcionalidades do sistema. Ele foi projetado para:

- Ser facilmente acessível em qualquer página da aplicação
- Ser responsivo, adaptando-se a diferentes tamanhos de tela
- Oferecer uma navegação organizada e hierárquica
- Destacar visualmente a seção atual da aplicação

## Componentes Principais

### Sidebar (`src/components/layouts/sidebar.tsx`)

Este é o componente principal que implementa o menu lateral. Ele inclui:

- Estrutura de itens de menu e submenus
- Lógica para expandir/contrair submenus
- Suporte a visualização em dispositivos móveis e desktop
- Destaque visual para o item ativo

### DashboardLayout (`src/app/(dashboard)/layout.tsx`)

O layout do dashboard foi modificado para incluir o menu lateral e ajustar o conteúdo principal para se alinhar adequadamente, mantendo o cabeçalho no topo.

### DashboardHeader (`src/components/layouts/dashboard-header.tsx`)

O cabeçalho foi simplificado para se integrar com o menu lateral, focando apenas em ações relacionadas ao usuário (alternância de tema e logout).

## Estrutura de Menu

O menu foi estruturado em categorias principais:

1. **Início** - Página principal da aplicação
2. **Dashboard** - Visão geral e estatísticas
3. **Vendas** - Módulo de vendas
4. **Relatórios** - Visualização de dados e métricas
5. **Administrativo** - Configurações e gerenciamento do sistema
   - Usuários
   - Permissões
   - Configurações
   - Banco de Dados
6. **Perfil** - Informações e preferências do usuário
7. **Documentação** - Manuais e guias do sistema

## Responsividade

O menu lateral foi projetado para ser totalmente responsivo:

- **Desktop**: Menu sempre visível, fixo na lateral esquerda
- **Tablet e Mobile**: Menu oculto por padrão, com botão fixo para abrir/fechar
- **Transições**: Animações suaves para melhorar a experiência do usuário

## Integração com o Sistema de Temas

O menu lateral está totalmente integrado com o sistema de temas (dark/light) da aplicação, usando as variáveis CSS e classes Tailwind apropriadas para garantir consistência visual.

## Estratégias de Teste

Foram definidas várias estratégias de teste para o menu lateral:

1. **Testes Unitários**: Verificando a renderização correta, interações com o usuário e lógica de navegação
2. **Testes de Integração**: Verificando a navegação real entre páginas e comportamento responsivo
3. **Testes Manuais**: Verificando UX, acessibilidade e comportamento em diferentes dispositivos

Consulte o arquivo `tests/sidebar.test.tsx` para exemplos detalhados.

## Possíveis Melhorias Futuras

### 1. Personalização do Menu

**Problema**: Atualmente, o menu é estático e igual para todos os usuários.

**Solução Proposta**: Implementar um sistema de permissões que ajuste dinamicamente os itens do menu com base nas permissões do usuário.

```typescript
// Exemplo de implementação futura
const menuItems = await fetchMenuItemsForUser(userId);
```

### 2. Favoritos e Atalhos

**Problema**: Usuários com fluxos de trabalho específicos precisam navegar repetidamente para as mesmas páginas.

**Solução Proposta**: Adicionar seção de favoritos/atalhos personalizáveis no topo do menu.

```typescript
const [favorites, setFavorites] = useState<MenuItem[]>([]);

// Permitir que usuários adicionem/removam favoritos
const toggleFavorite = (item: MenuItem) => {
  // Lógica para adicionar/remover favoritos
};
```

### 3. Histórico de Navegação

**Problema**: Não há recurso de "voltar" inteligente para ações anteriores.

**Solução Proposta**: Implementar um histórico de navegação recente.

### 4. Melhorias de Acessibilidade

**Problema**: A acessibilidade atual pode ser aprimorada.

**Solução Proposta**: 
- Implementar suporte completo a navegação por teclado
- Adicionar atributos ARIA mais abrangentes
- Melhorar o contraste de cores e tamanhos de fonte

### 5. Estado Persistente de Submenus

**Problema**: Os submenus abertos não persistem entre navegações.

**Solução Proposta**: Armazenar o estado de expansão do menu no localStorage.

```typescript
// Ao inicializar
useEffect(() => {
  const savedState = localStorage.getItem('openMenuGroups');
  if (savedState) {
    setOpenGroups(JSON.parse(savedState));
  }
}, []);

// Ao alterar
useEffect(() => {
  localStorage.setItem('openMenuGroups', JSON.stringify(openGroups));
}, [openGroups]);
```

### 6. Indicadores de Notificação

**Problema**: Não há indicação visual de novos itens ou ações pendentes.

**Solução Proposta**: Adicionar indicadores de notificação aos itens de menu relevantes.

```typescript
interface MenuItemWithBadge extends MenuItem {
  badge?: {
    count: number;
    color: string;
  };
}
```

### 7. Modo Compacto

**Problema**: O menu ocupa espaço considerável na tela.

**Solução Proposta**: Implementar modo compacto que mostra apenas ícones (expandindo ao passar o mouse).

```typescript
const [compactMode, setCompactMode] = useState(false);

// Classe condicional
className={cn(
  "sidebar",
  compactMode ? "w-16" : "w-64"
)}
```

## Conclusão

O menu lateral implementado fornece uma solução robusta e moderna para navegação no sistema Crypto Raiskas. As melhorias futuras sugeridas podem ser implementadas incrementalmente conforme a aplicação evolui e as necessidades dos usuários se tornam mais claras. 