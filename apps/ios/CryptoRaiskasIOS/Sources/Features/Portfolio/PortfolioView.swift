import Charts
import SwiftUI

@MainActor
final class PortfolioViewModel: ObservableObject {
  @Published var loading = false
  @Published var generatingHistory = false
  @Published var error: String?
  @Published var warning: String?
  @Published var summary = WalletSummary(nome: "Carteira Principal", patrimonioTotal: 0, aporteTotal: 0, resultadoTotal: 0, resultadoPercentual: 0)
  @Published var history: [WalletSnapshotPoint] = []
  @Published var updatedAt: Date?
  @Published var walletConfig: WalletConfigRow?
  @Published var aportes: [WalletAporteRow] = []
  @Published var operations: [OperationRow] = []
  @Published var prices: [String: Double] = [:]

  private let service = SupabaseService.shared

  func refresh(months: Int = 12) async {
    loading = true
    defer { loading = false }

    do {
      let payload = try await service.fetchWalletSummaryAndHistory(months: months)
      let configAndAportes = try await service.fetchWalletConfigAndAportes()
      let ops = try await service.fetchOperations(limit: 10_000)

      var tickers: [MarketTicker] = []
      var marketWarning: String?
      let ids = Array(Set(ops.map { $0.moedaId.lowercased() }))
      if !ids.isEmpty {
        do {
          tickers = try await service.fetchMarketTickers(ids: ids)
        } catch {
          marketWarning = "Falha ao buscar dados de mercado. Exibindo carteira com dados locais."
        }
      }

      summary = payload.0
      history = payload.1
      walletConfig = configAndAportes.0
      aportes = configAndAportes.1
      operations = ops

      var merged = prices
      for t in tickers { merged[t.id.lowercased()] = t.price }
      if merged.isEmpty {
        // Fallback para último preço operacional por moeda quando o mercado estiver indisponível.
        for op in ops.sorted(by: { $0.dataOperacao > $1.dataOperacao }) {
          let key = op.moedaId.lowercased()
          if merged[key] == nil, op.precoUnitario > 0 {
            merged[key] = op.precoUnitario
          }
        }
      }
      prices = merged

      updatedAt = Date()
      error = nil
      warning = marketWarning
    } catch {
      self.error = error.localizedDescription
    }
  }

  func refreshHistoryOnly() async {
    generatingHistory = true
    defer { generatingHistory = false }
    await refresh(months: 12)
  }

  func saveWallet(nome: String, valorInicial: Double) async throws {
    try await service.upsertWallet(nome: nome, valorInicial: valorInicial)
    await refresh(months: 12)
  }

  func saveAporte(id: UUID?, carteiraId: UUID, valor: Double, data: Date, descricao: String?) async throws {
    try await service.saveAporte(id: id, carteiraId: carteiraId, valor: valor, dataAporte: data, descricao: descricao)
    await refresh(months: 12)
  }

  func deleteAporte(id: UUID) async throws {
    try await service.deleteAporte(id: id)
    await refresh(months: 12)
  }

  var updatedAtText: String {
    guard let updatedAt else { return "-" }
    return updatedAt.formatted(date: .numeric, time: .shortened)
  }

  var exposureCount: Int { assetStats.filter { $0.marketValue > 0.0001 }.count }
  var gainersCount: Int { assetStats.filter { $0.unrealized > 0 }.count }
  var losersCount: Int { assetStats.filter { $0.unrealized < 0 }.count }

  var marketValue: Double { assetStats.reduce(0.0) { $0 + $1.marketValue } }
  var unrealizedTotal: Double { assetStats.reduce(0.0) { $0 + $1.unrealized } }

  var currentCash: Double {
    var cash = walletConfig?.valorInicial ?? summary.aporteTotal
    for aporte in aportes { cash += aporte.valor }
    for op in operations {
      if op.tipo.lowercased() == "compra" {
        cash -= (op.valorTotal + op.taxa)
      } else {
        cash += (op.valorTotal - op.taxa)
      }
    }
    return cash
  }

  var patrimonioTotal: Double { currentCash + marketValue }
  var resultadoTotal: Double { patrimonioTotal - summary.aporteTotal }
  var resultadoPct: Double { summary.aporteTotal > 0 ? (resultadoTotal / summary.aporteTotal) * 100 : 0 }

  private var assetStats: [(marketValue: Double, unrealized: Double)] {
    struct Lot { var qty: Double; let costUnit: Double }
    let sorted = operations.sorted { $0.dataOperacao < $1.dataOperacao }
    var lotsByCoin: [String: [Lot]] = [:]

    for op in sorted {
      let coin = op.moedaId.lowercased()
      var lots = lotsByCoin[coin] ?? []
      if op.tipo.lowercased() == "compra" {
        let qty = max(0, op.quantidade)
        let totalCost = op.valorTotal + op.taxa
        let unit = qty > 0 ? totalCost / qty : 0
        lots.append(Lot(qty: qty, costUnit: unit))
      } else {
        var qtyToSell = max(0, op.quantidade)
        while qtyToSell > 0, !lots.isEmpty {
          var first = lots[0]
          let consumed = min(first.qty, qtyToSell)
          first.qty -= consumed
          qtyToSell -= consumed
          if first.qty <= 1e-9 { lots.removeFirst() } else { lots[0] = first }
        }
      }
      lotsByCoin[coin] = lots
    }

    let opFallback = latestOperationPriceByCoin
    return lotsByCoin.map { coin, lots in
      let px = prices[coin] ?? opFallback[coin] ?? 0
      let market = lots.reduce(0.0) { $0 + ($1.qty * px) }
      let cost = lots.reduce(0.0) { $0 + ($1.qty * $1.costUnit) }
      return (market, market - cost)
    }
  }

  private var latestOperationPriceByCoin: [String: Double] {
    var out: [String: Double] = [:]
    for op in operations.sorted(by: { $0.dataOperacao > $1.dataOperacao }) {
      let key = op.moedaId.lowercased()
      if out[key] == nil, op.precoUnitario > 0 { out[key] = op.precoUnitario }
    }
    return out
  }
}

struct PortfolioView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  enum RangePreset: String, CaseIterable, Identifiable {
    case oneMonth = "1M"
    case threeMonths = "3M"
    case sixMonths = "6M"
    case twelveMonths = "12M"
    case all = "Tudo"

    var id: String { rawValue }
    var months: Int {
      switch self {
      case .oneMonth: return 1
      case .threeMonths: return 3
      case .sixMonths: return 6
      case .twelveMonths: return 12
      case .all: return 120
      }
    }
  }

  enum CompactChartPanel: String, CaseIterable, Identifiable {
    case patrimonio = "Carteira/Aporte"
    case resultado = "Resultado"

    var id: String { rawValue }
  }

  @StateObject private var vm = PortfolioViewModel()
  @State private var selectedRange: RangePreset = .all
  @State private var showCarteira = true
  @State private var showAporte = true
  @State private var showResultado = true
  @State private var compactChartPanel: CompactChartPanel = .patrimonio
  @State private var selectedChartPoint: WalletSnapshotPoint?
  @State private var showAdminSheet = false

  var body: some View {
    ZStack(alignment: .topLeading) {
      AppTheme.pageBackground.ignoresSafeArea()
      ScrollView {
        VStack(alignment: .leading, spacing: AppLayout.pageSpacing) {
          header

          if let error = vm.error { statusCard(title: "Erro", message: error, color: .red) }
          else if let warning = vm.warning { statusCard(title: "Aviso de mercado", message: warning, color: .yellow) }

          summarySection
          evolutionSection
          exposureSection
        }
        .padding(.horizontal, horizontalSizeClass == .compact ? AppLayout.pageHorizontalCompact : AppLayout.pageHorizontalRegular)
        .padding(.top, AppLayout.pageSpacing)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .tabBarSafeAreaInset()
    .task {
      if vm.history.isEmpty { await vm.refresh(months: 12) }
    }
    .sheet(isPresented: $showAdminSheet) {
      PortfolioAdminSheet(vm: vm)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
  }

  private var header: some View {
    PageHeaderView(
      title: "Acompanhamento de Carteira",
      subtitle: "Visão consolidada de posição, P/L e histórico operacional.\nAtualizado em \(vm.updatedAtText)"
    ) {
      if horizontalSizeClass == .compact {
        VStack(alignment: .leading, spacing: 8) {
          Button("Administrar Carteira") { showAdminSheet = true }
            .buttonStyle(.bordered)
          Button(vm.loading ? "Atualizando..." : "Atualizar") { Task { await vm.refresh(months: 12) } }
            .buttonStyle(.borderedProminent)
            .disabled(vm.loading)
        }
      } else {
        HStack(spacing: 8) {
          Button("Administrar Carteira") { showAdminSheet = true }
            .buttonStyle(.bordered)
          Button(vm.loading ? "Atualizando..." : "Atualizar") { Task { await vm.refresh(months: 12) } }
            .buttonStyle(.borderedProminent)
            .disabled(vm.loading)
        }
      }
    }
  }

  private var summarySection: some View {
    let patrimonio = vm.patrimonioTotal
    let result = vm.resultadoTotal

    return VStack(spacing: 10) {
      metricCard("Valor de Mercado", AppFormatters.currency(vm.marketValue), "Valor atual estimado da carteira", .white)
      metricCard("Caixa Atual", AppFormatters.currency(vm.currentCash), "Valor em caixa após compras e vendas", .white)
      metricCard("Não Realizado", AppFormatters.currency(vm.unrealizedTotal), "Resultado potencial com posição aberta", vm.unrealizedTotal >= 0 ? .green : .red)
      metricCard(
        "Patrimônio Total",
        AppFormatters.currency(patrimonio),
        "Resultado: \(AppFormatters.currency(result)) (\(String(format: "%.2f", vm.resultadoPct))%)",
        result >= 0 ? .green : .red
      )
    }
  }

  private var evolutionSection: some View {
    let points = filteredPoints

    return AppCard {
      VStack(alignment: .leading, spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text("Evolução da Carteira")
            .font(.title3.bold())
            .foregroundStyle(AppTheme.strongText)
          Text("Padrão investimento: comparação entre valor da carteira e aportes líquidos no período.")
            .font(.subheadline)
            .foregroundStyle(AppTheme.subtleText)
        }

        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 8) {
            ForEach(RangePreset.allCases) { item in
              if selectedRange == item {
                Button(item.rawValue) { selectedRange = item }.buttonStyle(.borderedProminent)
              } else {
                Button(item.rawValue) { selectedRange = item }.buttonStyle(.bordered)
              }
            }
            Button(vm.generatingHistory ? "Gerando histórico..." : "Atualizar Histórico") {
              Task { await vm.refreshHistoryOnly() }
            }
            .buttonStyle(.bordered)
            .disabled(vm.generatingHistory || vm.loading)
          }
        }

        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 8) {
            toggleButton("Carteira", isOn: showCarteira) { showCarteira.toggle() }
            toggleButton("Aporte", isOn: showAporte) { showAporte.toggle() }
            toggleButton("Resultado", isOn: showResultado) { showResultado.toggle() }
          }
        }

        if points.isEmpty {
          Text("Sem dados suficientes para desenhar o gráfico.")
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)
        } else {
          let m = chartMetrics(points)
          let latest = points.last

          if horizontalSizeClass == .compact {
            VStack(spacing: 8) {
              statInfoCard(label: "Variação no período", value: "\(AppFormatters.currency(m.delta)) (\(String(format: "%.2f", m.deltaPct))%)", color: m.delta >= 0 ? .green : .red)
              statInfoCard(label: "Máximo Drawdown", value: "\(String(format: "%.2f", m.maxDrawdownPct))%", color: .red)
              statInfoCard(label: "Janela", value: "\(m.firstLabel) até \(m.lastLabel)", color: .white)
            }
          } else {
            HStack(spacing: 10) {
              statInfoCard(label: "Variação no período", value: "\(AppFormatters.currency(m.delta)) (\(String(format: "%.2f", m.deltaPct))%)", color: m.delta >= 0 ? .green : .red)
              statInfoCard(label: "Máximo Drawdown", value: "\(String(format: "%.2f", m.maxDrawdownPct))%", color: .red)
              statInfoCard(label: "Janela", value: "\(m.firstLabel) até \(m.lastLabel)", color: .white)
            }
          }

          if let latest {
            if horizontalSizeClass == .compact {
              VStack(spacing: 8) {
                if showAporte {
                  statInfoCard(label: "Aporte Líquido (Atual)", value: AppFormatters.currency(latest.aporte), color: .orange)
                }
                if showCarteira {
                  statInfoCard(label: "Valor da Carteira (Atual)", value: AppFormatters.currency(latest.carteira), color: AppTheme.primaryAccent)
                }
                if showResultado {
                  statInfoCard(label: "Resultado (Atual)", value: AppFormatters.currency(latest.resultado), color: latest.resultado >= 0 ? .green : .red)
                }
              }
            } else {
              HStack(spacing: 10) {
                if showAporte {
                  statInfoCard(label: "Aporte Líquido (Atual)", value: AppFormatters.currency(latest.aporte), color: .orange)
                }
                if showCarteira {
                  statInfoCard(label: "Valor da Carteira (Atual)", value: AppFormatters.currency(latest.carteira), color: AppTheme.primaryAccent)
                }
                if showResultado {
                  statInfoCard(label: "Resultado (Atual)", value: AppFormatters.currency(latest.resultado), color: latest.resultado >= 0 ? .green : .red)
                }
              }
            }
          }

          if horizontalSizeClass == .compact {
            Picker("Painel", selection: $compactChartPanel) {
              ForEach(CompactChartPanel.allCases) { panel in
                Text(panel.rawValue).tag(panel)
              }
            }
            .pickerStyle(.segmented)

            if compactChartPanel == .patrimonio {
              if showCarteira || showAporte {
                patrimonioChart(points)
                  .frame(height: 300)
              } else {
                Text("Ative Carteira ou Aporte para visualizar este gráfico.")
                  .font(.caption)
                  .foregroundStyle(AppTheme.subtleText)
              }
            } else {
              if showResultado {
                resultadoChart(points)
                  .frame(height: 260)
              } else {
                Text("Ative Resultado para visualizar este gráfico.")
                  .font(.caption)
                  .foregroundStyle(AppTheme.subtleText)
              }
            }
          } else {
            if showCarteira || showAporte {
              patrimonioChart(points)
                .frame(height: 270)
            }

            if showResultado {
              resultadoChart(points)
                .frame(height: 180)
            }
          }

          if let selected = selectedChartPoint {
            selectedPointCard(selected)
          }

          HStack(spacing: 10) {
            Text("Início: \(m.firstLabel)")
            Spacer(minLength: 6)
            Text("Fim: \(m.lastLabel)")
            Spacer(minLength: 6)
            Text("Mínimo: \(AppFormatters.currency(m.min))")
            Spacer(minLength: 6)
            Text("Máximo: \(AppFormatters.currency(m.max))")
          }
          .font(.caption)
          .foregroundStyle(AppTheme.subtleText)
        }
      }
    }
  }

  private var exposureSection: some View {
    VStack(spacing: 10) {
      miniStatusCard("Exposição", "\(vm.exposureCount) ativo(s) com posição calculada.", icon: "wallet.pass", color: .white)
      miniStatusCard("Ganho potencial", "Ativos com P/L não realizado positivo: \(vm.gainersCount)", icon: "chart.line.uptrend.xyaxis", color: .green)
      miniStatusCard("Pressão de perda", "Ativos com P/L não realizado negativo: \(vm.losersCount)", icon: "chart.line.downtrend.xyaxis", color: .red)
    }
  }

  private func metricCard(_ title: String, _ value: String, _ subtitle: String, _ color: Color) -> some View {
    AppCard {
      VStack(alignment: .leading, spacing: 8) {
        Text(title).font(.subheadline).foregroundStyle(AppTheme.subtleText)
        Text(value).font(.system(size: horizontalSizeClass == .compact ? 26 : 34, weight: .bold)).foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.7)
        
        Text(subtitle).font(.caption).foregroundStyle(AppTheme.subtleText)
      }
    }
  }

  private func statusCard(title: String, message: String, color: Color) -> some View {
    AppCard {
      VStack(alignment: .leading, spacing: 4) {
        Text(title).font(.headline).foregroundStyle(color)
        Text(message).font(.subheadline).foregroundStyle(AppTheme.subtleText)
      }
    }
  }

  private func toggleButton(_ label: String, isOn: Bool, action: @escaping () -> Void) -> some View {
    Group {
      if isOn { Button(label, action: action).buttonStyle(.borderedProminent) }
      else { Button(label, action: action).buttonStyle(.bordered) }
    }
    .lineLimit(1)
    .minimumScaleFactor(0.85)
  }

  private func statInfoCard(label: String, value: String, color: Color) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(label).font(.caption).foregroundStyle(AppTheme.subtleText)
      Text(value).font(.headline).foregroundStyle(color).lineLimit(2).minimumScaleFactor(0.75)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(AppTheme.cardBackground)
    .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.border, lineWidth: 1))
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private func miniStatusCard(_ title: String, _ body: String, icon: String, color: Color) -> some View {
    AppCard {
      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Image(systemName: icon).foregroundStyle(color)
          Text(title).font(.headline).foregroundStyle(AppTheme.strongText)
        }
        Text(body).font(.subheadline).foregroundStyle(AppTheme.subtleText)
      }
    }
  }

  private func selectedPointCard(_ point: WalletSnapshotPoint) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Data: \(AppFormatters.dateDayMonth.string(from: point.date))")
        .font(.caption.weight(.semibold))
        .foregroundStyle(AppTheme.subtleText)

      HStack {
        Text("Aporte Líquido")
          .font(.headline.weight(.semibold))
          .foregroundStyle(.orange)
        Spacer()
        Text(AppFormatters.currency(point.aporte))
          .font(.headline.weight(.semibold))
          .foregroundStyle(.orange)
      }

      HStack {
        Text("Valor da Carteira")
          .font(.headline.weight(.semibold))
          .foregroundStyle(AppTheme.primaryAccent)
        Spacer()
        Text(AppFormatters.currency(point.carteira))
          .font(.headline.weight(.semibold))
          .foregroundStyle(AppTheme.primaryAccent)
      }

      HStack {
        Text("Resultado")
          .font(.headline.weight(.semibold))
          .foregroundStyle(.white)
        Spacer()
        Text(AppFormatters.currency(point.resultado))
          .font(.headline.weight(.semibold))
          .foregroundStyle(point.resultado >= 0 ? .green : .red)
      }
    }
    .padding(12)
    .background(AppTheme.cardBackground)
    .overlay(
      RoundedRectangle(cornerRadius: 10)
        .stroke(AppTheme.border, lineWidth: 1)
    )
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private func patrimonioChart(_ points: [WalletSnapshotPoint]) -> some View {
    let domain = patrimonioDomain(points)
    return Chart {
      if showCarteira {
        ForEach(points) { point in
          LineMark(
            x: .value("Data", point.date),
            y: .value("Carteira", point.carteira),
            series: .value("Série", "Carteira")
          )
          .foregroundStyle(AppTheme.primaryAccent)
          .lineStyle(.init(lineWidth: 2.6))
          .interpolationMethod(.linear)
        }
      }
      if showAporte {
        ForEach(points) { point in
          LineMark(
            x: .value("Data", point.date),
            y: .value("Aporte", point.aporte),
            series: .value("Série", "Aporte")
          )
          .foregroundStyle(.orange)
          .lineStyle(.init(lineWidth: 2.2))
          .interpolationMethod(.linear)
        }
      }
      if let selected = selectedChartPoint {
        RuleMark(x: .value("Selecionado", selected.date))
          .lineStyle(.init(lineWidth: 1, dash: [4, 4]))
          .foregroundStyle(.white.opacity(0.55))
        if showCarteira {
          PointMark(
            x: .value("Data", selected.date),
            y: .value("Carteira", selected.carteira)
          )
          .foregroundStyle(AppTheme.primaryAccent)
          .symbolSize(36)
        }
        if showAporte {
          PointMark(
            x: .value("Data", selected.date),
            y: .value("Aporte", selected.aporte)
          )
          .foregroundStyle(.orange)
          .symbolSize(30)
        }
      }
    }
    .chartYScale(domain: domain.0 ... domain.1)
    .chartYAxis { AxisMarks(position: .trailing) }
    .chartOverlay { proxy in
      GeometryReader { geo in
        Rectangle()
          .fill(.clear)
          .contentShape(Rectangle())
          .gesture(
            DragGesture(minimumDistance: 0)
              .onChanged { value in
                updateSelectedPoint(at: value.location, proxy: proxy, geometry: geo, points: points)
              }
              .onEnded { _ in
                // Mantém o último ponto selecionado para facilitar leitura no iPhone.
              }
          )
      }
    }
  }

  private func resultadoChart(_ points: [WalletSnapshotPoint]) -> some View {
    let domain = resultadoDomain(points)
    return Chart {
      ForEach(points) { point in
        LineMark(
          x: .value("Data", point.date),
          y: .value("Resultado", point.resultado),
          series: .value("Série", "Resultado")
        )
        .foregroundStyle(.white.opacity(0.9))
        .lineStyle(.init(lineWidth: 1.8))
        .interpolationMethod(.linear)
      }
      if let selected = selectedChartPoint {
        RuleMark(x: .value("Selecionado", selected.date))
          .lineStyle(.init(lineWidth: 1, dash: [4, 4]))
          .foregroundStyle(.white.opacity(0.55))
        PointMark(
          x: .value("Data", selected.date),
          y: .value("Resultado", selected.resultado)
        )
        .foregroundStyle(.white.opacity(0.95))
        .symbolSize(30)
      }
    }
    .chartYScale(domain: domain.0 ... domain.1)
    .chartYAxis { AxisMarks(position: .trailing) }
    .chartOverlay { proxy in
      GeometryReader { geo in
        Rectangle()
          .fill(.clear)
          .contentShape(Rectangle())
          .gesture(
            DragGesture(minimumDistance: 0)
              .onChanged { value in
                updateSelectedPoint(at: value.location, proxy: proxy, geometry: geo, points: points)
              }
          )
      }
    }
  }

  private func updateSelectedPoint(
    at location: CGPoint,
    proxy: ChartProxy,
    geometry: GeometryProxy,
    points: [WalletSnapshotPoint]
  ) {
    guard !points.isEmpty, let plotFrame = proxy.plotFrame else { return }
    let plotOrigin = geometry[plotFrame].origin
    let xInPlot = location.x - plotOrigin.x
    guard let date: Date = proxy.value(atX: xInPlot) else { return }
    selectedChartPoint = nearestPoint(to: date, in: points)
  }

  private func nearestPoint(to date: Date, in points: [WalletSnapshotPoint]) -> WalletSnapshotPoint? {
    points.min(by: { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) })
  }

  private var filteredPoints: [WalletSnapshotPoint] {
    guard !vm.history.isEmpty else { return [] }
    let sortedHistory = vm.history.sorted(by: { $0.date < $1.date })
    if selectedRange == .all { return sortedHistory }
    let cutoff = Calendar.current.date(byAdding: .month, value: -selectedRange.months, to: Date()) ?? .distantPast
    let points = sortedHistory.filter { $0.date >= cutoff }
    return points.isEmpty ? sortedHistory : points
  }

  private func chartMetrics(_ points: [WalletSnapshotPoint]) -> (delta: Double, deltaPct: Double, maxDrawdownPct: Double, firstLabel: String, lastLabel: String, min: Double, max: Double) {
    guard let first = points.first, let last = points.last else {
      return (0, 0, 0, "-", "-", 0, 0)
    }
    let delta = last.carteira - first.carteira
    let deltaPct = first.carteira > 0 ? (delta / first.carteira) * 100 : 0

    var peak = first.carteira
    var maxDrawdown = 0.0
    for point in points {
      peak = max(peak, point.carteira)
      let dd = peak > 0 ? ((point.carteira - peak) / peak) * 100 : 0
      maxDrawdown = min(maxDrawdown, dd)
    }

    let firstLabel = AppFormatters.dateDayMonth.string(from: first.date)
    let lastLabel = AppFormatters.dateDayMonth.string(from: last.date)
    let minValue = points.map(\.carteira).min() ?? 0
    let maxValue = points.map(\.carteira).max() ?? 0

    return (delta, deltaPct, maxDrawdown, firstLabel, lastLabel, minValue, maxValue)
  }

  private func patrimonioDomain(_ points: [WalletSnapshotPoint]) -> (Double, Double) {
    var values: [Double] = []
    if showCarteira { values.append(contentsOf: points.map(\.carteira)) }
    if showAporte { values.append(contentsOf: points.map(\.aporte)) }
    guard let minV = values.min(), let maxV = values.max() else { return (0, 1) }
    if abs(maxV - minV) < 0.0001 {
      let pad = max(1.0, abs(maxV) * 0.08)
      return (minV - pad, maxV + pad)
    }
    let pad = (maxV - minV) * 0.12
    return (minV - pad, maxV + pad)
  }

  private func resultadoDomain(_ points: [WalletSnapshotPoint]) -> (Double, Double) {
    let values = points.map(\.resultado)
    guard let minV = values.min(), let maxV = values.max() else { return (-1, 1) }
    if abs(maxV - minV) < 0.0001 {
      let pad = max(1.0, abs(maxV) * 0.12)
      return (minV - pad, maxV + pad)
    }
    let pad = (maxV - minV) * 0.15
    return (minV - pad, maxV + pad)
  }
}

private struct PortfolioAdminSheet: View {
  @ObservedObject var vm: PortfolioViewModel
  @Environment(\.dismiss) private var dismiss

  @State private var tab: Int = 0
  @State private var nome = "Carteira Principal"
  @State private var valorInicial = "0"

  @State private var aporteEditando: UUID?
  @State private var aporteValor = ""
  @State private var aporteData = Date()
  @State private var aporteDescricao = ""

  @State private var saving = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      VStack(spacing: 12) {
        Picker("", selection: $tab) {
          Text("Dados da Carteira").tag(0)
          Text("Aportes").tag(1)
        }
        .pickerStyle(.segmented)

        if let error {
          Text(error)
            .font(.caption)
            .foregroundStyle(.red)
            .frame(maxWidth: .infinity, alignment: .leading)
        }

        if tab == 0 {
          Form {
            TextField("Nome da carteira", text: $nome)
            TextField("Valor inicial", text: $valorInicial)
            Button(saving ? "Salvando..." : (vm.walletConfig == nil ? "Criar Carteira" : "Atualizar Carteira")) {
              Task { await saveWallet() }
            }
            .disabled(saving)
          }
        } else {
          Form {
            TextField("Valor", text: $aporteValor)
            DatePicker("Data", selection: $aporteData, displayedComponents: .date)
            TextField("Descrição", text: $aporteDescricao)

            HStack {
              Button(saving ? "Salvando..." : (aporteEditando == nil ? "Adicionar Aporte" : "Atualizar Aporte")) {
                Task { await saveAporte() }
              }
              .disabled(saving || vm.walletConfig == nil)

              if aporteEditando != nil {
                Button("Cancelar Edição") { resetAporteForm() }
              }
            }

            ForEach(vm.aportes) { aporte in
              HStack {
                VStack(alignment: .leading) {
                  Text(AppFormatters.dateDayMonth.string(from: aporte.dataAporte))
                  Text(AppFormatters.currency(aporte.valor)).foregroundStyle(.white)
                  if let d = aporte.descricao, !d.isEmpty {
                    Text(d).font(.caption).foregroundStyle(AppTheme.subtleText)
                  }
                }
                Spacer()
                Button("Editar") {
                  aporteEditando = aporte.id
                  aporteValor = AppFormatters.number(aporte.valor)
                  aporteData = aporte.dataAporte
                  aporteDescricao = aporte.descricao ?? ""
                }
                .buttonStyle(.bordered)
                Button("Excluir") {
                  Task {
                    do { try await vm.deleteAporte(id: aporte.id) }
                    catch { self.error = error.localizedDescription }
                  }
                }
                .buttonStyle(.bordered)
                .tint(.red)
              }
            }
          }
        }
      }
      .padding()
      .background(AppTheme.pageBackground)
      .navigationTitle("Administrar Carteira")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Fechar") { dismiss() }
        }
      }
    }
    .onAppear {
      nome = vm.walletConfig?.nome ?? "Carteira Principal"
      valorInicial = AppFormatters.number(vm.walletConfig?.valorInicial ?? 0)
    }
  }

  private func saveWallet() async {
    let inicial = Double(valorInicial.replacingOccurrences(of: ",", with: ".")) ?? 0
    guard inicial >= 0 else {
      error = "Valor inicial inválido."
      return
    }
    saving = true
    defer { saving = false }
    do {
      try await vm.saveWallet(nome: nome, valorInicial: inicial)
      error = nil
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func saveAporte() async {
    guard let carteiraId = vm.walletConfig?.id else {
      error = "Crie a carteira antes de adicionar aportes."
      return
    }
    let valor = Double(aporteValor.replacingOccurrences(of: ",", with: ".")) ?? 0
    guard valor > 0 else {
      error = "Informe um valor de aporte maior que zero."
      return
    }
    saving = true
    defer { saving = false }
    do {
      try await vm.saveAporte(
        id: aporteEditando,
        carteiraId: carteiraId,
        valor: valor,
        data: aporteData,
        descricao: aporteDescricao.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : aporteDescricao
      )
      resetAporteForm()
      error = nil
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func resetAporteForm() {
    aporteEditando = nil
    aporteValor = ""
    aporteData = Date()
    aporteDescricao = ""
  }
}
