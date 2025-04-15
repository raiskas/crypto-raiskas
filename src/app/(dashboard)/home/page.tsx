"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Settings, Users, BarChart, Database, TrendingUp, Wallet, CreditCard, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totaisPortfolio, setTotaisPortfolio] = useState({
    valorTotalInvestido: 0,
    valorTotalAtualizado: 0,
    lucroTotal: 0,
  });
  const [percentualTotalPortfolio, setPercentualTotalPortfolio] = useState(0);
  
  const menuItems = [
    {
      title: "Gerenciar Criptomoedas",
      description: "Controle seus investimentos em criptomoedas",
      icon: <TrendingUp className="h-8 w-8" />,
      path: "/crypto",
      color: "bg-orange-100 text-orange-700",
    },
    {
      title: "Painel Administrativo",
      description: "Gerenciar usuários, permissões e configurações",
      icon: <Settings className="h-8 w-8" />,
      path: "/admin",
      color: "bg-purple-100 text-purple-700",
    },
    {
      title: "Relatórios",
      description: "Visualize estatísticas e dados do sistema",
      icon: <BarChart className="h-8 w-8" />,
      path: "/relatorios",
      color: "bg-blue-100 text-blue-700",
    },
    {
      title: "Perfil",
      description: "Altere suas informações e configure preferências",
      icon: <Users className="h-8 w-8" />,
      path: "/perfil",
      color: "bg-green-100 text-green-700",
    }
  ];

  // Formatar valores monetários
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(valor);
  };

  // Formatar valores percentuais
  const formatarPercentual = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor / 100);
  };

  // Carregar dados de portfólio
  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const [topMoedasResponse, operacoesResponse] = await Promise.all([
        fetch("/api/crypto/top-moedas", {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        fetch("/api/crypto/operacoes", {
          method: "GET",
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
      ]);
      
      if (!topMoedasResponse.ok || !operacoesResponse.ok) {
        throw new Error("Erro ao carregar dados");
      }
      
      const topMoedasData = await topMoedasResponse.json();
      const operacoesData = await operacoesResponse.json();
      
      // Calcular portfólio
      const portfolioCalculado = calcularPortfolio(operacoesData.operacoes || [], topMoedasData);
      
      // Calcular totais
      const totais = portfolioCalculado.reduce(
        (acc, item) => {
          acc.valorTotalInvestido += item.valorTotal;
          acc.valorTotalAtualizado += item.valorAtualizado;
          acc.lucroTotal += item.lucro;
          return acc;
        },
        { valorTotalInvestido: 0, valorTotalAtualizado: 0, lucroTotal: 0 }
      );
      
      setTotaisPortfolio(totais);
      
      // Calcular percentual
      const percentual = totais.valorTotalInvestido > 0
        ? (totais.lucroTotal / totais.valorTotalInvestido) * 100
        : 0;
        
      setPercentualTotalPortfolio(percentual);
      
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  // Obter o preço atual de uma moeda a partir do ID
  const getPrecoAtual = (moedaId: string, moedas: any[]): number => {
    const moeda = moedas.find(m => m.id === moedaId);
    return moeda?.current_price || 0;
  };

  // Calcular portfólio consolidado (simplificado)
  const calcularPortfolio = (operacoes: any[], moedas: any[]) => {
    // Criar um mapa para armazenar as informações por moeda
    const portfolioMap = new Map();
    
    // Processar cada operação
    operacoes.forEach((op) => {
      const precoAtual = getPrecoAtual(op.moeda_id, moedas);
      
      // Se a moeda já existe no mapa, atualizar os valores
      if (portfolioMap.has(op.moeda_id)) {
        const item = portfolioMap.get(op.moeda_id);
        
        // Atualizar quantidade (adicionar para compras, subtrair para vendas)
        if (op.tipo === "compra") {
          item.quantidade += op.quantidade;
          item.valorTotal += op.valor_total;
        } else {
          item.quantidade -= op.quantidade;
        }
        
        // Atualizar valores calculados
        item.valorAtualizado = item.quantidade * precoAtual;
        item.lucro = item.valorAtualizado - item.valorTotal;
        
        portfolioMap.set(op.moeda_id, item);
      } else {
        // Se a moeda não existe no mapa e for uma compra, adicionar
        if (op.tipo === "compra") {
          portfolioMap.set(op.moeda_id, {
            moeda_id: op.moeda_id,
            quantidade: op.quantidade,
            valorTotal: op.valor_total,
            valorAtualizado: op.quantidade * precoAtual,
            lucro: (op.quantidade * precoAtual) - op.valor_total
          });
        }
      }
    });
    
    // Filtrar portfólio para remover moedas com quantidade zero ou negativa
    // e converter para array
    return Array.from(portfolioMap.values())
      .filter(item => item.quantidade > 0);
  };

  useEffect(() => {
    carregarDados();
  }, []);
  
  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Bem-vindo, {user?.email}</h1>
        <p className="text-muted-foreground">
          O que você gostaria de fazer hoje?
        </p>
      </div>
      
      {/* Cards de resumo de criptomoedas */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="bg-black text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Total Portfólio
            </CardTitle>
            <Wallet className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "Carregando..." : formatarMoeda(totaisPortfolio.valorTotalAtualizado)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-black text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Total Investido
            </CardTitle>
            <CreditCard className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "Carregando..." : formatarMoeda(totaisPortfolio.valorTotalInvestido)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-black text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Lucro/Prejuízo
            </CardTitle>
            {totaisPortfolio.lucroTotal >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totaisPortfolio.lucroTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {loading ? "Carregando..." : (
                `${formatarMoeda(totaisPortfolio.lucroTotal)} (${formatarPercentual(percentualTotalPortfolio)})`
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Cards de menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {menuItems.map((item, index) => (
          <Card 
            key={index}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => router.push(item.path)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(item.path);
                }}
              >
                Acessar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 