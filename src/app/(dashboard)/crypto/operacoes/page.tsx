"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Pencil, Trash2, ArrowUpDown, ListX, Loader2, PlusCircle, AlertCircle } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "../../../../components/ui/loading-spinner";
import { getSupabase } from "@/lib/supabase/client";
import { Database } from "@/types/supabase";

// Interface para tipagem das operações
interface Operacao {
  id: string;
  moeda_id: string;
  simbolo: string;
  nome: string;
  tipo: "compra" | "venda";
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  taxa: number;
  data_operacao: string;
  exchange: string | null;
  notas: string | null;
  criado_em: string;
  atualizado_em: string;
}

// Função para formatar valores monetários
const formatarValorMonetario = (valor: number): string => {
  if (valor < 1) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(valor);
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

// Formatar data (String Split para evitar timezone)
const formatarData = (dataStr: string | null | undefined): string => {
  if (!dataStr || typeof dataStr !== 'string' || !dataStr.includes('T')) {
    // Retorna um valor padrão ou a string original se o formato for inesperado
    return dataStr || "Data inválida";
  }
  try {
    // Pega a parte antes do 'T' -> "YYYY-MM-DD"
    const datePart = dataStr.split('T')[0];
    // Divide em ano, mês, dia
    const [year, month, day] = datePart.split('-');
    // Valida se temos 3 partes
    if (!year || !month || !day) {
      return dataStr; // Retorna original se o split falhar
    }
    // Remonta como "DD/MM/YYYY"
    return `${day}/${month}/${year}`;
  } catch (e) {
    console.error("Erro ao formatar data (string split):", dataStr, e);
    return dataStr; // Retorna original em caso de erro
  }
};

export default function OperacoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [ordenacao, setOrdenacao] = useState<{
    campo: keyof Operacao;
    direcao: 'asc' | 'desc';
  }>({
    campo: 'data_operacao',
    direcao: 'desc'
  });

  // Buscar operações diretamente do Supabase (Client-Side)
  const fetchOperacoes = async () => {
    console.log("[OperacoesPage] Iniciando busca de operações (Direto do Cliente)");
    setLoading(true);
    setError(null);
    let supabase;
    try {
      supabase = getSupabase(); // Obter instância do cliente Supabase
      console.log("[OperacoesPage DEBUG] Instância Supabase obtida:", supabase ? 'OK' : 'FALHOU');
      if (!supabase) throw new Error("Falha ao obter cliente Supabase");
    } catch (err) {
       console.error("[OperacoesPage DEBUG] Erro ao obter cliente Supabase:", err);
       setError("Erro crítico ao inicializar a conexão com o banco de dados.");
       setLoading(false);
       return; // Interrompe a execução se não puder obter o cliente
    }

    try {
      // Obter o ID do usuário autenticado do lado do cliente
      // const { data: { user } } = await supabase.auth.getUser(); // << TEMPORARIAMENTE COMENTADO
      // if (!user) { // << TEMPORARIAMENTE COMENTADO
      //   throw new Error("Usuário não autenticado."); // << TEMPORARIAMENTE COMENTADO
      // } // << TEMPORARIAMENTE COMENTADO
      // console.log(`[OperacoesPage] Usuário autenticado (Cliente): ${user.id}`); // << TEMPORARIAMENTE COMENTADO

      // Buscar operações associadas a este usuário
      // Ajustar a query SELECT conforme necessário (remover joins se não usados aqui)
      console.log("[OperacoesPage DEBUG] Buscando TODAS as operações (sem filtro de usuário)");
      const { data, error: dbError } = await supabase
        .from('crypto_operacoes')
        .select('*') // Selecionar todas as colunas ou especificar as necessárias
        // .eq('usuario_id', user.id) // << TEMPORARIAMENTE COMENTADO
        .order(ordenacao.campo, { ascending: ordenacao.direcao === 'asc' })
        .limit(10); // Adicionar um limite para não buscar tudo desnecessariamente

      if (dbError) {
        console.error("[OperacoesPage] Erro do Supabase:", dbError);
        throw new Error(dbError.message || "Erro ao buscar operações no banco de dados");
      }

      console.log("[OperacoesPage] Dados recebidos do Supabase (Cliente):", {
        quantidade: data?.length ?? 0,
        primeiraOperacao: data?.[0],
      });

      // Garantir que 'taxa' e 'exchange' existam com valores padrão se forem null
      const operacoesFormatadas = (data || []).map(op => ({
        ...op,
        taxa: op.taxa ?? 0, // Definir 0 se for null
        exchange: op.exchange ?? '', // Definir string vazia se for null
        // Mapear outros campos se necessário
      })) as Operacao[]; // Forçar a tipagem para Operacao

      setOperacoes(operacoesFormatadas);
      console.log("[OperacoesPage] setOperacoes chamado com dados do Supabase.");

    } catch (err) {
      console.error("[OperacoesPage DEBUG] Erro DENTRO do try principal de fetchOperacoes:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao buscar operações";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      console.log("[OperacoesPage DEBUG] fetchOperacoes finally block executado.");
      setLoading(false);
    }
  };

  // Carregar operações ao montar o componente
  useEffect(() => {
    console.log("[OperacoesPage DEBUG] useEffect iniciado.");
    fetchOperacoes()
      .then(() => console.log("[OperacoesPage DEBUG] fetchOperacoes concluído (dentro do useEffect)."))
      .catch((err) => console.error("[OperacoesPage DEBUG] Erro não capturado por fetchOperacoes no useEffect:", err));
    console.log("[OperacoesPage DEBUG] Chamada para fetchOperacoes DENTRO do useEffect concluída.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenacao]); // Adicionar ordenacao como dependência para re-buscar ao ordenar

  // Renderizar loading state
  if (loading) {
    console.log("[OperacoesPage] Renderizando estado de loading");
    return <LoadingSpinner />;
  }

  // Renderizar erro
  if (error) {
    console.log("[OperacoesPage] Renderizando estado de erro:", error);
    return (
      <div className="text-center text-red-500 p-4">
        <AlertCircle className="mx-auto h-8 w-8 mb-2" />
        <p>Erro ao carregar operações: {error}</p>
         <Button onClick={fetchOperacoes} className="mt-4" variant="outline">Tentar Novamente</Button>
      </div>
    );
  }

  // Renderizar lista vazia - Ajustar mensagem de log
  if (!operacoes || operacoes.length === 0) {
    console.log("[OperacoesPage] Renderizando estado de lista vazia (após busca direta no Supabase)");
    return (
      <div className="text-center py-16 border-dashed border-2 border-gray-300 rounded-lg">
        <ListX className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-600">Nenhuma operação encontrada.</h3>
        <p className="text-gray-500 mt-2">Verifique se você já cadastrou alguma operação.</p>
        <Button onClick={() => router.push('/crypto/nova-operacao')} className="mt-6">
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Primeira Operação
        </Button>
      </div>
    );
  }

  console.log("[OperacoesPage] Renderizando lista de operações (com dados do Supabase):", {
    quantidade: operacoes.length
  });

  // Função excluirOperacao precisa ser ajustada para chamar a API ou o Supabase diretamente
   const excluirOperacao = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta operação?")) return;
    const supabase = getSupabase();
    try {
      console.log("[Operacoes] Excluindo operação via Supabase:", id);
      const { error: deleteError } = await supabase
        .from('crypto_operacoes')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error("[Operacoes] Erro ao excluir via Supabase:", deleteError);
        throw new Error(deleteError.message || "Erro ao excluir operação");
      }

      toast.success("Operação excluída com sucesso");
      // Re-buscar operações após exclusão
      await fetchOperacoes();

    } catch (err) {
      console.error("[Operacoes] Erro ao excluir operação:", err);
      const errorDesc = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(errorDesc);
    }
  };

  // Função ordenarOperacoes não precisa mudar, pois fetchOperacoes agora usa a ordenacao
  const ordenarOperacoes = (campo: keyof Operacao) => {
    const novaDirecao =
      ordenacao.campo === campo && ordenacao.direcao === 'asc'
        ? 'desc'
        : 'asc';

    setOrdenacao({ campo, direcao: novaDirecao });
    // A re-busca será feita pelo useEffect agora
  };

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Operações</CardTitle>
              <CardDescription>
                Gerencie suas operações de criptomoedas
              </CardDescription>
            </div>
            <Button
              onClick={() => router.push('/crypto/nova-operacao')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova Operação
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Button variant="ghost" onClick={() => ordenarOperacoes('data_operacao')} className="flex items-center gap-1">Data{ordenacao.campo === 'data_operacao' && <ArrowUpDown className="h-4 w-4" />}</Button></TableHead>
                  <TableHead><Button variant="ghost" onClick={() => ordenarOperacoes('tipo')} className="flex items-center gap-1">Tipo{ordenacao.campo === 'tipo' && <ArrowUpDown className="h-4 w-4" />}</Button></TableHead>
                  <TableHead><Button variant="ghost" onClick={() => ordenarOperacoes('nome')} className="flex items-center gap-1">Moeda{ordenacao.campo === 'nome' && <ArrowUpDown className="h-4 w-4" />}</Button></TableHead>
                  <TableHead><Button variant="ghost" onClick={() => ordenarOperacoes('quantidade')} className="flex items-center gap-1">Quantidade{ordenacao.campo === 'quantidade' && <ArrowUpDown className="h-4 w-4" />}</Button></TableHead>
                  <TableHead><Button variant="ghost" onClick={() => ordenarOperacoes('preco_unitario')} className="flex items-center gap-1">Preço Unitário{ordenacao.campo === 'preco_unitario' && <ArrowUpDown className="h-4 w-4" />}</Button></TableHead>
                  <TableHead><Button variant="ghost" onClick={() => ordenarOperacoes('valor_total')} className="flex items-center gap-1">Valor Total{ordenacao.campo === 'valor_total' && <ArrowUpDown className="h-4 w-4" />}</Button></TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operacoes.map((operacao) => (
                  <TableRow key={operacao.id}>
                    <TableCell>{formatarData(operacao.data_operacao)}</TableCell>
                    <TableCell><span className={`capitalize ${operacao.tipo === 'compra' ? 'text-green-600' : 'text-red-600'}`}>{operacao.tipo}</span></TableCell>
                    <TableCell><div className="flex flex-col"><span className="font-medium">{operacao.nome}</span><span className="text-sm text-gray-500">{operacao.simbolo?.toUpperCase()}</span></div></TableCell>
                    <TableCell>{formatarValorMonetario(operacao.quantidade)}</TableCell>
                    <TableCell>${formatarValorMonetario(operacao.preco_unitario)}</TableCell>
                    <TableCell>${formatarValorMonetario(operacao.valor_total)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/crypto/operacao/${operacao.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/crypto/editar-operacao/${operacao.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir esta operação? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => excluirOperacao(operacao.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 