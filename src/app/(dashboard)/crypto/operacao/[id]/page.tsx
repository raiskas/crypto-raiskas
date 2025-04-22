"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { format } from "date-fns";

// Interface para tipagem da operação
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

export default function OperacaoPage() {
  const router = useRouter();
  const params = useParams();
  const operacaoId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operacao, setOperacao] = useState<Operacao | null>(null);

  // Carregar dados da operação ao montar o componente
  useEffect(() => {
    carregarOperacao();
  }, [operacaoId]);

  // Função para carregar os dados da operação
  const carregarOperacao = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("[OperacaoDetalhes] Buscando dados da operação:", operacaoId);
      
      const response = await fetch(`/api/crypto/operacoes?id=${operacaoId}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao buscar dados da operação");
      }
      
      const data = await response.json();
      
      if (!data.operacao) {
        throw new Error("Operação não encontrada");
      }
      
      setOperacao(data.operacao);
      
    } catch (err) {
      console.error("[OperacaoDetalhes] Erro ao carregar operação:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar operação");
    } finally {
      setLoading(false);
    }
  };

  // Renderizar item de informação
  const renderInfoItem = (label: string, value: ReactNode) => (
    <div className="space-y-1.5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium">{value || '-'}</p>
    </div>
  );

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        {operacao && (
          <Button
            onClick={() => router.push(`/crypto/editar-operacao/${operacao.id}`)}
            className="flex items-center gap-2"
          >
            <Pencil className="h-4 w-4" />
            Editar Operação
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Operação</CardTitle>
          <CardDescription>
            Visualize os detalhes completos da operação
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="text-center py-4">
              Carregando dados da operação...
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-4">
              {error}
            </div>
          ) : operacao ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Informações da Moeda */}
              <div className="space-y-4">
                <h3 className="font-semibold">Informações da Moeda</h3>
                {renderInfoItem("Nome", operacao.nome)}
                {renderInfoItem("Símbolo", operacao.simbolo.toUpperCase())}
                {renderInfoItem("ID da Moeda", operacao.moeda_id)}
              </div>

              {/* Detalhes da Operação */}
              <div className="space-y-4">
                <h3 className="font-semibold">Detalhes da Operação</h3>
                {renderInfoItem("Tipo", (
                  <span className={`capitalize ${
                    operacao.tipo === 'compra' 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {operacao.tipo}
                  </span>
                ))}
                {renderInfoItem("Data", formatarData(operacao.data_operacao))}
                {renderInfoItem("Exchange", operacao.exchange)}
              </div>

              {/* Valores */}
              <div className="space-y-4">
                <h3 className="font-semibold">Valores</h3>
                {renderInfoItem("Quantidade", formatarValorMonetario(operacao.quantidade))}
                {renderInfoItem("Preço Unitário", `$${formatarValorMonetario(operacao.preco_unitario)}`)}
                {renderInfoItem("Valor Total", `$${formatarValorMonetario(operacao.valor_total)}`)}
                {renderInfoItem("Taxa", operacao.taxa > 0 ? `$${formatarValorMonetario(operacao.taxa)}` : '-')}
              </div>

              {/* Notas */}
              {operacao.notas && (
                <div className="col-span-full space-y-4">
                  <h3 className="font-semibold">Notas</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {operacao.notas}
                  </p>
                </div>
              )}

              {/* Metadados */}
              <div className="col-span-full space-y-4">
                <h3 className="font-semibold">Metadados</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
                  <p>Criado em: {format(new Date(operacao.criado_em), 'dd/MM/yyyy HH:mm:ss')}</p>
                  <p>Atualizado em: {format(new Date(operacao.atualizado_em), 'dd/MM/yyyy HH:mm:ss')}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              Operação não encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 