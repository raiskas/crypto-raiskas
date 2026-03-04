import Charts
import SwiftUI

extension Notification.Name {
  static let navigateToCrypto = Notification.Name("Raiskas.NavigateToCrypto")
  static let navigateToHome = Notification.Name("Raiskas.NavigateToHome")
  static let navigateToCarteira = Notification.Name("Raiskas.NavigateToCarteira")
  static let navigateToAdminOverview = Notification.Name("Raiskas.NavigateToAdminOverview")
  static let navigateToAdminUsuarios = Notification.Name("Raiskas.NavigateToAdminUsuarios")
  static let navigateToAdminEmpresas = Notification.Name("Raiskas.NavigateToAdminEmpresas")
  static let openCryptoNewOperation = Notification.Name("Raiskas.OpenCryptoNewOperation")
  static let openPortfolioAdmin = Notification.Name("Raiskas.OpenPortfolioAdmin")
  static let openAdminNewUser = Notification.Name("Raiskas.OpenAdminNewUser")
  static let openAdminNewGroup = Notification.Name("Raiskas.OpenAdminNewGroup")
  static let openAdminNewEmpresa = Notification.Name("Raiskas.OpenAdminNewEmpresa")
}

private enum PortfolioChartTheme {
  static let background = Color(red: 0.027, green: 0.043, blue: 0.078) // #070b14
  static let grid = Color(red: 0.122, green: 0.161, blue: 0.216) // #1f2937
  static let axis = Color(red: 0.204, green: 0.271, blue: 0.369) // #334155
  static let tick = Color(red: 0.58, green: 0.639, blue: 0.722) // #94a3b8
  static let carteiraLine = Color(red: 0.231, green: 0.510, blue: 0.965) // #3b82f6
  static let carteiraFill = Color(red: 0.114, green: 0.306, blue: 0.847) // #1d4ed8
  static let aporteLine = Color(red: 0.961, green: 0.620, blue: 0.043) // #f59e0b
  static let resultadoLine = Color(red: 0.886, green: 0.910, blue: 0.941) // #e2e8f0
}

struct PortfolioView: View {
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

  @StateObject private var vm = PortfolioViewModel()
  @State private var selectedRange: RangePreset = .all
  @State private var selectedPoint: WalletSnapshotPoint?
  @State private var selectedX: Double?
  @State private var hoverLocation: CGPoint?
  @State private var showCarteira = true
  @State private var showAporte = true
  @State private var showResultado = true

  private struct ChartPoint: Identifiable {
    let id = UUID()
    let date: Date
    let ts: Double
    let carteira: Double
    let aporte: Double
    let resultado: Double
  }

  private struct IndexedChartPoint: Identifiable {
    let id: UUID
    let x: Double
    let point: ChartPoint
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        header

        if let error = vm.error {
          statusCard(title: "Erro", message: error, color: .red)
        } else if let warning = vm.warning {
          statusCard(title: "Aviso de mercado", message: warning, color: .yellow)
        }

        summarySection
        evolutionSection
        exposureSection
      }
      .padding(20)
      .frame(maxWidth: .infinity, alignment: .topLeading)
    }
    .background(AppTheme.pageBackground)
    .task {
      if vm.history.isEmpty {
        await vm.refresh(months: 12)
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: .openPortfolioAdmin)) { _ in
      openPortfolioAdminWindow()
    }
  }

  private var header: some View {
    HStack(alignment: .top) {
      VStack(alignment: .leading, spacing: 3) {
        Text("Acompanhamento de Carteira")
          .font(.system(size: 28, weight: .semibold))
          .foregroundStyle(AppTheme.strongText)
        Text("Visão consolidada de posição, P/L e histórico operacional.")
          .font(.subheadline)
          .foregroundStyle(AppTheme.subtleText)
        if vm.updatedAt != nil {
          Text("Atualizado em \(vm.updatedAtText)")
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)
        }
      }

      Spacer()

      HStack(spacing: 8) {
        Button("Administrar Carteira") {
          openPortfolioAdminWindow()
        }
        .buttonStyle(.bordered)

        Button {
          NotificationCenter.default.post(name: .navigateToCrypto, object: nil)
        } label: {
          Label("Voltar", systemImage: "arrow.left")
        }
        .buttonStyle(.bordered)

        Button {
          Task { await vm.refresh(months: 12) }
        } label: {
          Label(vm.loading ? "Atualizando..." : "Atualizar", systemImage: "arrow.clockwise")
        }
        .buttonStyle(.borderedProminent)
        .disabled(vm.loading)
      }
    }
  }

  private func openPortfolioAdminWindow() {
    AppWindowPresenter.shared.present(
      id: "portfolio_admin_wallet",
      title: "Administrar Carteira",
      size: CGSize(width: 860, height: 700),
      resizable: true
    ) {
      PortfolioAdminSheet(
        wallet: vm.walletConfig,
        aportes: vm.aportes,
        onSaveWallet: { nome, valorInicial in
          try await vm.saveWallet(nome: nome, valorInicial: valorInicial)
        },
        onSaveAporte: { id, carteiraId, valor, data, descricao in
          try await vm.saveAporte(id: id, carteiraId: carteiraId, valor: valor, data: data, descricao: descricao)
        },
        onDeleteAporte: { id in
          try await vm.deleteAporte(id: id)
        },
        onClose: {
          AppWindowPresenter.shared.dismiss(id: "portfolio_admin_wallet")
        }
      )
    }
  }

  private var summarySection: some View {
    let patrimonio = vm.patrimonioTotal
    let result = vm.resultadoTotal

    return VStack(spacing: 12) {
      HStack(spacing: 12) {
        WalletMetricCard(
          title: "Valor de Mercado",
          value: AppFormatters.currency(vm.marketValue),
          subtitle: "Valor atual estimado da carteira",
          valueColor: .white
        )
        WalletMetricCard(
          title: "Caixa Atual",
          value: AppFormatters.currency(vm.currentCash),
          subtitle: "Valor em caixa após compras e vendas",
          valueColor: .white
        )
        WalletMetricCard(
          title: "Não Realizado",
          value: AppFormatters.currency(vm.unrealizedTotal),
          subtitle: "Resultado potencial com posição aberta",
          valueColor: vm.unrealizedTotal >= 0 ? .green : .red
        )
        WalletMetricCard(
          title: "Patrimônio Total",
          value: AppFormatters.currency(patrimonio),
          subtitle: "Resultado: \(AppFormatters.currency(result)) (\(String(format: "%.2f", vm.resultadoPct))%)",
          valueColor: result >= 0 ? .green : .red
        )
      }
    }
  }

  private var evolutionSection: some View {
    let points = chartPoints
    let indexedPoints: [IndexedChartPoint] = points.enumerated().map { idx, point in
      IndexedChartPoint(id: point.id, x: Double(idx), point: point)
    }
    let topDomain = topChartYDomain(points: points)
    let topTicks = topChartYTicks(domain: topDomain)
    let metrics = chartMetrics(points)

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

        HStack(spacing: 8) {
          ForEach(RangePreset.allCases) { item in
            rangeButton(item)
          }

          Button(vm.generatingHistory ? "Gerando histórico..." : "Atualizar Histórico") {
            Task { await vm.refreshHistoryOnly() }
          }
          .buttonStyle(.bordered)
          .disabled(vm.generatingHistory || vm.loading)

          Spacer()

          toggleButton("Carteira", isOn: showCarteira) { showCarteira.toggle() }
          toggleButton("Aporte", isOn: showAporte) { showAporte.toggle() }
          toggleButton("Resultado", isOn: showResultado) { showResultado.toggle() }
        }

        HStack(spacing: 10) {
          statInfoCard(
            label: "Variação no período",
            value: "\(AppFormatters.currency(metrics.delta)) (\(String(format: "%.2f", metrics.deltaPct))%)",
            color: metrics.delta >= 0 ? .green : .red
          )
          statInfoCard(
            label: "Máximo Drawdown",
            value: "\(String(format: "%.2f", metrics.maxDrawdownPct))%",
            color: .red
          )
          statInfoCard(
            label: "Janela",
            value: "\(metrics.firstLabel) até \(metrics.lastLabel)",
            color: .white
          )
        }

        if let latest = points.last {
          HStack(spacing: 10) {
            if showAporte {
              miniLiveCard(title: "Aporte Líquido (Atual)", value: AppFormatters.currency(latest.aporte), color: .orange)
            }
            if showCarteira {
              miniLiveCard(title: "Valor da Carteira (Atual)", value: AppFormatters.currency(latest.carteira), color: .blue)
            }
            if showResultado {
              miniLiveCard(title: "Resultado (Atual)", value: AppFormatters.currency(latest.resultado), color: latest.resultado >= 0 ? .green : .red)
            }
          }
        }

        if points.isEmpty {
          Text("Sem dados suficientes para desenhar o gráfico.")
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)
        } else {
          VStack(spacing: 0) {
            GeometryReader { geo in
              ZStack(alignment: .topLeading) {
                Chart {
                  if showCarteira {
                    ForEach(indexedPoints) { row in
                      LineMark(
                        x: .value("Index", row.x),
                        y: .value("Valor da Carteira", row.point.carteira)
                      )
                      .foregroundStyle(by: .value("Série", "Valor da Carteira"))
                      .interpolationMethod(.linear)
                      .lineStyle(.init(lineWidth: 2.8))
                    }
                  }

                  if showAporte {
                    ForEach(indexedPoints) { row in
                      LineMark(
                        x: .value("Index", row.x),
                        y: .value("Aporte Líquido", row.point.aporte)
                      )
                      .foregroundStyle(by: .value("Série", "Aporte Líquido"))
                      .interpolationMethod(.linear)
                      .lineStyle(.init(lineWidth: 3.0))
                    }
                  }

                  if let selectedPoint, let selectedX {
                    RuleMark(x: .value("Selecionado", selectedX))
                      .foregroundStyle(Color.white.opacity(0.45))
                      .lineStyle(.init(lineWidth: 1, dash: [4, 4]))
                    if showCarteira {
                      RuleMark(y: .value("Carteira Selecionada", selectedPoint.carteira))
                        .foregroundStyle(Color.white.opacity(0.35))
                        .lineStyle(.init(lineWidth: 1, dash: [4, 4]))

                      PointMark(
                        x: .value("Index", selectedX),
                        y: .value("Carteira", selectedPoint.carteira)
                      )
                      .foregroundStyle(PortfolioChartTheme.carteiraLine)
                      .symbolSize(45)
                    }
                    if showAporte {
                      PointMark(
                        x: .value("Index", selectedX),
                        y: .value("Aporte", selectedPoint.aporte)
                      )
                      .foregroundStyle(PortfolioChartTheme.aporteLine)
                      .symbolSize(36)
                    }
                  }
                }
                .chartXScale(domain: 0 ... Double(max(indexedPoints.count - 1, 1)))
                .chartYScale(domain: topDomain, type: .log)
                .chartForegroundStyleScale([
                  "Valor da Carteira": PortfolioChartTheme.carteiraLine,
                  "Aporte Líquido": PortfolioChartTheme.aporteLine,
                ])
                .chartLegend(.hidden)
                .chartYAxis {
                  AxisMarks(position: .trailing, values: topTicks) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.6, dash: [2, 6]))
                      .foregroundStyle(PortfolioChartTheme.grid.opacity(0.75))
                    AxisValueLabel {
                      if let v = value.as(Double.self) {
                        Text(shortMoney(v))
                          .foregroundStyle(PortfolioChartTheme.tick)
                          .font(.caption2)
                      }
                    }
                  }
                }
                .chartXAxis {
                  AxisMarks(values: .automatic(desiredCount: 8)) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.6, dash: [2, 6]))
                      .foregroundStyle(PortfolioChartTheme.grid.opacity(0.75))
                    AxisValueLabel {
                      if let x = value.as(Double.self), !indexedPoints.isEmpty {
                        let idx = min(max(Int(x.rounded()), 0), indexedPoints.count - 1)
                        let date = indexedPoints[idx].point.date
                        Text(AppFormatters.dateMonthYear.string(from: date))
                          .foregroundStyle(PortfolioChartTheme.tick)
                          .font(.caption2)
                      }
                    }
                  }
                }
                .chartOverlay { proxy in
                  GeometryReader { overlayGeo in
                    Rectangle()
                      .fill(.clear)
                      .contentShape(Rectangle())
                      .onContinuousHover { phase in
                        switch phase {
                        case .active(let location):
                          hoverLocation = location
                          if let plotFrame = proxy.plotFrame {
                            let xPos = location.x - overlayGeo[plotFrame].origin.x
                            if let xVal: Double = proxy.value(atX: xPos),
                               let nearest = closestIndexedPoint(in: indexedPoints, to: xVal) {
                              selectedX = nearest.x
                              selectedPoint = WalletSnapshotPoint(
                                date: nearest.point.date,
                                carteira: nearest.point.carteira,
                                aporte: nearest.point.aporte,
                                resultado: nearest.point.resultado
                              )
                            }
                          }
                        case .ended:
                          selectedPoint = nil
                          selectedX = nil
                          hoverLocation = nil
                        }
                      }
                  }
                }

                if let selectedPoint, let hoverLocation {
                  hoverTooltipCard(for: selectedPoint)
                    .position(
                      x: tooltipX(for: hoverLocation.x, width: geo.size.width),
                      y: tooltipY(for: hoverLocation.y, height: geo.size.height)
                    )
                    .allowsHitTesting(false)
                }
              }
            }
            .frame(height: 380)
            .padding(.horizontal, 8)
            .padding(.top, 8)

            if showCarteira || showAporte {
              HStack(spacing: 14) {
                Spacer()
                if showAporte {
                  legendItem(color: PortfolioChartTheme.aporteLine, label: "Aporte Líquido")
                }
                if showCarteira {
                  legendItem(color: PortfolioChartTheme.carteiraLine, label: "Valor da Carteira")
                }
                Spacer()
              }
              .padding(.vertical, 8)
            }

            if showResultado {
              Divider().background(AppTheme.border)
              Chart {
                ForEach(indexedPoints) { row in
                  LineMark(
                    x: .value("Index", row.x),
                    y: .value("Resultado", row.point.resultado)
                  )
                  .interpolationMethod(.linear)
                  .foregroundStyle(PortfolioChartTheme.resultadoLine)
                  .lineStyle(.init(lineWidth: 2.1))
                }
                if let selectedPoint, let selectedX {
                  RuleMark(x: .value("Selecionado", selectedX))
                    .foregroundStyle(Color.white.opacity(0.45))
                    .lineStyle(.init(lineWidth: 1, dash: [4, 4]))
                  RuleMark(y: .value("Resultado Selecionado", selectedPoint.resultado))
                    .foregroundStyle(Color.white.opacity(0.35))
                    .lineStyle(.init(lineWidth: 1, dash: [4, 4]))
                  PointMark(
                    x: .value("Index", selectedX),
                    y: .value("Resultado", selectedPoint.resultado)
                  )
                  .foregroundStyle(.white.opacity(0.95))
                  .symbolSize(34)
                }
              }
              .chartXScale(domain: 0 ... Double(max(indexedPoints.count - 1, 1)))
              .chartYAxis {
                AxisMarks(position: .trailing) { value in
                  AxisGridLine(stroke: StrokeStyle(lineWidth: 0.6, dash: [2, 6]))
                    .foregroundStyle(PortfolioChartTheme.grid.opacity(0.5))
                  AxisValueLabel {
                    if let v = value.as(Double.self) {
                      Text(shortMoney(v))
                        .foregroundStyle(PortfolioChartTheme.tick)
                        .font(.caption2)
                    }
                  }
                }
              }
              .chartXAxis(.hidden)
              .chartOverlay { proxy in
                GeometryReader { geo in
                  Rectangle()
                    .fill(.clear)
                    .contentShape(Rectangle())
                    .onContinuousHover { phase in
                      switch phase {
                      case .active(let location):
                        hoverLocation = location
                        if let plotFrame = proxy.plotFrame {
                          let xPos = location.x - geo[plotFrame].origin.x
                          if let xVal: Double = proxy.value(atX: xPos),
                             let nearest = closestIndexedPoint(in: indexedPoints, to: xVal) {
                            selectedX = nearest.x
                            selectedPoint = WalletSnapshotPoint(
                              date: nearest.point.date,
                              carteira: nearest.point.carteira,
                              aporte: nearest.point.aporte,
                              resultado: nearest.point.resultado
                            )
                          }
                        }
                      case .ended:
                        selectedPoint = nil
                        selectedX = nil
                        hoverLocation = nil
                      }
                    }
                }
              }
              .frame(height: 150)
              .padding(.horizontal, 8)
              .padding(.vertical, 6)
            }
          }
          .background(PortfolioChartTheme.background)
          .clipShape(RoundedRectangle(cornerRadius: 10))
          .overlay(
            RoundedRectangle(cornerRadius: 10)
              .stroke(AppTheme.border, lineWidth: 1)
          )

          HStack(spacing: 10) {
            chartFooter("Início", metrics.firstLabel)
            chartFooter("Fim", metrics.lastLabel)
            chartFooter("Mínimo", AppFormatters.currency(metrics.min))
            chartFooter("Máximo", AppFormatters.currency(metrics.max))
          }
        }
      }
    }
  }

  private var exposureSection: some View {
    HStack(spacing: 12) {
      miniStatusCard("Exposição", "\(vm.exposureCount) ativo(s) com posição calculada.", icon: "wallet.pass", color: .white)
      miniStatusCard("Ganho potencial", "Ativos com P/L não realizado positivo: \(vm.gainersCount)", icon: "chart.line.uptrend.xyaxis", color: .green)
      miniStatusCard("Pressão de perda", "Ativos com P/L não realizado negativo: \(vm.losersCount)", icon: "chart.line.downtrend.xyaxis", color: .red)
    }
  }

  private func statusCard(title: String, message: String, color: Color) -> some View {
    AppCard {
      VStack(alignment: .leading, spacing: 4) {
        Text(title)
          .font(.headline)
          .foregroundStyle(color)
        Text(message)
          .font(.subheadline)
          .foregroundStyle(AppTheme.subtleText)
      }
    }
  }

  private func toggleButton(_ label: String, isOn: Bool, action: @escaping () -> Void) -> some View {
    Group {
      if isOn {
        Button(label, action: action)
          .buttonStyle(.borderedProminent)
      } else {
        Button(label, action: action)
          .buttonStyle(.bordered)
      }
    }
  }

  @ViewBuilder
  private func rangeButton(_ item: RangePreset) -> some View {
    if selectedRange == item {
      Button(item.rawValue) {
        selectedRange = item
      }
      .buttonStyle(.borderedProminent)
    } else {
      Button(item.rawValue) {
        selectedRange = item
      }
      .buttonStyle(.bordered)
    }
  }

  private func statInfoCard(label: String, value: String, color: Color) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(label)
        .font(.caption)
        .foregroundStyle(AppTheme.subtleText)
      Text(value)
        .font(.headline)
        .foregroundStyle(color)
        .lineLimit(2)
        .minimumScaleFactor(0.75)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(AppTheme.cardBackground)
    .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.border, lineWidth: 1))
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private func miniLiveCard(title: String, value: String, color: Color) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(.caption)
        .foregroundStyle(color.opacity(0.9))
      Text(value)
        .font(.headline)
        .foregroundStyle(color)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(AppTheme.cardBackground)
    .overlay(RoundedRectangle(cornerRadius: 10).stroke(color.opacity(0.35), lineWidth: 1))
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private func miniStatusCard(_ title: String, _ body: String, icon: String, color: Color) -> some View {
    AppCard {
      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Image(systemName: icon)
            .foregroundStyle(color)
          Text(title)
            .font(.headline)
            .foregroundStyle(AppTheme.strongText)
        }
        Text(body)
          .font(.subheadline)
          .foregroundStyle(AppTheme.subtleText)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private func chartFooter(_ label: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .font(.caption)
        .foregroundStyle(AppTheme.subtleText)
      Text(value)
        .font(.caption.bold())
        .foregroundStyle(AppTheme.strongText)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func legendItem(color: Color, label: String) -> some View {
    HStack(spacing: 6) {
      Rectangle()
        .fill(color)
        .frame(width: 12, height: 2)
      Text(label)
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.white.opacity(0.9))
    }
  }

  private func hoverTooltipCard(for point: WalletSnapshotPoint) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Data: \(AppFormatters.dateDayMonth.string(from: point.date))")
        .font(.caption.bold())
        .foregroundStyle(AppTheme.subtleText)
      if showAporte {
        HStack {
          Text("Aporte Líquido")
            .foregroundStyle(.orange)
          Spacer()
          Text(AppFormatters.currency(point.aporte))
            .foregroundStyle(.orange)
        }
        .font(.caption.bold())
      }
      if showCarteira {
        HStack {
          Text("Valor da Carteira")
            .foregroundStyle(.blue)
          Spacer()
          Text(AppFormatters.currency(point.carteira))
            .foregroundStyle(.blue)
        }
        .font(.caption.bold())
      }
      if showResultado {
        HStack {
          Text("Resultado")
            .foregroundStyle(.white.opacity(0.92))
          Spacer()
          Text(AppFormatters.currency(point.resultado))
            .foregroundStyle(point.resultado >= 0 ? .green : .red)
        }
        .font(.caption.bold())
      }
    }
    .padding(10)
    .frame(width: 280)
    .background(Color(red: 0.05, green: 0.08, blue: 0.14).opacity(0.96))
    .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.border, lineWidth: 1))
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private func tooltipX(for rawX: CGFloat, width: CGFloat) -> CGFloat {
    let half: CGFloat = 140
    let minX: CGFloat = half + 8
    let maxX: CGFloat = max(minX, width - half - 8)
    return min(max(rawX, minX), maxX)
  }

  private func tooltipY(for rawY: CGFloat, height: CGFloat) -> CGFloat {
    let minY: CGFloat = 40
    let maxY: CGFloat = max(minY, height - 40)
    return min(max(rawY - 70, minY), maxY)
  }

  private func shortMoney(_ value: Double) -> String {
    let absValue = abs(value)
    if absValue >= 1_000_000 { return String(format: "%.1fM", value / 1_000_000) }
    if absValue >= 1_000 { return String(format: "%.0fk", value / 1_000) }
    return String(format: "%.0f", value)
  }

  private var filteredPoints: [WalletSnapshotPoint] {
    guard !vm.history.isEmpty else { return [] }
    if selectedRange == .all { return vm.history }
    let cutoff = Calendar.current.date(byAdding: .month, value: -selectedRange.months, to: Date()) ?? Date.distantPast
    let points = vm.history.filter { $0.date >= cutoff }
    return points.isEmpty ? vm.history : points
  }

  private var chartPoints: [ChartPoint] {
    let sorted = filteredPoints.sorted { $0.date < $1.date }
    guard !sorted.isEmpty else { return [] }

    // Mantém um ponto por dia e normaliza no início do dia para eliminar colunas/artefatos.
    let calendar = Calendar.current
    var byDay: [Date: ChartPoint] = [:]
    for point in sorted {
      let day = calendar.startOfDay(for: point.date)
      byDay[day] = ChartPoint(
        date: day,
        ts: day.timeIntervalSince1970,
        carteira: point.carteira,
        aporte: point.aporte,
        resultado: point.resultado
      )
    }
    return byDay
      .sorted { $0.key < $1.key }
      .map { $0.value }
  }

  private func closestPoint(in points: [ChartPoint], to ts: Double) -> WalletSnapshotPoint? {
    guard !points.isEmpty else { return nil }
    let best = points.min { lhs, rhs in
      abs(lhs.ts - ts) < abs(rhs.ts - ts)
    }
    guard let best else { return nil }
    return WalletSnapshotPoint(
      date: best.date,
      carteira: best.carteira,
      aporte: best.aporte,
      resultado: best.resultado
    )
  }

  private func closestIndexedPoint(in points: [IndexedChartPoint], to x: Double) -> IndexedChartPoint? {
    guard !points.isEmpty else { return nil }
    return points.min { lhs, rhs in
      abs(lhs.x - x) < abs(rhs.x - x)
    }
  }

  private func chartMetrics(_ points: [ChartPoint]) -> (
    delta: Double,
    deltaPct: Double,
    maxDrawdownPct: Double,
    firstLabel: String,
    lastLabel: String,
    min: Double,
    max: Double
  ) {
    guard let first = points.first, let last = points.last else {
      return (0, 0, 0, "-", "-", 0, 0)
    }

    let delta = last.carteira - first.carteira
    let deltaPct = first.carteira > 0 ? (delta / first.carteira) * 100 : 0

    var peak = points.first?.carteira ?? 0
    var maxDrawdown = 0.0
    for point in points {
      peak = max(peak, point.carteira)
      let dd = peak > 0 ? ((point.carteira - peak) / peak) * 100 : 0
      maxDrawdown = min(maxDrawdown, dd)
    }

    let minValue = points.map(\.carteira).min() ?? 0
    let maxValue = points.map(\.carteira).max() ?? 0

    return (
      delta,
      deltaPct,
      maxDrawdown,
      AppFormatters.dateDayMonth.string(from: first.date),
      AppFormatters.dateDayMonth.string(from: last.date),
      minValue,
      maxValue
    )
  }

  private func topChartYDomain(points: [ChartPoint]) -> ClosedRange<Double> {
    guard !points.isEmpty else { return 1 ... 10 }

    var values: [Double] = []
    if showCarteira {
      values.append(contentsOf: points.map(\.carteira))
    }
    if showAporte {
      values.append(contentsOf: points.map(\.aporte))
    }
    if values.isEmpty {
      values = points.map(\.carteira)
    }

    let positive = values.filter { $0 > 0 }
    guard let minV = positive.min(), let maxV = positive.max() else {
      return 1 ... 10
    }

    if minV == maxV {
      let lower = max(1, minV * 0.95)
      let upper = max(lower + 1, maxV * 1.05)
      return lower ... upper
    }

    let lower = max(1, minV * 0.96)
    let upper = max(lower + 1, maxV * 1.04)
    return lower ... upper
  }

  private func topChartYTicks(domain: ClosedRange<Double>) -> [Double] {
    let minV = max(domain.lowerBound, 1)
    let maxV = max(domain.upperBound, minV + 1)
    let logMin = log10(minV)
    let logMax = log10(maxV)

    // 6 marcas distribuídas em espaço log para evitar eixo "travado" em um único valor.
    var ticks: [Double] = []
    for i in 0...5 {
      let t = Double(i) / 5.0
      let exponent = logMin + (logMax - logMin) * t
      ticks.append(pow(10, exponent))
    }
    return ticks
  }
}

private struct WalletMetricCard: View {
  let title: String
  let value: String
  let subtitle: String
  let valueColor: Color

  var body: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 8) {
        Text(title)
          .font(.subheadline)
          .foregroundStyle(AppTheme.subtleText)
        Text(value)
          .font(.system(size: 39, weight: .bold))
          .foregroundStyle(valueColor)
          .lineLimit(1)
          .minimumScaleFactor(0.75)
        Text(subtitle)
          .font(.caption)
          .foregroundStyle(AppTheme.subtleText)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

private struct PortfolioAdminSheet: View {
  let wallet: WalletConfigRow?
  let aportes: [WalletAporteRow]
  let onSaveWallet: (_ nome: String, _ valorInicial: Double) async throws -> Void
  let onSaveAporte: (_ id: UUID?, _ carteiraId: UUID, _ valor: Double, _ data: Date, _ descricao: String?) async throws -> Void
  let onDeleteAporte: (_ id: UUID) async throws -> Void
  let onClose: () -> Void

  @State private var tab: Int = 0
  @State private var nome: String = "Carteira Principal"
  @State private var valorInicial: String = "0"

  @State private var aporteEditando: UUID?
  @State private var aporteValor: String = ""
  @State private var aporteData: Date = Date()
  @State private var aporteDescricao: String = ""

  @State private var saving = false
  @State private var error: String?

  var body: some View {
    AppModalContainer(
      title: "Administrar Carteira",
      subtitle: "Configure dados da carteira e gerencie aportes de capital.",
      width: 920,
      minHeight: 680
    ) {
      Picker("", selection: $tab) {
        Text("Dados da Carteira").tag(0)
        Text("Aportes").tag(1)
      }
      .pickerStyle(.segmented)

      if let error {
        Text(error)
          .font(.caption)
          .foregroundStyle(.red)
      }

      if tab == 0 {
        VStack(alignment: .leading, spacing: 10) {
          Text("Nome da carteira")
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)
          TextField("Carteira Principal", text: $nome)
            .textFieldStyle(.roundedBorder)

          Text("Valor inicial")
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)
          TextField("Ex: 10000", text: $valorInicial)
            .textFieldStyle(.roundedBorder)

          Text("Alterar o valor inicial ajusta a base da carteira. Aportes devem ser lançados na aba de aportes.")
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)

          Button(saving ? "Salvando..." : (wallet == nil ? "Criar Carteira" : "Atualizar Carteira")) {
            Task { await saveWallet() }
          }
          .buttonStyle(.borderedProminent)
          .disabled(saving)
        }
      } else {
        VStack(alignment: .leading, spacing: 10) {
          HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
              Text("Valor")
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
              TextField("Ex: 1500", text: $aporteValor)
                .textFieldStyle(.roundedBorder)
            }
            VStack(alignment: .leading, spacing: 4) {
              Text("Data")
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
              DatePicker("", selection: $aporteData, displayedComponents: .date)
                .labelsHidden()
            }
            VStack(alignment: .leading, spacing: 4) {
              Text("Descrição")
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
              TextField("Aporte mensal", text: $aporteDescricao)
                .textFieldStyle(.roundedBorder)
            }
          }

          HStack {
            Button(saving ? "Salvando..." : (aporteEditando == nil ? "Adicionar Aporte" : "Atualizar Aporte")) {
              Task { await saveAporte() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(saving || wallet == nil)

            if aporteEditando != nil {
              Button("Cancelar Edição") {
                resetAporteForm()
              }
              .buttonStyle(.bordered)
            }
          }

          ScrollView {
            VStack(spacing: 0) {
              ForEach(aportes) { aporte in
                HStack {
                  Text(AppFormatters.dateDayMonth.string(from: aporte.dataAporte))
                    .frame(width: 100, alignment: .leading)
                  Text(AppFormatters.currency(aporte.valor))
                    .frame(width: 120, alignment: .leading)
                  Text(aporte.descricao ?? "-")
                    .frame(maxWidth: .infinity, alignment: .leading)
                  HStack(spacing: 6) {
                    Button("Editar") {
                      aporteEditando = aporte.id
                      aporteValor = String(aporte.valor)
                      aporteData = aporte.dataAporte
                      aporteDescricao = aporte.descricao ?? ""
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button("Excluir") {
                      Task { await deleteAporte(aporte.id) }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(.red)
                  }
                }
                .font(.caption)
                .padding(.vertical, 8)
                Divider().background(AppTheme.border)
              }
              if aportes.isEmpty {
                Text("Sem aportes.")
                  .font(.caption)
                  .foregroundStyle(AppTheme.subtleText)
                  .frame(maxWidth: .infinity, alignment: .center)
                  .padding(.vertical, 16)
              }
            }
          }
          .frame(minHeight: 220)
        }
      }

      HStack {
        Spacer()
        Button("Fechar") { onClose() }
          .buttonStyle(.bordered)
      }
    }
    .onAppear {
      nome = wallet?.nome ?? "Carteira Principal"
      valorInicial = String(wallet?.valorInicial ?? 0)
    }
  }

  private func saveWallet() async {
    error = nil
    let valor = Double(valorInicial.replacingOccurrences(of: ",", with: ".")) ?? -1
    if valor < 0 {
      error = "Valor inicial inválido."
      return
    }
    saving = true
    defer { saving = false }

    do {
      try await onSaveWallet(nome.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Carteira Principal" : nome, valor)
      onClose()
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func saveAporte() async {
    error = nil
    guard let carteiraId = wallet?.id else {
      error = "Crie a carteira antes de lançar aportes."
      return
    }

    let valor = Double(aporteValor.replacingOccurrences(of: ",", with: ".")) ?? 0
    if valor <= 0 {
      error = "Valor do aporte inválido."
      return
    }

    saving = true
    defer { saving = false }

    do {
      try await onSaveAporte(
        aporteEditando,
        carteiraId,
        valor,
        aporteData,
        aporteDescricao.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : aporteDescricao
      )
      resetAporteForm()
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func deleteAporte(_ id: UUID) async {
    error = nil
    saving = true
    defer { saving = false }
    do {
      try await onDeleteAporte(id)
      if aporteEditando == id {
        resetAporteForm()
      }
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
