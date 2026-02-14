import { promises as fs } from "fs";
import { spawn } from "child_process";
import path from "path";
import { CRYPTO_MW_BASE_DIR, CRYPTO_MW_FILES, CRYPTO_MW_LOG_DIR, DEFAULT_SYMBOLS } from "@/lib/crypto-middleware/paths";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return parseJsonLenient<T>(raw);
  } catch {
    return null;
  }
}

async function readJsonlFile(filePath: string, limit = 2000): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return parseJsonLenient<Record<string, unknown>>(line);
        } catch {
          return null;
        }
      })
      .filter((row): row is Record<string, unknown> => !!row);
    return rows.slice(-limit);
  } catch {
    return [];
  }
}

function parseJsonLenient<T>(raw: string): T {
  // Python pode serializar NaN/Infinity em arquivos locais; JSON.parse do Node rejeita.
  const sanitized = raw
    .replace(/\bNaN\b/g, "null")
    .replace(/\bInfinity\b/g, "null")
    .replace(/\b-Infinity\b/g, "null");
  return JSON.parse(sanitized) as T;
}

async function readLastJsonlRow(filePath: string): Promise<Record<string, unknown> | null> {
  const rows = await readJsonlFile(filePath, 1);
  return rows.length ? rows[rows.length - 1] : null;
}

export async function getBacktestSummary() {
  return readJsonFile<Record<string, unknown>>(CRYPTO_MW_FILES.backtestSummary);
}

export async function getBacktestSweep() {
  return readJsonFile<Record<string, unknown>>(CRYPTO_MW_FILES.backtestSweep);
}

export async function getLivePayload() {
  const out: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    symbols: {},
  };

  const macroSnapshot = (await getGlobalNewsPayload()).macro ?? {};
  const globalPosture = String((macroSnapshot as Record<string, unknown>).posture ?? "sem_dados");
  const symbols = out.symbols as Record<string, unknown>;

  for (const symbol of DEFAULT_SYMBOLS) {
    const row = await readLastJsonlRow(path.join(CRYPTO_MW_LOG_DIR, `${symbol}.jsonl`));
    if (!row) continue;

    const vol = (typeof row.volume === "object" && row.volume ? row.volume : {}) as Record<string, unknown>;
    const context = (typeof row.context_score === "object" && row.context_score ? row.context_score : {}) as Record<string, unknown>;
    const rr = (typeof row.rr_range_4h === "object" && row.rr_range_4h ? row.rr_range_4h : {}) as Record<string, unknown>;
    const dq = (typeof row.data_quality === "object" && row.data_quality ? row.data_quality : {}) as Record<string, unknown>;
    const rg = (typeof row.risk_guardrails === "object" && row.risk_guardrails ? row.risk_guardrails : {}) as Record<string, unknown>;

    let posture = globalPosture;
    const macroLine = String(row.macro_news_line ?? "");
    if (posture === "sem_dados" && macroLine.includes("postura:")) {
      try {
        posture = macroLine.split("postura:")[1].trim().split("|")[0].trim();
      } catch {
        posture = "sem_dados";
      }
    }

    const price = toNumber(row.price);
    const rrUp = toNumber(rr.upside_pct);
    const rrDown = toNumber(rr.downside_pct);
    const rrAtrRiskPct = toNumber(rr.rr_atr_risk_pct);
    const rrAdj = toNumber(rr.rr_adj);
    const rrAtr = toNumber(rr.rr_atr);
    const dqScore = toNumber(dq.score);
    const dqThreshold = toNumber(dq.threshold);
    const rgTrade = toNumber(rg.trade_capital_pct);
    const rgTradeLimit = toNumber(rg.trade_limit_pct);
    const rgPortProj = toNumber(rg.portfolio_projected_pct);
    const rgPortLimit = toNumber(rg.portfolio_limit_pct);
    const rgBlocked = Boolean(rg.blocked ?? false);
    const v1 = toNumber(vol.vol1_ratio);
    const v4 = toNumber(vol.vol4_ratio);
    const stage = String(row.stage ?? "WAIT");
    const regime1w = String(row.regime_1w ?? "");
    const regime4h = String(row.regime_4h ?? "");

    let target1: number | null = null;
    let target2: number | null = null;
    let stopStructural: number | null = null;
    let stopOperational: number | null = null;
    let riskStructuralPct: number | null = rrDown;
    let riskOperationalPct: number | null = null;

    if (price !== null && rrUp !== null) {
      target1 = price * (1 + (Math.max(0, rrUp) * 0.5) / 100);
      target2 = price * (1 + Math.max(0, rrUp) / 100);
    }
    if (price !== null && rrDown !== null) {
      const downCap = Math.min(Math.max(0, rrDown), 20);
      stopStructural = price * (1 - downCap / 100);
      const opFromAtr = rrAtrRiskPct !== null ? rrAtrRiskPct * 1.1 : downCap;
      const opCapped = Math.min(Math.max(opFromAtr, 1.2), 3.2);
      const opFinal = Math.min(opCapped, downCap);
      riskOperationalPct = opFinal;
      stopOperational = price * (1 - opFinal / 100);
    }

    const trendOk = regime1w.includes("ALTA");
    const structureOk = !regime4h.includes("BAIXA");
    const volumeOk = v1 !== null && v1 >= 1.05 && v4 !== null && v4 >= 1.0;
    const rrOk = (rrAdj !== null && rrAdj >= 1.0) || (rrAtr !== null && rrAtr >= 1.2);

    let macroState: "ok" | "fail" | "na" = "ok";
    if (posture === "risk-off") macroState = "fail";
    else if (posture === "sem_dados") macroState = "na";
    const macroOk = macroState === "ok";

    const dataOk = dqScore === null || dqThreshold === null || dqScore >= dqThreshold;
    const checks = [trendOk, structureOk, volumeOk, rrOk, dataOk];
    let checksOk = checks.filter(Boolean).length;
    let checksTotal = checks.length;
    if (macroState !== "na") {
      checksTotal += 1;
      if (macroOk) checksOk += 1;
    }
    const confidence = Math.round((checksOk / Math.max(1, checksTotal)) * 100);

    let action = stage === "FULL" || stage === "MEDIUM" || stage === "SMALL" ? "COMPRAR" : "AGUARDAR";
    if (rgBlocked) action = "AGUARDAR";

    const vol1Gap = v1 === null ? null : Math.max(0, 1.05 - v1);
    const vol4Gap = v4 === null ? null : Math.max(0, 1.0 - v4);
    const rrAdjGap = rrAdj === null ? null : Math.max(0, 1.0 - rrAdj);
    const rrAtrGap = rrAtr === null ? null : Math.max(0, 1.2 - rrAtr);

    let bottleneck: Record<string, string> = {
      key: "ok",
      label: "Sem gargalo dominante",
      detail: "Condições principais estão aceitáveis.",
    };
    if (!structureOk) {
      bottleneck = {
        key: "structure_4h",
        label: "Estrutura 4H ainda em baixa",
        detail: "Aguardar fechamento 4H com virada bullish para ganhar convicção.",
      };
    }
    if (!volumeOk) {
      if ((vol1Gap ?? 0) >= (vol4Gap ?? 0)) {
        bottleneck = {
          key: "volume_1h",
          label: "Volume 1H abaixo do mínimo",
          detail: `Falta +${(vol1Gap ?? 0).toFixed(2)}x para atingir 1.05x.`,
        };
      } else {
        bottleneck = {
          key: "volume_4h",
          label: "Volume 4H abaixo do mínimo",
          detail: `Falta +${(vol4Gap ?? 0).toFixed(2)}x para atingir 1.00x.`,
        };
      }
    } else if (!rrOk) {
      const rrDetail =
        rrAdjGap !== null && rrAtrGap !== null
          ? `Precisa RR>=1.0 (falta ${rrAdjGap.toFixed(2)}) ou RR_ATR>=1.2 (falta ${rrAtrGap.toFixed(2)}).`
          : "Aguardando melhora da assimetria risco/retorno.";
      bottleneck = {
        key: "rr",
        label: "Assimetria risco/retorno fraca",
        detail: rrDetail,
      };
    }

    const buyNowSteps: string[] = [];
    if (!trendOk) buyNowSteps.push("Esperar 1W voltar para tendência de alta.");
    if (!structureOk) buyNowSteps.push("Esperar fechamento 4H com estrutura bullish.");
    if (!volumeOk) {
      if (vol1Gap !== null && vol1Gap > 0) buyNowSteps.push(`Volume 1H: precisa +${vol1Gap.toFixed(2)}x para bater 1.05x.`);
      if (vol4Gap !== null && vol4Gap > 0) buyNowSteps.push(`Volume 4H: precisa +${vol4Gap.toFixed(2)}x para bater 1.00x.`);
    }
    if (!rrOk) {
      if (rrAdjGap !== null && rrAdjGap > 0) buyNowSteps.push(`RR ajustado: falta +${rrAdjGap.toFixed(2)} para chegar em 1.00.`);
      if (rrAtrGap !== null && rrAtrGap > 0) buyNowSteps.push(`RR_ATR: falta +${rrAtrGap.toFixed(2)} para chegar em 1.20.`);
    }
    if (macroState === "fail") buyNowSteps.push("Macro em risk-off: evitar aumentar exposição agora.");
    if (macroState === "na") buyNowSteps.push("Macro sem dados (n/a): não bloqueia entrada, mas reduz contexto.");
    if (!buyNowSteps.length) buyNowSteps.push("Condições centrais atendidas; executar com gestão de risco.");
    if (rgBlocked && Array.isArray(rg.issues)) {
      for (const issue of rg.issues) {
        const txt = String(issue ?? "").trim();
        if (txt) buyNowSteps.push(`Guardrail: ${txt}`);
      }
    }

    const targetAllocMap: Record<string, number> = { BTCUSDT: 30, ETHUSDT: 20, XRPUSDT: 10 };
    const stageMultMap: Record<string, number> = { SMALL: 0.2, MEDIUM: 0.5, FULL: 1.0 };
    const suggestedAllocPct = (targetAllocMap[symbol] ?? 0) * (stageMultMap[stage] ?? 0);
    const riskPct = riskOperationalPct !== null ? riskOperationalPct : rrDown;
    const invalidated = action === "COMPRAR" && price !== null && stopOperational !== null ? price <= stopOperational : false;

    let scenarioBase = "Entrada em rompimento/continuação com gestão de risco.";
    let scenarioAlt = "Se perder momentum e volume, manter em espera.";
    if (regime1w.includes("ALTA") && regime4h.includes("BAIXA")) {
      scenarioBase = "Aguardar 4H melhorar; entradas apenas com gatilho forte 1H.";
      scenarioAlt = "Se 4H seguir em baixa, evitar novas compras.";
    } else if (regime1w.includes("BAIXA")) {
      scenarioBase = "Priorizar defesa; compras somente táticas e pequenas.";
      scenarioAlt = "Se 1W voltar para alta, reavaliar entradas.";
    }

    symbols[symbol] = {
      ts_utc: row.ts_utc ?? null,
      price,
      stage,
      regime_1w: regime1w,
      regime_4h: regime4h,
      vol1_ratio: v1,
      vol4_ratio: v4,
      context_score: context.value ?? null,
      context_label: context.label ?? null,
      rr_adj: rrAdj,
      rr_atr: rrAtr,
      rr_up_pct: rrUp,
      rr_down_pct: rrDown,
      trade_plan: {
        action,
        entry_price: price,
        stop_price: stopOperational,
        stop_operational_price: stopOperational,
        stop_structural_price: stopStructural,
        target1_price: target1,
        target2_price: target2,
        confidence,
        suggested_alloc_pct: suggestedAllocPct,
        risk_pct: riskPct,
        risk_operational_pct: riskOperationalPct,
        risk_structural_pct: riskStructuralPct,
        invalidated,
        quality: {
          trend_1w: trendOk,
          structure_4h: structureOk,
          volume: volumeOk,
          rr: rrOk,
          data: dataOk,
          macro: macroOk,
          macro_state: macroState,
          macro_posture: posture,
        },
        data_quality_score: dqScore,
        data_quality_threshold: dqThreshold,
        risk_per_trade_pct: rgTrade,
        risk_per_trade_limit_pct: rgTradeLimit,
        risk_portfolio_projected_pct: rgPortProj,
        risk_portfolio_limit_pct: rgPortLimit,
        guardrails_blocked: rgBlocked,
        scenario_base: scenarioBase,
        scenario_alt: scenarioAlt,
        bottleneck: bottleneck,
        buy_now_steps: buyNowSteps.slice(0, 5),
      },
    };
  }

  return out;
}

function inferImpact(title: string): "alto" | "médio" | "baixo" {
  const t = title.toLowerCase();
  if (/(fed|fomc|powell|cpi|inflation|war|conflict|sanction|regulation|sec)/.test(t)) return "alto";
  if (/(yield|treasury|bank|dollar|oil|gdp|employment)/.test(t)) return "médio";
  return "baixo";
}

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/(fed|fomc|powell|yield|treasury|interest rate)/.test(t)) return "Juros/Fed";
  if (/(cpi|inflation|ppi|prices)/.test(t)) return "Inflação";
  if (/(war|conflict|sanction|attack|geopolitical)/.test(t)) return "Geopolítica";
  if (/(sec|regulation|regulatory|law|ban|etf)/.test(t)) return "Regulação";
  if (/(bank|liquidity|credit|dollar|funding)/.test(t)) return "Liquidez";
  return "Mercado Global";
}

export async function getGlobalNewsPayload() {
  const pythonPayload = await getGlobalNewsPayloadFromPython();
  if (pythonPayload) {
    return pythonPayload;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    status: "sem_dados",
    macro: {
      badge: "🟡",
      macro_score: null as number | null,
      posture: "sem_dados",
      updated_ts: null as string | null,
    },
    headlines: [] as Array<Record<string, unknown>>,
    top_risks: [] as Array<Record<string, unknown>>,
    watchlist: [] as string[],
    notes: [] as string[],
  };

  const cache = await readJsonFile<Record<string, unknown>>(CRYPTO_MW_FILES.macroContextCache);
  const cacheData = cache && typeof cache.data === "object" ? (cache.data as Record<string, unknown>) : cache;
  if (cacheData && typeof cacheData === "object") {
    payload.status = "ok";
    payload.macro.badge = String(cacheData.badge ?? "🟡");
    payload.macro.macro_score = toNumber(cacheData.macro_score);
    payload.macro.posture = String(cacheData.posture ?? "sem_dados");
    if (typeof cache?.ts === "number") {
      payload.macro.updated_ts = new Date(cache.ts * 1000).toISOString();
    }
    const highlights = Array.isArray(cacheData.highlights) ? cacheData.highlights : [];
    const enriched = highlights
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .map((title) => ({
        title,
        impact: inferImpact(title),
        category: inferCategory(title),
      }));
    payload.headlines = enriched.slice(0, 20);
    payload.top_risks = enriched.slice(0, 5);
  }

  if (!payload.top_risks.length) {
    const fallbackHighlights: string[] = [];
    for (const symbol of DEFAULT_SYMBOLS) {
      const row = await readLastJsonlRow(path.join(CRYPTO_MW_LOG_DIR, `${symbol}.jsonl`));
      if (!row) continue;
      const bullets = Array.isArray(row.macro_bullets) ? row.macro_bullets : [];
      for (const bullet of bullets) {
        const title = String(bullet ?? "").trim();
        if (!title) continue;
        if (!fallbackHighlights.includes(title)) {
          fallbackHighlights.push(title);
        }
      }
      if (fallbackHighlights.length >= 20) break;
    }

    if (fallbackHighlights.length) {
      const enriched = fallbackHighlights.map((title) => ({
        title,
        impact: inferImpact(title),
        category: inferCategory(title),
      }));
      payload.status = "ok";
      payload.headlines = enriched.slice(0, 20);
      payload.top_risks = enriched.slice(0, 5);
      payload.notes.push("Fallback local ativo: usando macro_bullets dos logs.");
    }
  }

  if (!payload.top_risks.length) {
    payload.watchlist.push("Rodar middleware.py para atualizar cache macro e headlines.");
  } else {
    payload.watchlist.push("Monitorar top riscos antes de aumentar exposição.");
  }

  return payload;
}

async function getGlobalNewsPayloadFromPython(): Promise<Record<string, unknown> | null> {
  const script = [
    "import json",
    "import web_dashboard",
    "payload = web_dashboard.build_global_news_payload()",
    "print(json.dumps(payload, ensure_ascii=False))",
  ].join(";");

  return new Promise((resolve) => {
    const child = spawn("python3", ["-c", script], {
      cwd: CRYPTO_MW_BASE_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 12000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        resolve(null);
        return;
      }
      try {
        const parsed = parseJsonLenient<Record<string, unknown>>(stdout.trim());
        resolve(parsed);
      } catch {
        resolve(null);
      }
    });

    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

export async function getRecentTradesPayload(symbol = "", limit = 50) {
  const events = await readJsonlFile(CRYPTO_MW_FILES.tradeHistory, 2000);
  const symFilter = symbol.trim().toUpperCase();
  const filteredEvents = events.filter((ev) => !symFilter || String(ev.symbol ?? "").toUpperCase() === symFilter);
  const latestPrices = await getLatestPricesMap();

  const openBySymbol: Record<string, Record<string, unknown>> = {};
  const closed: Record<string, unknown>[] = [];

  for (const ev of filteredEvents) {
    const sym = String(ev.symbol ?? "").toUpperCase();
    if (!sym) continue;
    const side = String(ev.side ?? "").toUpperCase();
    const tsMs = parseIsoMs(ev.ts_utc);
    const signalType = String(ev.signal_type ?? "").toUpperCase();

    if (side === "BUY") {
      const current = openBySymbol[sym];
      if (!current) {
        openBySymbol[sym] = {
          symbol: sym,
          side: "BUY",
          status: "OPEN",
          entry_ts: formatIsoFromMs(tsMs),
          entry_price: toNumber(ev.entry_price),
          target_price: toNumber(ev.target_price),
          expected_profit_pct: toNumber(ev.expected_profit_pct),
          stage: ev.stage ?? null,
          last_signal: signalType || "ENTRY",
        };
      } else {
        const target = toNumber(ev.target_price);
        const expected = toNumber(ev.expected_profit_pct);
        if (target !== null) current.target_price = target;
        if (expected !== null) current.expected_profit_pct = expected;
        if (ev.stage) current.stage = ev.stage;
        current.last_signal = signalType || "SCALE_IN";
      }
      continue;
    }

    if (side === "SELL") {
      const current = openBySymbol[sym];
      const exitPrice = toNumber(ev.exit_price);
      const entryPriceEvent = toNumber(ev.entry_price);

      if (current) {
        let entryPrice = toNumber(current.entry_price);
        if (entryPrice === null) entryPrice = entryPriceEvent;
        let realizedPct = toNumber(ev.realized_profit_pct);
        if (realizedPct === null && entryPrice !== null && exitPrice !== null && entryPrice !== 0) {
          realizedPct = ((exitPrice / entryPrice) - 1) * 100;
        }
        const entryMs = parseIsoMs(current.entry_ts);
        let holdHours: number | null = null;
        if (entryMs !== null && tsMs !== null && tsMs >= entryMs) {
          holdHours = (tsMs - entryMs) / 3600000;
        }

        closed.push({
          symbol: sym,
          side: "BUY",
          status: "CLOSED",
          entry_ts: current.entry_ts ?? null,
          exit_ts: formatIsoFromMs(tsMs),
          entry_price: entryPrice,
          exit_price: exitPrice,
          target_price: toNumber(current.target_price),
          expected_profit_pct: toNumber(current.expected_profit_pct),
          realized_profit_pct: realizedPct,
          hold_hours: holdHours,
          stage: current.stage ?? null,
          last_signal: signalType || "EXIT",
        });
        delete openBySymbol[sym];
      } else {
        closed.push({
          symbol: sym,
          side: "BUY",
          status: "CLOSED",
          entry_ts: null,
          exit_ts: formatIsoFromMs(tsMs),
          entry_price: entryPriceEvent,
          exit_price: exitPrice,
          target_price: null,
          expected_profit_pct: null,
          realized_profit_pct: toNumber(ev.realized_profit_pct),
          hold_hours: null,
          stage: ev.stage ?? null,
          last_signal: signalType || "EXIT",
        });
      }
    }
  }

  const openTrades: Record<string, unknown>[] = [];
  const nowMs = Date.now();
  for (const [sym, t] of Object.entries(openBySymbol)) {
    const entryPrice = toNumber(t.entry_price);
    const lastPrice = latestPrices[sym] ?? null;
    let unrealized: number | null = null;
    if (entryPrice !== null && lastPrice !== null && entryPrice !== 0) {
      unrealized = ((lastPrice / entryPrice) - 1) * 100;
    }
    const entryMs = parseIsoMs(t.entry_ts);
    let holdHours: number | null = null;
    if (entryMs !== null && nowMs >= entryMs) {
      holdHours = (nowMs - entryMs) / 3600000;
    }

    openTrades.push({
      symbol: sym,
      side: "BUY",
      status: "OPEN",
      entry_ts: t.entry_ts ?? null,
      exit_ts: null,
      entry_price: entryPrice,
      exit_price: null,
      current_price: lastPrice,
      target_price: toNumber(t.target_price),
      expected_profit_pct: toNumber(t.expected_profit_pct),
      realized_profit_pct: null,
      unrealized_profit_pct: unrealized,
      hold_hours: holdHours,
      stage: t.stage ?? null,
      last_signal: t.last_signal ?? null,
    });
  }

  const allTrades = [...closed, ...openTrades];
  allTrades.sort((a, b) => {
    const ta = parseIsoMs((a.exit_ts as string | null) ?? (a.entry_ts as string | null)) ?? 0;
    const tb = parseIsoMs((b.exit_ts as string | null) ?? (b.entry_ts as string | null)) ?? 0;
    return tb - ta;
  });
  const sliced = allTrades.slice(0, limit);

  return {
    symbol: symFilter || "ALL",
    count: sliced.length,
    trades: sliced,
    source: CRYPTO_MW_FILES.tradeHistory,
  };
}

function parseIsoMs(value: unknown): number | null {
  if (!value) return null;
  const dt = new Date(String(value));
  const ms = dt.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatIsoFromMs(ms: number | null): string | null {
  if (ms === null) return null;
  return new Date(ms).toISOString();
}

async function getLatestPricesMap(): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  for (const sym of DEFAULT_SYMBOLS) {
    const row = await readLastJsonlRow(path.join(CRYPTO_MW_LOG_DIR, `${sym}.jsonl`));
    if (!row) continue;
    const price = toNumber(row.price);
    if (price !== null) prices[sym] = price;
  }
  return prices;
}
