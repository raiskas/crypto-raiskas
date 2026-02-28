"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Operacao } from "@/types/crypto";
import type { PerformanceMetrics } from "@/lib/crypto/fifoCalculations";
import { CarteiraAdminModal } from "@/components/crypto/CarteiraAdminModal";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PerformanceApiResponse = {
  performance: Record<string, PerformanceMetrics>;
  summary: {
    totalRealizado: number;
    totalNaoRealizado: number;
    valorTotalAtual: number;
    saldoCaixa?: number;
    valorAtivos?: number;
    patrimonioTotal?: number;
    valorInicial?: number;
    totalAportes?: number;
    resultadoTotal?: number;
    resultadoPercentual?: number;
  };
  carteira?: {
    id: string;
    nome: string;
    valor_inicial: number;
  } | null;
  warning?: string | null;
};

type CarteiraData = {
  id: string;
  nome: string;
  valor_inicial: number;
};

type AporteData = {
  id: string;
  carteira_id: string;
  valor: number;
  data_aporte: string;
  descricao: string | null;
};

type SnapshotData = {
  id: string;
  carteira_id: string;
  data_ref: string;
  aporte_liquido: number;
  saldo_caixa: number;
  valor_ativos: number;
  patrimonio_total: number;
  fonte_preco: string;
};

type ChartRange = "1M" | "3M" | "6M" | "12M" | "ALL";
type VisibleSeries = {
  valorCarteira: boolean;
  aporteLiquido: boolean;
  resultado: boolean;
};

function CrosshairCursor(props: any) {
  const { points, width, height, left = 0, top = 0 } = props || {};
  if (!points || points.length === 0) return null;
  const x = points[0]?.x ?? 0;
  const y = points[0]?.y ?? 0;
  return (
    <g>
      <line x1={x} y1={top} x2={x} y2={top + height} stroke="#64748b" strokeDasharray="4 4" />
      <line x1={left} y1={y} x2={left + width} y2={y} stroke="#64748b" strokeDasharray="4 4" />
    </g>
  );
}

export default function CryptoCarteiraPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [summary, setSummary] = useState<PerformanceApiResponse["summary"]>({
    totalRealizado: 0,
    totalNaoRealizado: 0,
    valorTotalAtual: 0,
  });
  const [performanceMap, setPerformanceMap] = useState<Record<string, PerformanceMetrics>>({});
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [carteira, setCarteira] = useState<CarteiraData | null>(null);
  const [aportes, setAportes] = useState<AporteData[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [generatingSnapshots, setGeneratingSnapshots] = useState(false);
  const [isCarteiraModalOpen, setIsCarteiraModalOpen] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>("ALL");
  const [visibleSeries, setVisibleSeries] = useState<VisibleSeries>({
    valorCarteira: true,
    aporteLiquido: true,
    resultado: true,
  });
  const autoSnapshotRunForCarteiraRef = useRef<string | null>(null);

  const shouldAutoRefreshSnapshots = useMemo(() => {
    if (!carteira?.id) return false;
    if (loading) return false;
    if (snapshots.length === 0) return true;
    const todayKey = new Date().toISOString().slice(0, 10);
    const hasToday = snapshots.some((s) => s.data_ref === todayKey);
    return !hasToday;
  }, [carteira?.id, loading, snapshots]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const carteiraRes = await fetch("/api/crypto/carteira", { cache: "no-store" });
      const carteiraJson = await carteiraRes.json().catch(() => ({ carteira: null, aportes: [] }));
      const carteiraAtual: CarteiraData | null = carteiraRes.ok ? carteiraJson.carteira ?? null : null;
      setCarteira(carteiraAtual);
      setAportes(Array.isArray(carteiraJson?.aportes) ? carteiraJson.aportes : []);

      const carteiraQuery = carteiraAtual?.id ? `?carteira_id=${encodeURIComponent(carteiraAtual.id)}` : "";

      const [perfRes, opsRes, snapRes] = await Promise.all([
        fetch(`/api/crypto/performance${carteiraQuery}`, { cache: "no-store" }),
        fetch(`/api/crypto/operacoes${carteiraQuery}`, { cache: "no-store" }),
        carteiraAtual?.id
          ? fetch(`/api/crypto/carteira/snapshots${carteiraQuery}&months=12`, { cache: "no-store" })
          : Promise.resolve(new Response(JSON.stringify({ snapshots: [] }), { status: 200 })),
      ]);

      if (!perfRes.ok) {
        const err = await perfRes.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao carregar performance.");
      }

      if (!opsRes.ok) {
        const err = await opsRes.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao carregar operações.");
      }

      const perfJson = (await perfRes.json()) as PerformanceApiResponse;
      const opsJson = (await opsRes.json()) as Operacao[];
      const snapJson = await snapRes.json().catch(() => ({ snapshots: [] }));

      setSummary(
        perfJson.summary || {
          totalRealizado: 0,
          totalNaoRealizado: 0,
          valorTotalAtual: 0,
        }
      );
      setPerformanceMap(perfJson.performance || {});
      setOperacoes(Array.isArray(opsJson) ? opsJson : []);
      setSnapshots(Array.isArray(snapJson?.snapshots) ? snapJson.snapshots : []);
      setWarning(
        perfJson.warning ||
          carteiraJson?.warning ||
          (!carteiraRes.ok ? carteiraJson?.error || null : null)
      );
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar carteira.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const gerarSnapshots = useCallback(async (incremental = false) => {
    if (!carteira?.id) return;
    setGeneratingSnapshots(true);
    if (!incremental) setError(null);
    try {
      const res = await fetch("/api/crypto/carteira/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carteira_id: carteira.id,
          months: 12,
          strict_market: true,
          incremental,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Falha ao gerar snapshots.");
      await loadData();
    } catch (e: any) {
      const msg = e?.message || "Erro ao gerar snapshots.";
      if (incremental) {
        setWarning((prev) => prev || msg);
      } else {
        setError(msg);
      }
    } finally {
      setGeneratingSnapshots(false);
    }
  }, [carteira?.id, loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!carteira?.id) return;
    if (!shouldAutoRefreshSnapshots) return;
    if (autoSnapshotRunForCarteiraRef.current === carteira.id) return;

    autoSnapshotRunForCarteiraRef.current = carteira.id;
    void gerarSnapshots(true);
  }, [carteira?.id, gerarSnapshots, shouldAutoRefreshSnapshots]);

  const assets = useMemo(() => {
    const opByCoin = new Map<string, Operacao>();
    for (const op of operacoes) {
      if (!opByCoin.has(op.moeda_id)) opByCoin.set(op.moeda_id, op);
    }

    return Object.values(performanceMap)
      .map((item) => {
        const info = opByCoin.get(item.moedaId);
        return {
          moedaId: item.moedaId,
          nome: info?.nome || item.moedaId,
          simbolo: (info?.simbolo || "-").toUpperCase(),
          quantidade: item.quantidadeAtual,
          custoMedio: item.custoMedioAtual,
          custoBase: item.custoBaseTotalAtual,
          mercado: item.valorDeMercadoAtual,
          naoRealizado: item.lucroPrejuizoNaoRealizado,
          realizado: item.lucroPrejuizoRealizadoTotal,
          naoRealizadoPct: item.lucroPrejuizoNaoRealizadoPercentual,
        };
      })
      .sort((a, b) => b.mercado - a.mercado);
  }, [performanceMap, operacoes]);

  const evolutionData = useMemo(() => {
    type PositionLot = { quantidade: number; custoUnitario: number };
    const lotsByAsset = new Map<string, PositionLot[]>();
    const valorInicial = Number(summary.valorInicial ?? carteira?.valor_inicial ?? 0);
    const totalAportesSummary = Number(summary.totalAportes ?? 0);
    const aporteTotalAtual = valorInicial + totalAportesSummary;
    let aporteLiquido = valorInicial;
    let caixaAtual = valorInicial;

    const sortedOps = [...operacoes].sort(
      (a, b) => new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime()
    );
    const sortedAportes = [...aportes].sort(
      (a, b) => new Date(a.data_aporte).getTime() - new Date(b.data_aporte).getTime()
    );

    const points: Array<{
      ts: number;
      label: string;
      valorCarteira: number;
      aporteLiquido: number;
      resultado: number;
    }> = [];

    const firstTsRaw = Math.min(
      sortedOps.length > 0 ? new Date(sortedOps[0].data_operacao).getTime() : Number.MAX_SAFE_INTEGER,
      sortedAportes.length > 0 ? new Date(sortedAportes[0].data_aporte).getTime() : Number.MAX_SAFE_INTEGER
    );

    if (Number.isFinite(firstTsRaw) && firstTsRaw !== Number.MAX_SAFE_INTEGER && valorInicial > 0) {
      const firstTs = firstTsRaw - 1000;
      points.push({
        ts: firstTs,
        label: new Date(firstTs).toLocaleDateString("pt-BR"),
        valorCarteira: valorInicial,
        aporteLiquido: valorInicial,
        resultado: 0,
      });
    }

    const events = [
      ...sortedOps.map((op) => ({ kind: "op" as const, ts: new Date(op.data_operacao).getTime(), op })),
      ...sortedAportes.map((ap) => ({ kind: "aporte" as const, ts: new Date(ap.data_aporte).getTime(), aporte: ap })),
    ].sort((a, b) => a.ts - b.ts);

    for (const event of events) {
      if (event.kind === "op") {
        const op = event.op;
        const key = op.moeda_id;
        const lots = lotsByAsset.get(key) || [];

        if (op.tipo === "compra") {
          const qtdCompra = Math.max(0, Number(op.quantidade || 0));
          const custoTotalCompra = Number(op.valor_total || 0) + Number(op.taxa || 0);
          const custoUnitario = qtdCompra > 0 ? custoTotalCompra / qtdCompra : 0;
          lots.push({ quantidade: qtdCompra, custoUnitario });
          caixaAtual -= Number(op.valor_total) + Number(op.taxa ?? 0);
        } else {
          let qtdVendaRestante = Math.max(0, Number(op.quantidade || 0));
          while (qtdVendaRestante > 0 && lots.length > 0) {
            const lote = lots[0];
            const consumo = Math.min(qtdVendaRestante, lote.quantidade);
            lote.quantidade -= consumo;
            qtdVendaRestante -= consumo;
            if (lote.quantidade <= 1e-9) lots.shift();
          }
          caixaAtual += Number(op.valor_total) - Number(op.taxa ?? 0);
        }
        lotsByAsset.set(key, lots);
      } else {
        const aporteValor = Number(event.aporte.valor || 0);
        aporteLiquido += aporteValor;
        caixaAtual += aporteValor;
      }

      // Patrimônio contábil: caixa + custo base dos lotes abertos (FIFO)
      let valorAtivos = 0;
      for (const lots of lotsByAsset.values()) {
        for (const lote of lots) {
          valorAtivos += lote.quantidade * lote.custoUnitario;
        }
      }
      const valorCarteira = caixaAtual + valorAtivos;

      const ts = event.ts;
      const point = {
        ts,
        label: new Date(ts).toLocaleDateString("pt-BR"),
        valorCarteira,
        aporteLiquido,
        resultado: valorCarteira - aporteLiquido,
      };

      const last = points[points.length - 1];
      if (last && last.label === point.label) {
        points[points.length - 1] = point;
      } else {
        points.push(point);
      }
    }

    // Força o último ponto da série para refletir exatamente o estado atual da carteira
    // (igual aos cards), evitando divergência entre gráfico e resumo.
    const patrimonioAtual =
      Number(summary.patrimonioTotal) ||
      Number(summary.valorTotalAtual || 0) + Number(summary.saldoCaixa || 0);
    const nowTs = Date.now();
    const nowLabel = new Date(nowTs).toLocaleDateString("pt-BR");

    if (points.length === 0) {
      points.push({
        ts: nowTs,
        label: nowLabel,
        valorCarteira: patrimonioAtual || aporteTotalAtual || 0,
        aporteLiquido: aporteTotalAtual || 0,
        resultado: (patrimonioAtual || aporteTotalAtual || 0) - (aporteTotalAtual || 0),
      });
    } else {
      const last = points[points.length - 1];
      const currentPoint = {
        ts: nowTs,
        label: nowLabel,
        valorCarteira: patrimonioAtual,
        aporteLiquido: aporteTotalAtual,
        resultado: patrimonioAtual - aporteTotalAtual,
      };

      if (last.label === nowLabel) {
        points[points.length - 1] = currentPoint;
      } else {
        points.push(currentPoint);
      }
    }

    return points;
  }, [
    operacoes,
    aportes,
    summary.valorInicial,
    summary.totalAportes,
    summary.patrimonioTotal,
    summary.valorTotalAtual,
    summary.saldoCaixa,
    carteira?.valor_inicial,
  ]);

  const chartSourceData = useMemo(() => {
    if (snapshots.length === 0) return evolutionData;

    const fromSnapshots = snapshots.map((s) => ({
      ts: new Date(`${s.data_ref}T00:00:00Z`).getTime(),
      label: new Date(`${s.data_ref}T00:00:00Z`).toLocaleDateString("pt-BR"),
      valorCarteira: Number(s.patrimonio_total || 0),
      aporteLiquido: Number(s.aporte_liquido || 0),
      resultado: Number(s.patrimonio_total || 0) - Number(s.aporte_liquido || 0),
    }));

    // Alinha o último ponto com o resumo atual dos cards (fonte de verdade do momento).
    const nowTs = Date.now();
    const nowLabel = new Date(nowTs).toLocaleDateString("pt-BR");
    const aporteAtual = Number(summary.valorInicial ?? 0) + Number(summary.totalAportes ?? 0);
    const patrimonioAtual =
      Number(summary.patrimonioTotal) ||
      Number(summary.valorTotalAtual || 0) + Number(summary.saldoCaixa || 0);

    const currentPoint = {
      ts: nowTs,
      label: nowLabel,
      valorCarteira: patrimonioAtual,
      aporteLiquido: aporteAtual,
      resultado: patrimonioAtual - aporteAtual,
    };

    if (fromSnapshots.length === 0) {
      return [currentPoint];
    }

    const last = fromSnapshots[fromSnapshots.length - 1];
    if (last.label === nowLabel) {
      fromSnapshots[fromSnapshots.length - 1] = currentPoint;
    } else {
      fromSnapshots.push(currentPoint);
    }

    return fromSnapshots;
  }, [
    snapshots,
    evolutionData,
    summary.valorInicial,
    summary.totalAportes,
    summary.patrimonioTotal,
    summary.valorTotalAtual,
    summary.saldoCaixa,
  ]);

  const filteredEvolution = useMemo(() => {
    if (chartRange === "ALL" || chartSourceData.length === 0) return chartSourceData;

    const endTs = chartSourceData[chartSourceData.length - 1].ts;
    const endDate = new Date(endTs);
    const startDate = new Date(endDate);

    if (chartRange === "1M") startDate.setMonth(startDate.getMonth() - 1);
    if (chartRange === "3M") startDate.setMonth(startDate.getMonth() - 3);
    if (chartRange === "6M") startDate.setMonth(startDate.getMonth() - 6);
    if (chartRange === "12M") startDate.setMonth(startDate.getMonth() - 12);

    const cutoff = startDate.getTime();
    return chartSourceData.filter((item) => item.ts >= cutoff);
  }, [chartSourceData, chartRange]);

  const chartDataWindow = useMemo(() => {
    return filteredEvolution;
  }, [filteredEvolution]);

  const chart = useMemo(() => {
    if (chartDataWindow.length < 2) {
      return {
        hasData: false,
        min: 0,
        max: 0,
        firstLabel: "-",
        lastLabel: "-",
        delta: 0,
        deltaPct: 0,
        maxDrawdownPct: 0,
      };
    }

    const values = chartDataWindow.map((d) => d.valorCarteira);
    const first = chartDataWindow[0].valorCarteira;
    const last = chartDataWindow[chartDataWindow.length - 1].valorCarteira;
    const delta = last - first;
    const deltaPct = first > 0 ? (delta / first) * 100 : 0;

    let peak = values[0];
    let maxDrawdownPct = 0;
    for (const value of values) {
      if (value > peak) peak = value;
      const dd = peak > 0 ? ((value - peak) / peak) * 100 : 0;
      if (dd < maxDrawdownPct) maxDrawdownPct = dd;
    }

    return {
      hasData: true,
      min: Math.min(...values),
      max: Math.max(...values),
      firstLabel: chartDataWindow[0].label,
      lastLabel: chartDataWindow[chartDataWindow.length - 1].label,
      delta,
      deltaPct,
      maxDrawdownPct,
    };
  }, [chartDataWindow]);

  const formatCompact = useCallback((value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }, []);

  const xTickFormatter = useCallback(
    (value: number) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      if (chartRange === "1M" || chartRange === "3M") {
        return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      }
      return date.toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" });
    },
    [chartRange]
  );

  const latestChartPoint = useMemo(() => {
    if (chartDataWindow.length === 0) return null;
    return chartDataWindow[chartDataWindow.length - 1];
  }, [chartDataWindow]);

  const renderChartTooltip = useCallback(
    ({
      active,
      payload,
      label,
    }: {
      active?: boolean;
      payload?: readonly { dataKey?: string; value?: number | string }[];
      label?: string | number;
    }) => {
      if (!active || !payload || payload.length === 0) return null;
      const labelDate =
        typeof label === "number"
          ? new Date(label).toLocaleDateString("pt-BR")
          : typeof label === "string"
            ? label
            : "-";

      const byKey: Record<string, number> = {};
      for (const item of payload) {
        const key = item.dataKey || "";
        if (!key) continue;
        if (key === "valorCarteira" && !visibleSeries.valorCarteira) continue;
        if (key === "aporteLiquido" && !visibleSeries.aporteLiquido) continue;
        if (key === "resultado" && !visibleSeries.resultado) continue;
        const parsed = typeof item.value === "number" ? item.value : Number(item.value || 0);
        byKey[key] = parsed;
      }

      const rowPayload = (payload[0] as any)?.payload || {};
      const valorCarteira = byKey.valorCarteira ?? Number(rowPayload?.valorCarteira ?? 0);
      const aporteLiquido = byKey.aporteLiquido ?? Number(rowPayload?.aporteLiquido ?? 0);
      const resultado = byKey.resultado ?? valorCarteira - aporteLiquido;

      return (
        <div className="min-w-[250px] rounded-md border border-slate-700/90 bg-[#0b1220]/95 p-3 shadow-2xl backdrop-blur-sm">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-300">Data: {labelDate}</p>
          <div className="space-y-1.5 text-sm font-semibold">
            {visibleSeries.aporteLiquido && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-amber-400">Aporte Líquido</span>
                <span className="text-amber-300">{formatCurrency(aporteLiquido)}</span>
              </div>
            )}
            {visibleSeries.valorCarteira && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-blue-400">Valor da Carteira</span>
                <span className="text-blue-300">{formatCurrency(valorCarteira)}</span>
              </div>
            )}
            {visibleSeries.resultado && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-white">Resultado</span>
                <span className={resultado >= 0 ? "text-green-400" : "text-red-400"}>
                  {formatCurrency(resultado)}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    },
    [visibleSeries]
  );

  return (
    <main className="container px-4 md:px-6 py-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento de Carteira</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de posição, P/L e histórico operacional.
          </p>
          {updatedAt && (
            <p className="text-xs text-muted-foreground">
              Atualizado em {updatedAt.toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCarteiraModalOpen(true)}>
            Administrar Carteira
          </Button>
          <Button variant="outline" asChild>
            <Link href="/crypto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <Button onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-500">Erro</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {warning && !error && (
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-yellow-500">Aviso de mercado</CardTitle>
            <CardDescription>{warning}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valor de Mercado</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.valorTotalAtual)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Valor atual estimado da carteira
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Caixa Atual</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.saldoCaixa ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Valor em caixa após compras e vendas
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Não Realizado</CardDescription>
            <CardTitle
              className={`text-2xl ${
                summary.totalNaoRealizado >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(summary.totalNaoRealizado)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Resultado potencial com posição aberta
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Patrimônio Total</CardDescription>
            <CardTitle
              className={`text-2xl ${
                Number(summary.resultadoTotal ?? 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(summary.patrimonioTotal ?? (summary.valorTotalAtual + (summary.saldoCaixa ?? 0)))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Resultado: {formatCurrency(summary.resultadoTotal ?? 0)} ({Number(summary.resultadoPercentual ?? 0).toFixed(2)}%)
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evolução da Carteira</CardTitle>
          <CardDescription>
            Padrão investimento: comparação entre valor da carteira e aportes líquidos no período.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["1M", "3M", "6M", "12M", "ALL"] as ChartRange[]).map((range) => (
              <Button
                key={range}
                variant={chartRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setChartRange(range)}
              >
                {range === "ALL" ? "Tudo" : range}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void gerarSnapshots(false)}
              disabled={!carteira?.id || generatingSnapshots}
            >
              {generatingSnapshots ? "Gerando histórico..." : "Atualizar Histórico"}
            </Button>
            <Button
              variant={visibleSeries.valorCarteira ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setVisibleSeries((prev) => ({ ...prev, valorCarteira: !prev.valorCarteira }))
              }
            >
              Carteira
            </Button>
            <Button
              variant={visibleSeries.aporteLiquido ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setVisibleSeries((prev) => ({ ...prev, aporteLiquido: !prev.aporteLiquido }))
              }
            >
              Aporte
            </Button>
            <Button
              variant={visibleSeries.resultado ? "default" : "outline"}
              size="sm"
              onClick={() => setVisibleSeries((prev) => ({ ...prev, resultado: !prev.resultado }))}
            >
              Resultado
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-sm text-muted-foreground">Variação no período</div>
              <div className={`text-lg ${chart.delta >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}`}>
                {formatCurrency(chart.delta)} ({chart.deltaPct.toFixed(2)}%)
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-sm text-muted-foreground">Máximo Drawdown</div>
              <div className="text-lg text-red-600 font-semibold">{chart.maxDrawdownPct.toFixed(2)}%</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-sm text-muted-foreground">Janela</div>
              <div className="text-base font-semibold">
                {chart.firstLabel} até {chart.lastLabel}
              </div>
            </div>
          </div>
          {latestChartPoint && (
            <div className="grid gap-3 md:grid-cols-3">
              {visibleSeries.aporteLiquido && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-sm text-amber-300">Aporte Líquido (Atual)</div>
                  <div className="text-lg font-semibold text-amber-200">
                    {formatCurrency(latestChartPoint.aporteLiquido)}
                  </div>
                </div>
              )}
              {visibleSeries.valorCarteira && (
                <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
                  <div className="text-sm text-blue-300">Valor da Carteira (Atual)</div>
                  <div className="text-lg font-semibold text-blue-200">
                    {formatCurrency(latestChartPoint.valorCarteira)}
                  </div>
                </div>
              )}
              {visibleSeries.resultado && (
                <div className="rounded-md border border-slate-500/30 bg-slate-500/5 p-3">
                  <div className="text-sm text-slate-300">Resultado (Atual)</div>
                  <div
                    className={`text-lg font-semibold ${
                      latestChartPoint.resultado >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {formatCurrency(latestChartPoint.resultado)}
                  </div>
                </div>
              )}
            </div>
          )}

          {!chart.hasData ? (
            <div className="text-sm text-muted-foreground">
              Sem dados suficientes para desenhar o gráfico.
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-md border border-slate-800 bg-[#070b14]">
                <div className="h-[340px] md:h-[540px] min-w-[680px] px-3 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      syncId="carteira-evolution"
                      data={chartDataWindow}
                      margin={{ top: 18, right: 50, left: 8, bottom: 12 }}
                    >
                      <CartesianGrid stroke="#1f2937" strokeDasharray="2 6" strokeOpacity={0.75} />
                      <XAxis
                        dataKey="ts"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        scale="time"
                        minTickGap={24}
                        tickCount={8}
                        tickFormatter={xTickFormatter}
                        axisLine={{ stroke: "#334155", strokeOpacity: 0.8 }}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        dy={8}
                      />
                      <YAxis
                        yAxisId="principal"
                        orientation="right"
                        scale="linear"
                        domain={["auto", "auto"]}
                        axisLine={{ stroke: "#334155", strokeOpacity: 0.8 }}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickCount={12}
                        tickFormatter={(value) => formatCompact(value as number)}
                        width={88}
                      />
                      <YAxis
                        yAxisId="resultado"
                        hide
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        content={renderChartTooltip}
                        cursor={<CrosshairCursor />}
                      />
                      <Legend
                        wrapperStyle={{ color: "#cbd5e1", paddingTop: 6 }}
                        iconType="plainline"
                        formatter={(value) => (
                          <span style={{ color: "#cbd5e1", fontSize: "13px", fontWeight: 600 }}>
                            {value}
                          </span>
                        )}
                      />
                      <Area
                        yAxisId="principal"
                        type="monotone"
                        dataKey="valorCarteira"
                        name="Valor da Carteira"
                        stroke="#3b82f6"
                        fill="#1d4ed8"
                        fillOpacity={0.12}
                        strokeWidth={1.6}
                        hide={!visibleSeries.valorCarteira}
                      />
                      <Line
                        yAxisId="principal"
                        type="monotone"
                        dataKey="valorCarteira"
                        name="Valor da Carteira"
                        stroke="#3b82f6"
                        strokeWidth={2.8}
                        dot={false}
                        activeDot={{ r: 5, fill: "#3b82f6", stroke: "#ffffff", strokeWidth: 2 }}
                        legendType="none"
                        tooltipType="none"
                        hide={!visibleSeries.valorCarteira}
                      />
                      <Line
                        yAxisId="principal"
                        type="monotone"
                        dataKey="aporteLiquido"
                        name="Aporte Líquido"
                        stroke="#f59e0b"
                        strokeWidth={2.2}
                        dot={false}
                        hide={!visibleSeries.aporteLiquido}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {visibleSeries.resultado && (
                  <div className="h-[130px] md:h-[170px] border-t border-slate-800 px-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        syncId="carteira-evolution"
                        data={chartDataWindow}
                        margin={{ top: 8, right: 50, left: 8, bottom: 2 }}
                      >
                        <CartesianGrid stroke="#1f2937" strokeDasharray="2 6" strokeOpacity={0.5} />
                        <XAxis hide dataKey="ts" type="number" domain={["dataMin", "dataMax"]} scale="time" />
                        <YAxis
                          orientation="right"
                          axisLine={{ stroke: "#334155", strokeOpacity: 0.8 }}
                          tickLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          tickFormatter={(value) => formatCompact(value as number)}
                          width={88}
                        />
                        <Tooltip content={renderChartTooltip} cursor={<CrosshairCursor />} />
                        <Line
                          type="monotone"
                          dataKey="resultado"
                          name="Resultado"
                          stroke="#e2e8f0"
                          strokeWidth={2.1}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                <span>Início: {chart.firstLabel}</span>
                <span>Fim: {chart.lastLabel}</span>
                <span>Mínimo: {formatCurrency(chart.min)}</span>
                <span>Máximo: {formatCurrency(chart.max)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Exposição
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {assets.length} ativo(s) com posição calculada.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Ganho potencial
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ativos com P/L não realizado positivo:{" "}
            {assets.filter((a) => a.naoRealizado > 0).length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Pressão de perda
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ativos com P/L não realizado negativo:{" "}
            {assets.filter((a) => a.naoRealizado < 0).length}
          </CardContent>
        </Card>
      </section>

      <CarteiraAdminModal
        isOpen={isCarteiraModalOpen}
        onClose={() => setIsCarteiraModalOpen(false)}
        carteira={carteira}
        aportes={aportes}
        onSaved={async () => {
          await loadData();
        }}
      />
    </main>
  );
}
