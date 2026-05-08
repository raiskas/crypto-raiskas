- [x] Inspecionar a planilha XLSX e confirmar o layout das colunas
- [x] Revisar a modelagem da tabela crypto_operacoes e o portfolio USDT no banco
- [x] Montar o plano de importação e listar transformações/validações antes de inserir
- [x] Gerar os registros normalizados a partir da planilha
- [x] Validar destino e ausência de conflito no portfolio USDT
- [x] Inserir as operações em lote no banco
- [x] Conferir quantidade e totais importados no portfolio USDT

- [x] Remover exposição de credenciais privilegiadas da configuração compartilhada
- [x] Endurecer autenticação/autorização das rotas perigosas
- [x] Remover dependência do setup público nas telas de crypto
- [x] Corrigir fallback inseguro de usuário atual
- [x] Reforçar validações de ownership no PATCH de crypto_operacoes
- [x] Validar build e fluxos principais após endurecimento

- [x] Corrigir tela azul/flash na raiz `/` sem depender de hidratação cliente
- [x] Remover imports server-only de CoinGecko dos componentes client
- [x] Corrigir carregamento client de dados em `/crypto` sem depender de `useAuth().user`
- [x] Revalidar `/crypto` e `/crypto/carteira` em `next build` + `next start`
- [x] Corrigir corrida de sessão no login com redirect duro e respeito ao parâmetro `redirect`
- [x] Adicionar retry curto nas buscas protegidas de `/crypto` e `/home` para evitar página vazia pós-login
- [x] Expor mensagem real de erro em localhost e revalidar fluxo autenticado ponta a ponta
- [x] Isolar a regressão de hidratação/refetch pós-login nas telas protegidas
- [x] Impedir que refetch inicial sobrescreva dados SSR com resposta redirecionada para signin
- [x] Validar em build + start e confirmar conteúdo real em /home, /crypto e /crypto/carteira
- [x] Mapear pontos de navegação/estado entre /crypto e /crypto/carteira
- [x] Tornar carteira_id a fonte principal via query string na Carteira
- [x] Validar build e fluxo real de navegação entre portfolio e carteira

- [x] Extrair o cookie real de sessão do navegador local
- [x] Comparar respostas das APIs de carteira/performance/operações para portfolios diferentes
- [x] Corrigir a camada que ignora `carteira_id`
- [x] Validar a troca de portfolio na UI com build/start estáveis
- [x] Mapear o fluxo atual de portfolio no app iOS
- [x] Identificar telas e serviços que ainda assumem carteira única
- [x] Implementar seleção e vínculo de portfolio nas telas iOS relevantes
- [x] Validar build do app iOS e revisar impactos do fluxo novo

- [x] Revisar a implementação atual do motor de alertas com base nas docs oficiais
- [x] Aplicar cooldown real e elegibilidade por `next_eligible_at` na Edge Function
- [x] Adicionar rastreabilidade APNs (`apns-id`, expiração e logs de erro)
- [x] Validar a function com checagem estática após as mudanças

- [x] Validar o advisory do Supabase para RLS desabilitado em `admin_config`
- [x] Aplicar a correção mínima segura no banco remoto
- [x] Confirmar impacto e registrar o resultado

- [x] Mapear o uso real das tabelas `crypto_*` na web e no app iOS
- [x] Desenhar policies RLS seguras para o bloco `crypto`
- [x] Aplicar a migration de RLS do bloco `crypto` no remoto de forma isolada
- [x] Validar web e iOS após a aplicação
