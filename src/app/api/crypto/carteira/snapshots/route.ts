import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/config";
import { Database } from "@/types/supabase";

const createSupabaseClient = () => {
  const cookieStore = cookies();
  return createServerClient<Database>(supabaseConfig.url!, supabaseConfig.serviceRoleKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
};

async function getInternalUserId(supabase: ReturnType<typeof createSupabaseClient>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Não autenticado", status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (profileError || !profile?.id) {
    return { error: "Perfil interno não encontrado", status: 404 as const };
  }

  return { userId: profile.id };
}

const startOfDayUtc = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const toDateKey = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 24 * 60 * 60 * 1000;

type HistoricalPriceByDate = Record<string, number>;
type SnapshotOperation = {
  ts: number;
  moeda_id: string;
  tipo: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  taxa: number;
};

async function fetchDailyHistoricalPrices(
  coinId: string,
  start: Date,
  end: Date
): Promise<HistoricalPriceByDate> {
  const fromSec = Math.floor(start.getTime() / 1000);
  const toSec = Math.floor((end.getTime() + DAY_MS - 1) / 1000);
  const url =
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}` +
    `/market_chart/range?vs_currency=usd&from=${fromSec}&to=${toSec}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CoinGecko ${coinId}: HTTP ${response.status}`);
  }

  const json = await response.json();
  const prices = Array.isArray(json?.prices) ? (json.prices as Array<[number, number]>) : [];
  const byDate: HistoricalPriceByDate = {};

  for (const row of prices) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const ts = Number(row[0]);
    const price = Number(row[1]);
    if (!Number.isFinite(ts) || !Number.isFinite(price) || price <= 0) continue;
    const key = toDateKey(new Date(ts));
    // Mantém a última leitura do dia (aproximação de fechamento diário)
    byDate[key] = price;
  }

  return byDate;
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();
  const db = supabase as any;

  try {
    const userResult = await getInternalUserId(supabase);
    if ("error" in userResult) {
      return NextResponse.json({ error: userResult.error }, { status: userResult.status });
    }

    const carteiraId = request.nextUrl.searchParams.get("carteira_id");
    if (!carteiraId) {
      return NextResponse.json({ error: "carteira_id é obrigatório" }, { status: 400 });
    }

    const monthsParam = Number(request.nextUrl.searchParams.get("months") || 12);
    const months = Number.isFinite(monthsParam) ? Math.min(Math.max(monthsParam, 1), 36) : 12;

    const { data: carteira, error: carteiraError } = await db
      .from("crypto_carteiras")
      .select("id, usuario_id")
      .eq("id", carteiraId)
      .eq("usuario_id", userResult.userId)
      .maybeSingle();

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    const end = startOfDayUtc(new Date());
    const start = startOfDayUtc(new Date(end));
    start.setUTCMonth(start.getUTCMonth() - months);

    const { data, error } = await db
      .from("crypto_carteira_snapshots")
      .select("*")
      .eq("carteira_id", carteiraId)
      .gte("data_ref", toDateKey(start))
      .lte("data_ref", toDateKey(end))
      .order("data_ref", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error: "Tabela de snapshots não encontrada. Execute a migração SQL de snapshots.",
          details: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ snapshots: data || [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();
  const db = supabase as any;

  try {
    const userResult = await getInternalUserId(supabase);
    if ("error" in userResult) {
      return NextResponse.json({ error: userResult.error }, { status: userResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const carteiraId = String(body.carteira_id || "");
    const monthsParam = Number(body.months ?? 12);
    const months = Number.isFinite(monthsParam) ? Math.min(Math.max(monthsParam, 1), 36) : 12;
    const strictMarket = body.strict_market !== false;
    const incremental = body.incremental === true;

    if (!carteiraId) {
      return NextResponse.json({ error: "carteira_id é obrigatório" }, { status: 400 });
    }

    const { data: carteira, error: carteiraError } = await db
      .from("crypto_carteiras")
      .select("id, usuario_id, valor_inicial")
      .eq("id", carteiraId)
      .eq("usuario_id", userResult.userId)
      .maybeSingle();

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    const end = startOfDayUtc(new Date());
    let start = startOfDayUtc(new Date(end));
    start.setUTCMonth(start.getUTCMonth() - months);

    if (incremental) {
      const { data: latestSnapshot, error: latestSnapshotError } = await db
        .from("crypto_carteira_snapshots")
        .select("data_ref")
        .eq("carteira_id", carteiraId)
        .order("data_ref", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSnapshotError && latestSnapshotError.code === "42P01") {
        return NextResponse.json(
          {
            error: "Tabela de snapshots não encontrada. Execute a migração SQL de snapshots.",
            details: latestSnapshotError.message,
            code: latestSnapshotError.code,
          },
          { status: 400 }
        );
      }

      // Atualização incremental segura:
      // 1) tenta processar somente dias novos desde o último snapshot
      // 2) mantém pequeno backfill de 3 dias para cobrir ajustes tardios
      const backfillStart = startOfDayUtc(new Date(end));
      backfillStart.setUTCDate(backfillStart.getUTCDate() - 3);
      start = backfillStart;

      if (latestSnapshot?.data_ref) {
        const nextDay = startOfDayUtc(new Date(`${latestSnapshot.data_ref}T00:00:00Z`));
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        if (nextDay.getTime() > start.getTime()) {
          start = nextDay;
        }
      }

      if (start.getTime() > end.getTime()) {
        return NextResponse.json(
          {
            ok: true,
            generated_days: 0,
            skipped: true,
            reason: "up_to_date",
            mode: "incremental",
            window: { from: toDateKey(start), to: toDateKey(end) },
          },
          { status: 200 }
        );
      }
    }
    const endIso = new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

    const [opsRes, aportesRes] = await Promise.all([
      db
        .from("crypto_operacoes")
        .select("moeda_id, tipo, quantidade, preco_unitario, valor_total, taxa, data_operacao")
        .eq("carteira_id", carteiraId)
        .lte("data_operacao", endIso)
        .order("data_operacao", { ascending: true }),
      db
        .from("crypto_carteira_aportes")
        .select("valor, data_aporte")
        .eq("carteira_id", carteiraId)
        .lte("data_aporte", endIso)
        .order("data_aporte", { ascending: true }),
    ]);

    if (opsRes.error) {
      return NextResponse.json({ error: opsRes.error.message }, { status: 500 });
    }
    if (aportesRes.error) {
      return NextResponse.json({ error: aportesRes.error.message }, { status: 500 });
    }

    const operations: SnapshotOperation[] = (opsRes.data || []).map((row: any) => ({
      ts: new Date(row.data_operacao).getTime(),
      moeda_id: String(row.moeda_id),
      tipo: String(row.tipo),
      quantidade: Number(row.quantidade || 0),
      preco_unitario: Number(row.preco_unitario || 0),
      valor_total: Number(row.valor_total || 0),
      taxa: Number(row.taxa || 0),
    }));

    const aportes = (aportesRes.data || []).map((row: any) => ({
      ts: new Date(row.data_aporte).getTime(),
      valor: Number(row.valor || 0),
    }));

    type PositionLot = { quantidade: number; custoUnitario: number };
    const lotsByAsset = new Map<string, PositionLot[]>();

    const assetIds = Array.from(new Set(operations.map((op: SnapshotOperation) => op.moeda_id)))
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const marketPricesByAsset = new Map<string, HistoricalPriceByDate>();
    const marketFetchErrors: Record<string, string> = {};

    // Poucos ativos (normalmente 3-10): 1 request por ativo é leve e melhora muito a precisão histórica.
    for (const assetId of assetIds) {
      try {
        const byDate = await fetchDailyHistoricalPrices(assetId, start, end);
        marketPricesByAsset.set(assetId, byDate);
      } catch (e: any) {
        marketFetchErrors[assetId] = e?.message || "falha_coingecko";
      }
    }

    // Em modo estrito, evita sobrescrever snapshots bons com fallback contábil
    // quando dados de mercado não estiverem confiáveis.
    if (strictMarket && assetIds.length > 0) {
      const requiredDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1);
      const insufficientAssets: string[] = [];
      for (const assetId of assetIds) {
        const dayPrices = marketPricesByAsset.get(assetId) || {};
        const coverage = Object.keys(dayPrices).length / requiredDays;
        if (coverage < 0.7) {
          insufficientAssets.push(assetId);
        }
      }
      if (insufficientAssets.length > 0) {
        return NextResponse.json(
          {
            error:
              "Dados de mercado insuficientes para atualizar snapshots com segurança. Nenhum snapshot foi sobrescrito.",
            insufficient_assets: insufficientAssets,
            market_fetch_errors: marketFetchErrors,
          },
          { status: 424 }
        );
      }
    }

    let aporteLiquido = Number(carteira.valor_inicial || 0);
    let caixaAtual = Number(carteira.valor_inicial || 0);
    const lastOpPriceByAsset = new Map<string, number>();

    let opCursor = 0;
    let aporteCursor = 0;
    const snapshots: Array<Record<string, unknown>> = [];

    const day = new Date(start);
    while (day.getTime() <= end.getTime()) {
      const dayEnd = day.getTime() + 24 * 60 * 60 * 1000 - 1;

      while (opCursor < operations.length && operations[opCursor].ts <= dayEnd) {
        const op = operations[opCursor];
        const lots = lotsByAsset.get(op.moeda_id) || [];

        if (op.tipo === "compra") {
          const qtdCompra = Math.max(0, Number(op.quantidade || 0));
          const custoTotalCompra = Number(op.valor_total || 0) + Number(op.taxa || 0);
          const custoUnitario = qtdCompra > 0 ? custoTotalCompra / qtdCompra : 0;
          lots.push({ quantidade: qtdCompra, custoUnitario });
          caixaAtual -= op.valor_total + op.taxa;
        } else {
          let qtdVendaRestante = Math.max(0, Number(op.quantidade || 0));
          while (qtdVendaRestante > 0 && lots.length > 0) {
            const lote = lots[0];
            const consumo = Math.min(qtdVendaRestante, lote.quantidade);
            lote.quantidade -= consumo;
            qtdVendaRestante -= consumo;
            if (lote.quantidade <= 1e-9) lots.shift();
          }
          caixaAtual += op.valor_total - op.taxa;
        }

        if (Number.isFinite(op.preco_unitario) && op.preco_unitario > 0) {
          lastOpPriceByAsset.set(op.moeda_id, op.preco_unitario);
        }
        lotsByAsset.set(op.moeda_id, lots);
        opCursor += 1;
      }

      while (aporteCursor < aportes.length && aportes[aporteCursor].ts <= dayEnd) {
        const ap = aportes[aporteCursor];
        aporteLiquido += ap.valor;
        caixaAtual += ap.valor;
        aporteCursor += 1;
      }

      // Valoração de mercado por dia: qtd aberta * preço histórico diário.
      const dayKey = toDateKey(day);
      let valorAtivos = 0;
      let hasMarketPrice = false;
      for (const [assetId, lots] of lotsByAsset.entries()) {
        const qtdAberta = lots.reduce((acc, lote) => acc + lote.quantidade, 0);
        if (qtdAberta <= 1e-9) continue;

        const byDate = marketPricesByAsset.get(assetId) || {};
        let price = byDate[dayKey];
        if (!(price > 0)) {
          price = lastOpPriceByAsset.get(assetId) || 0;
        }
        if (price > 0) hasMarketPrice = true;
        valorAtivos += qtdAberta * price;
      }

      // Fallback final: se não há preço histórico/última operação, usa custo base dos lotes
      // para evitar quebrar a série.
      if (!hasMarketPrice) {
        valorAtivos = 0;
        for (const lots of lotsByAsset.values()) {
          for (const lote of lots) {
            valorAtivos += lote.quantidade * lote.custoUnitario;
          }
        }
      }

      const patrimonioTotal = caixaAtual + valorAtivos;
      snapshots.push({
        carteira_id: carteiraId,
        data_ref: dayKey,
        aporte_liquido: Number(aporteLiquido.toFixed(2)),
        saldo_caixa: Number(caixaAtual.toFixed(2)),
        valor_ativos: Number(valorAtivos.toFixed(2)),
        patrimonio_total: Number(patrimonioTotal.toFixed(2)),
        fonte_preco: hasMarketPrice ? "coingecko_daily" : "ops_last_price",
        atualizado_em: new Date().toISOString(),
      });

      day.setUTCDate(day.getUTCDate() + 1);
    }

    if (snapshots.length > 0) {
      const { error: upsertError } = await db
        .from("crypto_carteira_snapshots")
        .upsert(snapshots, {
          onConflict: "carteira_id,data_ref",
          ignoreDuplicates: false,
        });
      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        generated_days: snapshots.length,
        mode: incremental ? "incremental" : "full",
        window: { from: toDateKey(start), to: toDateKey(end) },
        market_fetch_errors: marketFetchErrors,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
