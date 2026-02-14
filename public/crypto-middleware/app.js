function fmtNum(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(digits);
}

function fmtPct(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function fmtTs(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function stageClass(stage) {
  if (!stage) return "wait";
  return String(stage).toLowerCase();
}

let previousLiveSymbols = null;
let refreshInProgress = false;
const API_BASE = window.location.pathname.startsWith("/crypto-middleware") ? "/api/crypto-middleware" : "/api";

function actionModel(symbol, it, news, openTradesBySymbol = {}) {
  const plan = (it && it.trade_plan) || {};
  const quality = plan.quality || {};
  const confidence = Number(plan.confidence || 0);
  const actionRaw = String(plan.action || "AGUARDAR");
  const invalidated = Boolean(plan.invalidated);
  const guardrailsBlocked = Boolean(plan.guardrails_blocked);
  const hasOpenTrade = Boolean(openTradesBySymbol && openTradesBySymbol[symbol]);
  let action = invalidated ? "EVITAR / REDUZIR" : actionRaw;
  if (!invalidated && actionRaw === "AGUARDAR" && hasOpenTrade) {
    action = "MANTER POSIÇÃO";
  }
  const light = (invalidated || guardrailsBlocked) ? "red" : confidence >= 75 ? "green" : confidence >= 45 ? "yellow" : "red";

  const macroState = String(quality.macro_state || (quality.macro ? "ok" : "fail"));
  const macroPosture = String(quality.macro_posture || "sem_dados");
  const macroLabel =
    macroState === "na"
      ? "n/a"
      : (macroPosture === "risk-on" || macroPosture === "risk-off" || macroPosture === "neutro"
          ? macroPosture
          : (quality.macro ? "ok" : "falhou"));
  const checks = [
    { label: "1W tendência", state: Boolean(quality.trend_1w) ? "ok" : "fail" },
    { label: "4H estrutura", state: Boolean(quality.structure_4h) ? "ok" : "fail" },
    { label: "Volume", state: Boolean(quality.volume) ? "ok" : "fail" },
    { label: "RR", state: Boolean(quality.rr) ? "ok" : "fail" },
    { label: "Dados", state: Boolean(quality.data) ? "ok" : "fail" },
    { label: "Macro", state: macroState === "na" ? "na" : (Boolean(quality.macro) ? "ok" : "fail"), text: macroLabel },
  ];

  return {
    action,
    intent: action === "COMPRAR" ? "intent-buy" : light === "red" ? "intent-caution" : "intent-wait",
    light,
    note:
      action === "COMPRAR"
        ? "Plano ativo. Execute com gestão de risco."
        : action === "MANTER POSIÇÃO"
          ? "Posição aberta detectada. Priorize gestão de risco e proteção do capital."
          : "Sem vantagem clara. Melhor esperar confirmação.",
    checks,
    confidence,
    hasOpenTrade,
    entry: plan.entry_price,
    stop: plan.stop_price,
    stopOperational: plan.stop_operational_price,
    stopStructural: plan.stop_structural_price,
    target1: plan.target1_price,
    target2: plan.target2_price,
    allocPct: Number(plan.suggested_alloc_pct ?? 0),
    riskPct: Number(plan.risk_pct ?? NaN),
    riskOperationalPct: Number(plan.risk_operational_pct ?? NaN),
    riskStructuralPct: Number(plan.risk_structural_pct ?? NaN),
    riskTradePct: Number(plan.risk_per_trade_pct ?? NaN),
    riskTradeLimitPct: Number(plan.risk_per_trade_limit_pct ?? NaN),
    riskPortPct: Number(plan.risk_portfolio_projected_pct ?? NaN),
    riskPortLimitPct: Number(plan.risk_portfolio_limit_pct ?? NaN),
    dataQualityScore: Number(plan.data_quality_score ?? NaN),
    dataQualityThreshold: Number(plan.data_quality_threshold ?? NaN),
    guardrailsBlocked,
    invalidated,
    base: plan.scenario_base || "-",
    alt: plan.scenario_alt || "-",
    bottleneck: plan.bottleneck || null,
    buyNowSteps: Array.isArray(plan.buy_now_steps) ? plan.buy_now_steps : [],
  };
}

async function getJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function postJson(url, payload = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `HTTP ${r.status} ${url}`);
  return data;
}

function renderLive(live) {
  const cards = document.getElementById("symbolCards");
  cards.innerHTML = "";
  const symbols = live.symbols || {};

  for (const sym of ["BTCUSDT", "ETHUSDT", "XRPUSDT"]) {
    const it = symbols[sym] || {};
    const el = document.createElement("article");
    el.className = "card";
    const stage = it.stage || "WAIT";

    el.innerHTML = `
      <h3>${sym}</h3>
      <span class="stage ${stageClass(stage)}">${stage}</span>
      <div class="kv">
        <span>Preço: <strong>${fmtNum(it.price, sym === "XRPUSDT" ? 4 : 2)}</strong></span>
        <span>Regime: <strong>${it.regime_1w || "-"} | ${it.regime_4h || "-"}</strong></span>
        <span>Volume: <strong>${fmtNum(it.vol1_ratio)}x / ${fmtNum(it.vol4_ratio)}x</strong></span>
        <span>Risco/Retorno: <strong>RR ${fmtNum(it.rr_adj)} | RR_ATR ${fmtNum(it.rr_atr)}</strong></span>
      </div>
      <p class="muted">Atualizado: ${fmtTs(it.ts_utc)}</p>
    `;
    cards.appendChild(el);
  }
}

function renderDecisionBoard(live, news, openTradesBySymbol = {}) {
  const target = document.getElementById("decisionBoard");
  target.innerHTML = "";
  const symbols = live.symbols || {};

  for (const sym of ["BTCUSDT", "ETHUSDT", "XRPUSDT"]) {
    const it = symbols[sym] || {};
    const m = actionModel(sym, it, news, openTradesBySymbol);
    const el = document.createElement("article");
    el.className = "decision-card";
    el.innerHTML = `
      <div class="decision-top">
        <span class="asset">${sym}</span>
        <span class="light ${m.light}"></span>
      </div>
      <div class="main-action ${m.intent}">${m.action}</div>
      <p class="decision-note">${m.note} Confiança: <strong>${fmtNum(m.confidence, 0)}%</strong></p>
      <div class="decision-alert ${(m.invalidated || m.guardrailsBlocked) ? "danger" : "neutral"}">
        ${
          m.invalidated
            ? "Plano invalidado: preço abaixo da invalidação. Evitar novas entradas."
            : m.guardrailsBlocked
              ? "Guardrails de risco bloquearam entrada nesta leitura."
              : "Alocação sugerida: " + fmtNum(m.allocPct, 1) + "% | Risco operacional: " + (Number.isNaN(m.riskOperationalPct) ? "-" : fmtNum(m.riskOperationalPct, 2) + "%") + " | Risco estrutural: " + (Number.isNaN(m.riskStructuralPct) ? "-" : fmtNum(m.riskStructuralPct, 2) + "%")
        }
      </div>
      <div class="kv">
        <span>Data Quality: <strong>${Number.isNaN(m.dataQualityScore) ? "-" : `${fmtNum(m.dataQualityScore, 0)}/${fmtNum(m.dataQualityThreshold, 0)}`}</strong></span>
        <span>Risco/trade: <strong>${Number.isNaN(m.riskTradePct) ? "-" : `${fmtNum(m.riskTradePct, 2)}%`} / ${Number.isNaN(m.riskTradeLimitPct) ? "-" : `${fmtNum(m.riskTradeLimitPct, 2)}%`}</strong></span>
        <span>Risco carteira proj.: <strong>${Number.isNaN(m.riskPortPct) ? "-" : `${fmtNum(m.riskPortPct, 2)}%`} / ${Number.isNaN(m.riskPortLimitPct) ? "-" : `${fmtNum(m.riskPortLimitPct, 2)}%`}</strong></span>
      </div>
      <div class="kv">
        <span>Entrada: <strong>${fmtNum(m.entry, sym === "XRPUSDT" ? 4 : 2)}</strong></span>
        <span>Stop operacional: <strong>${fmtNum(m.stopOperational, sym === "XRPUSDT" ? 4 : 2)}</strong></span>
        <span>Invalidação estrutural: <strong>${fmtNum(m.stopStructural, sym === "XRPUSDT" ? 4 : 2)}</strong></span>
        <span>Alvo 1: <strong>${fmtNum(m.target1, sym === "XRPUSDT" ? 4 : 2)}</strong></span>
        <span>Alvo 2: <strong>${fmtNum(m.target2, sym === "XRPUSDT" ? 4 : 2)}</strong></span>
      </div>
      <ul class="decision-list">
        ${m.checks
          .map((x) => {
            const dot = x.state === "ok" ? "ok" : x.state === "na" ? "na" : "bad";
            const txt = x.text || (x.state === "ok" ? "ok" : x.state === "na" ? "n/a" : "falhou");
            return `<li><span class="check-dot ${dot}"></span>${x.label}: ${txt}</li>`;
          })
          .join("")}
      </ul>
      <div class="bottleneck-box">
        <div class="bottleneck-title">Gargalo dominante</div>
        <div><strong>${(m.bottleneck && m.bottleneck.label) || "Sem gargalo dominante"}</strong></div>
        <div class="muted">${(m.bottleneck && m.bottleneck.detail) || "Condições principais estão aceitáveis."}</div>
      </div>
      <div class="decision-next">
        <div class="bottleneck-title">${
          m.action === "COMPRAR"
            ? "Para aumentar convicção agora"
            : m.action === "MANTER POSIÇÃO"
              ? "Para proteger e otimizar posição"
              : "Para virar COMPRA agora"
        }</div>
        <ul class="decision-list">
          ${(m.buyNowSteps || []).map((s) => `<li>${s}</li>`).join("")}
        </ul>
      </div>
      <p class="decision-note"><strong>Cenário base:</strong> ${m.base}</p>
      <p class="decision-note"><strong>Cenário alternativo:</strong> ${m.alt}</p>
    `;
    target.appendChild(el);
  }
}

function renderPortfolioRiskNow(live) {
  const target = document.getElementById("portfolioRiskNow");
  const symbols = (live && live.symbols) || {};
  let totalAlloc = 0;
  let weightedRisk = 0;
  let actives = 0;

  for (const sym of ["BTCUSDT", "ETHUSDT", "XRPUSDT"]) {
    const it = symbols[sym] || {};
    const plan = it.trade_plan || {};
    const alloc = Number(plan.suggested_alloc_pct || 0);
    const risk = Number(plan.risk_pct ?? NaN);
    totalAlloc += alloc;
    if (!Number.isNaN(risk) && alloc > 0) {
      weightedRisk += alloc * risk;
    }
    if (alloc > 0) actives += 1;
  }

  const avgRisk = totalAlloc > 0 ? weightedRisk / totalAlloc : 0;
  target.innerHTML = `
    <div class="stat-row"><span>Exposição sugerida</span><strong>${fmtNum(totalAlloc, 1)}%</strong></div>
    <div class="stat-row"><span>Risco médio estimado</span><strong>${fmtNum(avgRisk, 2)}%</strong></div>
    <div class="stat-row"><span>Ativos com posição</span><strong>${actives}/3</strong></div>
  `;
}

function renderChanges(live) {
  const list = document.getElementById("changesList");
  const symbols = (live && live.symbols) || {};
  const lines = [];

  if (!previousLiveSymbols) {
    lines.push("Primeira leitura da sessão.");
  } else {
    for (const sym of ["BTCUSDT", "ETHUSDT", "XRPUSDT"]) {
      const prev = previousLiveSymbols[sym] || {};
      const curr = symbols[sym] || {};
      const prevStage = prev.stage || "-";
      const currStage = curr.stage || "-";
      if (prevStage !== currStage) {
        lines.push(`${sym}: stage mudou de ${prevStage} para ${currStage}.`);
      }

      const prevConf = Number((prev.trade_plan && prev.trade_plan.confidence) ?? NaN);
      const currConf = Number((curr.trade_plan && curr.trade_plan.confidence) ?? NaN);
      if (!Number.isNaN(prevConf) && !Number.isNaN(currConf) && Math.abs(currConf - prevConf) >= 10) {
        lines.push(`${sym}: confiança ${fmtNum(prevConf, 0)}% → ${fmtNum(currConf, 0)}%.`);
      }

      const prevInv = Boolean(prev.trade_plan && prev.trade_plan.invalidated);
      const currInv = Boolean(curr.trade_plan && curr.trade_plan.invalidated);
      if (prevInv !== currInv) {
        lines.push(`${sym}: invalidação ${currInv ? "ATIVADA" : "LIBERADA"}.`);
      }
    }
  }

  list.innerHTML = "";
  if (!lines.length) {
    list.innerHTML = `<li class="muted">Sem mudanças relevantes desde a última atualização.</li>`;
  } else {
    for (const x of lines.slice(0, 8)) {
      const li = document.createElement("li");
      li.textContent = x;
      list.appendChild(li);
    }
  }

  previousLiveSymbols = JSON.parse(JSON.stringify(symbols));
}

function renderPortfolio(summary) {
  const target = document.getElementById("portfolioStats");
  const p = (summary && summary.portfolio) || {};
  target.innerHTML = `
    <div class="stat-row"><span>Trades</span><strong>${p.trades ?? 0}</strong></div>
    <div class="stat-row"><span>Win Rate</span><strong>${fmtPct(p.win_rate)}</strong></div>
    <div class="stat-row"><span>Avg Net</span><strong>${fmtPct(p.avg_net_return)}</strong></div>
    <div class="stat-row"><span>Cum Net</span><strong>${fmtPct(p.cum_net_return)}</strong></div>
    <div class="stat-row"><span>Profit Factor</span><strong>${fmtNum(p.profit_factor)}</strong></div>
    <div class="stat-row"><span>Avg Hold</span><strong>${fmtNum(p.avg_hold_hours)}h</strong></div>
  `;
}

function renderSweep(sweep) {
  const target = document.getElementById("sweepTop");
  const rows = (sweep && sweep.results) || [];
  if (!rows.length) {
    target.innerHTML = `<p class="muted">Sem dados de sweep.</p>`;
    return;
  }

  const top = rows.slice(0, 3);
  target.innerHTML = top
    .map((row, idx) => {
      const p = row.portfolio || {};
      return `
        <div class="stat-row"><span>#${idx + 1} ${row.scenario} @ ${row.max_hold_hours}h</span><strong>${fmtPct(p.cum_net_return)}</strong></div>
      `;
    })
    .join("");
}

function renderGlobalNews(news) {
  const snapshot = document.getElementById("macroSnapshot");
  const notesEl = document.getElementById("macroNotes");
  const headlinesEl = document.getElementById("globalHeadlines");
  const topRisksEl = document.getElementById("topRisks");
  const watchlistEl = document.getElementById("macroWatchlist");
  const categoriesEl = document.getElementById("newsCategories");
  const executiveEl = document.getElementById("executiveBrief");
  const econBoardEl = document.getElementById("econBoard");

  const macro = (news && news.macro) || {};
  const notes = (news && news.notes) || [];
  const headlines = (news && news.headlines) || [];
  const topRisks = (news && news.top_risks) || [];
  const categories = (news && news.categories) || {};
  const watchlist = (news && news.watchlist) || [];
  const executiveSummary = (news && news.executive_summary) || [];
  const econPanel = (news && news.economic_panel) || [];

  snapshot.innerHTML = `
    <div class="stat-row"><span>Status</span><strong>${news.status || "-"}</strong></div>
    <div class="stat-row"><span>Badge</span><strong>${macro.badge || "-"}</strong></div>
    <div class="stat-row"><span>Postura</span><strong>${macro.posture || "-"}</strong></div>
    <div class="stat-row"><span>Macro Score</span><strong>${macro.macro_score ?? "-"}</strong></div>
    <div class="stat-row"><span>Atualizado</span><strong>${fmtTs(macro.updated_ts)}</strong></div>
  `;

  notesEl.innerHTML = "";
  if (!notes.length) {
    notesEl.innerHTML = `<li class="muted">Sem notas macro.</li>`;
  } else {
    for (const n of notes) {
      const li = document.createElement("li");
      li.textContent = n;
      notesEl.appendChild(li);
    }
  }

  watchlistEl.innerHTML = "";
  if (!watchlist.length) {
    watchlistEl.innerHTML = `<li class="muted">Sem alertas táticos para hoje.</li>`;
  } else {
    for (const w of watchlist) {
      const li = document.createElement("li");
      li.textContent = w;
      watchlistEl.appendChild(li);
    }
  }

  executiveEl.innerHTML = "";
  if (!executiveSummary.length) {
    executiveEl.innerHTML = `<li class="muted">Sem resumo executivo disponível.</li>`;
  } else {
    for (const line of executiveSummary) {
      const li = document.createElement("li");
      li.textContent = line;
      executiveEl.appendChild(li);
    }
  }

  econBoardEl.innerHTML = "";
  if (!econPanel.length) {
    econBoardEl.innerHTML = `<p class="muted">Sem dados econômicos disponíveis.</p>`;
  } else {
    for (const item of econPanel) {
      const card = document.createElement("article");
      const signal = String(item.signal || "neutral");
      card.className = `econ-card signal-${signal}`;
      const available = Boolean(item && item.available);
      const value = available
        ? `${fmtNum(item.value, (item.unit === "%" || item.unit === "pp") ? 2 : 2)}${item.unit || ""}`
        : "n/a";
      const delta = Number(item.delta ?? NaN);
      const deltaPct = Number(item.delta_pct ?? NaN);
      const hasDelta = !Number.isNaN(delta);
      const deltaClass = !hasDelta ? "muted" : delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-flat";
      const deltaArrow = !hasDelta ? "" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
      const deltaText = !hasDelta
        ? "Primeira leitura (base salva para comparar no próximo refresh)."
        : `${deltaArrow} ${fmtNum(delta, 2)}${item.unit || ""}${Number.isNaN(deltaPct) ? "" : ` (${fmtNum(deltaPct, 2)}%)`}`;
      const noteText = String(item.note || "-");
      const impactRaw = String(item.impact_crypto || "").trim();
      const impactText = impactRaw && impactRaw !== noteText ? impactRaw : "";
      card.innerHTML = `
        <div class="econ-top">
          <span class="econ-name">${item.name || "-"}</span>
          <span class="econ-source">${item.source || "-"}</span>
        </div>
        <div class="econ-value ${available ? "" : "muted"}">${value}</div>
        <div class="econ-delta ${deltaClass}">${deltaText}</div>
        <div class="econ-note">${noteText}</div>
        ${impactText ? `<div class="econ-impact">${impactText}</div>` : ""}
      `;
      econBoardEl.appendChild(card);
    }
  }

  topRisksEl.innerHTML = "";
  if (!topRisks.length) {
    topRisksEl.innerHTML = `<li class="muted">Sem riscos destacados.</li>`;
  } else {
    for (const r of topRisks) {
      const li = document.createElement("li");
      li.className = "risk-item";
      const direction = String(r.direction || "neutro");
      li.innerHTML = `
        <div><strong>${r.title || "-"}</strong></div>
        <div class="risk-meta">
          <span class="impact ${r.impact || "baixo"}">${r.impact || "baixo"}</span>
          <span class="tag category">${r.category || "Mercado Global"}</span>
          <span class="tag score">Crypto Score ${r.crypto_relevance ?? "-"}</span>
          <span class="tag direction-${direction}">${direction}</span>
        </div>
      `;
      topRisksEl.appendChild(li);
    }
  }

  categoriesEl.innerHTML = "";
  const catKeys = Object.keys(categories);
  if (!catKeys.length) {
    categoriesEl.innerHTML = `<p class="muted">Sem categorias disponíveis.</p>`;
  } else {
    for (const cat of catKeys) {
      const card = document.createElement("article");
      card.className = "category-card";
      const items = Array.isArray(categories[cat]) ? categories[cat] : [];
      card.innerHTML = `
        <h3>${cat}</h3>
        <ul>
          ${items
            .slice(0, 4)
            .map((it) => `<li>${it.title || "-"} <span class="muted">(${it.impact || "baixo"})</span></li>`)
            .join("")}
        </ul>
      `;
      categoriesEl.appendChild(card);
    }
  }

  headlinesEl.innerHTML = "";
  if (!headlines.length) {
    headlinesEl.innerHTML = `<li class="muted">Sem headlines disponíveis.</li>`;
  } else {
    for (const h of headlines) {
      const li = document.createElement("li");
      const impact = String(h.impact || "baixo");
      const direction = String(h.direction || "neutro");
      li.className = "risk-item";
      li.innerHTML = `
        <div><strong>${h.title || "-"}</strong></div>
        <div class="risk-meta">
          <span class="impact ${impact}">${impact}</span>
          <span class="tag category">${h.category || "Mercado Global"}</span>
          <span class="tag score">Crypto Score ${h.crypto_relevance ?? "-"}</span>
          <span class="tag direction-${direction}">${direction}</span>
        </div>
      `;
      headlinesEl.appendChild(li);
    }
  }
}

function renderTrades(symbol, data) {
  const body = document.getElementById("tradesBody");
  const rows = (data && data.trades) || [];
  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11" class="muted">Sem trades para ${symbol || "ALL"}.</td></tr>`;
    return;
  }

  for (const t of [...rows].reverse()) {
    const status = String(t.status || "-").toUpperCase();
    const prevPct = Number(t.expected_profit_pct ?? NaN);
    const realPct = Number(t.realized_profit_pct ?? NaN);
    const unrPct = Number(t.unrealized_profit_pct ?? NaN);
    const shownPct = Number.isNaN(realPct) ? unrPct : realPct;
    const prevCls = Number.isNaN(prevPct) ? "" : prevPct >= 0 ? "positive" : "negative";
    const realCls = Number.isNaN(shownPct) ? "" : shownPct >= 0 ? "positive" : "negative";
    const pxDigits = (t.symbol || "").startsWith("XRP") ? 4 : 2;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtTs(t.entry_ts)}</td>
      <td>${fmtTs(t.exit_ts)}</td>
      <td>${t.symbol || "-"}</td>
      <td class="${status === "OPEN" ? "positive" : "muted"}">${status}</td>
      <td>${fmtNum(t.entry_price, pxDigits)}</td>
      <td>${fmtNum(t.exit_price ?? t.current_price, pxDigits)}</td>
      <td>${fmtNum(t.target_price, pxDigits)}</td>
      <td class="${prevCls}">${Number.isNaN(prevPct) ? "-" : `${prevPct.toFixed(2)}%`}</td>
      <td class="${realCls}">${Number.isNaN(shownPct) ? "-" : `${shownPct.toFixed(2)}%`}</td>
      <td>${fmtNum(t.hold_hours, 2)}h</td>
      <td>${t.last_signal || "-"}</td>
    `;
    body.appendChild(tr);
  }
}

async function refreshAll() {
  try {
    const [live, summary, sweep, news, tradesAll] = await Promise.all([
      getJson(`${API_BASE}/live`),
      getJson(`${API_BASE}/backtest-summary`),
      getJson(`${API_BASE}/backtest-sweep`),
      getJson(`${API_BASE}/global-news`),
      getJson(`${API_BASE}/recent-trades?symbol=&limit=200`),
    ]);
    const openTradesBySymbol = {};
    for (const t of (tradesAll && tradesAll.trades) || []) {
      if (String(t.status || "").toUpperCase() === "OPEN" && t.symbol) {
        openTradesBySymbol[String(t.symbol).toUpperCase()] = true;
      }
    }

    renderLive(live);
    renderDecisionBoard(live, news, openTradesBySymbol);
    renderPortfolioRiskNow(live);
    renderChanges(live);
    renderPortfolio(summary);
    renderSweep(sweep);
    renderGlobalNews(news);

    const symbol = document.getElementById("symbolSelect").value;
    const trades = await getJson(`${API_BASE}/recent-trades?symbol=${encodeURIComponent(symbol)}&limit=50`);
    renderTrades(symbol, trades);

    document.getElementById("lastUpdate").textContent = `Atualizado: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error(err);
    document.getElementById("lastUpdate").textContent = `Erro ao atualizar: ${err.message}`;
  }
}

async function refreshTradesOnly() {
  const symbol = document.getElementById("symbolSelect").value;
  const trades = await getJson(`${API_BASE}/recent-trades?symbol=${encodeURIComponent(symbol)}&limit=50`);
  renderTrades(symbol, trades);
}

async function runRobotRefresh(trigger = "manual") {
  if (refreshInProgress) return;
  refreshInProgress = true;
  const btn = document.getElementById("refreshBtn");
  if (trigger === "manual") {
    btn.disabled = true;
    btn.textContent = "Atualizando...";
    document.getElementById("lastUpdate").textContent = "Rodando robô...";
  } else {
    document.getElementById("lastUpdate").textContent = "Auto refresh: rodando robô...";
  }

  try {
    await postJson(`${API_BASE}/refresh-run`);
  } catch (err) {
    document.getElementById("lastUpdate").textContent = `Não iniciou refresh: ${err.message}`;
    if (trigger === "manual") {
      btn.disabled = false;
      btn.textContent = "Atualizar";
    }
    refreshInProgress = false;
    return;
  }

  let tries = 0;
  const maxTries = 150;
  const pollMs = 2000;

  const timer = setInterval(async () => {
    tries += 1;
    try {
      const st = await getJson(`${API_BASE}/refresh-status`);
      const s = st.status || {};
      if (s.running) {
        document.getElementById("lastUpdate").textContent = "Atualizando dados do robô...";
      } else {
        clearInterval(timer);
        if (s.exit_code === 0) {
          await refreshAll();
          document.getElementById("lastUpdate").textContent =
            trigger === "manual" ? "Atualização concluída." : "Auto refresh concluído.";
        } else {
          document.getElementById("lastUpdate").textContent = `Falha no refresh: ${s.message || "erro"}`;
        }
        if (trigger === "manual") {
          btn.disabled = false;
          btn.textContent = "Atualizar";
        }
        refreshInProgress = false;
      }
    } catch (err) {
      clearInterval(timer);
      document.getElementById("lastUpdate").textContent = `Erro status refresh: ${err.message}`;
      if (trigger === "manual") {
        btn.disabled = false;
        btn.textContent = "Atualizar";
      }
      refreshInProgress = false;
    }

    if (tries >= maxTries) {
      clearInterval(timer);
      document.getElementById("lastUpdate").textContent = "Timeout aguardando refresh.";
      if (trigger === "manual") {
        btn.disabled = false;
        btn.textContent = "Atualizar";
      }
      refreshInProgress = false;
    }
  }, pollMs);
}

window.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  for (const btn of tabButtons) {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      for (const b of tabButtons) b.classList.remove("active");
      for (const c of tabContents) c.classList.remove("active");
      btn.classList.add("active");
      const tab = document.getElementById(tabId);
      if (tab) tab.classList.add("active");
    });
  }

  document.getElementById("refreshBtn").addEventListener("click", () => runRobotRefresh("manual"));
  document.getElementById("symbolSelect").addEventListener("change", refreshTradesOnly);
  refreshAll();
  setInterval(refreshAll, 30000);
});
