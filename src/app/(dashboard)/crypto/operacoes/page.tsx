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
import { Plus, Eye, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
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
  exchange: string;
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

// Função para formatar a data
const formatarData = (data: string): string => {
  return format(new Date(data), 'dd/MM/yyyy');
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

  // Carregar operações ao montar o componente
  useEffect(() => {
    carregarOperacoes();
  }, []);

  // Função para carregar as operações
  const carregarOperacoes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("[Operacoes] Buscando lista de operações");
      
      const response = await fetch('/api/crypto/operacoes', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao buscar operações");
      }
      
      const data = await response.json();
      setOperacoes(data.operacoes || []);
      
    } catch (err) {
      console.error("[Operacoes] Erro ao carregar operações:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar operações");
      toast.error("Erro ao carregar operações");
    } finally {
      setLoading(false);
    }
  };

  // Função para excluir uma operação
  const excluirOperacao = async (id: string) => {
    try {
      console.log("[Operacoes] Excluindo operação:", id);
      
      const response = await fetch(`/api/crypto/operacoes?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao excluir operação");
      }
      
      // Atualizar lista de operações
      await carregarOperacoes();
      toast.success("Operação excluída com sucesso");
      
    } catch (err) {
      console.error("[Operacoes] Erro ao excluir operação:", err);
      toast.error("Erro ao excluir operação");
    }
  };

  // Função para ordenar operações
  const ordenarOperacoes = (campo: keyof Operacao) => {
    const novaDirecao = 
      ordenacao.campo === campo && ordenacao.direcao === 'asc' 
        ? 'desc' 
        : 'asc';
    
    setOrdenacao({ campo, direcao: novaDirecao });
    
    const operacoesOrdenadas = [...operacoes].sort((a, b) => {
      if (campo === 'data_operacao') {
        return novaDirecao === 'asc'
          ? new Date(a[campo]).getTime() - new Date(b[campo]).getTime()
          : new Date(b[campo]).getTime() - new Date(a[campo]).getTime();
      }
      
      if (typeof a[campo] === 'string') {
        return novaDirecao === 'asc'
          ? (a[campo] as string).localeCompare(b[campo] as string)
          : (b[campo] as string).localeCompare(a[campo] as string);
      }
      
      return novaDirecao === 'asc'
        ? (a[campo] as number) - (b[campo] as number)
        : (b[campo] as number) - (a[campo] as number);
    });
    
    setOperacoes(operacoesOrdenadas);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
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
          {loading ? (
            <div className="text-center py-4">Carregando operações...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-4">{error}</div>
          ) : operacoes.length === 0 ? (
            <div className="text-center py-4">
              Nenhuma operação encontrada
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        onClick={() => ordenarOperacoes('data_operacao')}
                        className="flex items-center gap-1"
                      >
                        Data
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        onClick={() => ordenarOperacoes('tipo')}
                        className="flex items-center gap-1"
                      >
                        Tipo
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        onClick={() => ordenarOperacoes('nome')}
                        className="flex items-center gap-1"
                      >
                        Moeda
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        onClick={() => ordenarOperacoes('quantidade')}
                        className="flex items-center gap-1"
                      >
                        Quantidade
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        onClick={() => ordenarOperacoes('preco_unitario')}
                        className="flex items-center gap-1"
                      >
                        Preço Unitário
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        onClick={() => ordenarOperacoes('valor_total')}
                        className="flex items-center gap-1"
                      >
                        Valor Total
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operacoes.map((operacao) => (
                    <TableRow key={operacao.id}>
                      <TableCell>
                        {formatarData(operacao.data_operacao)}
                      </TableCell>
                      <TableCell>
                        <span className={`capitalize ${
                          operacao.tipo === 'compra' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {operacao.tipo}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {operacao.nome}
                          </span>
                          <span className="text-sm text-gray-500">
                            {operacao.simbolo.toUpperCase()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatarValorMonetario(operacao.quantidade)}
                      </TableCell>
                      <TableCell>
                        ${formatarValorMonetario(operacao.preco_unitario)}
                      </TableCell>
                      <TableCell>
                        ${formatarValorMonetario(operacao.valor_total)}
                      </TableCell>
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
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Confirmar exclusão
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir esta operação? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => excluirOperacao(operacao.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 