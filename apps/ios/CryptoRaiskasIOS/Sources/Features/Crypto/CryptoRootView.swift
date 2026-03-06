import SwiftUI

struct CoinOption: Identifiable, Hashable {
  let id: String
  let nome: String
  let simbolo: String
}

struct PortfolioAssetRow: Identifiable {
  let id: String
  let nome: String
  let simbolo: String
  let quantidade: Double
  let custoMedio: Double
  let custoBase: Double
  let precoAtual: Double
  let valorAtual: Double
  let naoRealizado: Double
  let naoRealizadoPct: Double
  let realizado: Double
}

struct OperationMetricRow: Identifiable {
  let id: UUID
  let data: Date
  let tipo: String
  let moedaId: String
  let nome: String
  let simbolo: String
  let qtd: Double
  let valorOp: Double
  let totalOp: Double
  let precoAtual: Double
  let valorTotalAtual: Double
  let lucro: Double
  let pct: Double
  let exchange: String
}

enum OpsFilter: String, CaseIterable, Identifiable {
  case compra
  case venda
  case todas
  var id: String { rawValue }

  var label: String {
    switch self {
    case .compra: return "Compras"
    case .venda: return "Vendas"
    case .todas: return "Todas"
    }
  }
}

struct OperationFormData {
  var coinId: String = "bitcoin"
  var nome: String = "Bitcoin"
  var simbolo: String = "BTC"
  var tipo: String = "compra"
  var quantidade: String = ""
  var precoUnitario: String = ""
  var taxa: String = "0"
  var exchange: String = ""
  var notas: String = ""
  var dataOperacao: Date = Date()
}

@MainActor
final class CryptoRootViewModel: ObservableObject {
  @Published var loading = false
  @Published var saving = false
  @Published var error: String?

  @Published var operations: [OperationRow] = []
  @Published var prices: [String: Double] = [:]
  @Published var filter: OpsFilter = .compra
  @Published var search = ""

  private let defaultCoins: [CoinOption] = [
    .init(id: "bitcoin", nome: "Bitcoin", simbolo: "BTC"),
    .init(id: "ethereum", nome: "Ethereum", simbolo: "ETH"),
    .init(id: "ripple", nome: "XRP", simbolo: "XRP"),
  ]

  func refresh() async {
    loading = true
    defer { loading = false }

    do {
      let ops = try await SupabaseService.shared.fetchOperations(limit: 1200)
      operations = ops
      error = nil

      let ids = Array(Set(ops.map { $0.moedaId.lowercased() } + defaultCoins.map { $0.id }))
      do {
        let tickers = try await SupabaseService.shared.fetchMarketTickers(ids: ids)
        var merged = prices
        for ticker in tickers {
          merged[ticker.id.lowercased()] = ticker.price
        }
        for (coin, fallback) in latestOperationPriceByCoin where merged[coin] == nil {
          merged[coin] = fallback
        }
        prices = merged
      } catch {
        var merged = prices
        for (coin, fallback) in latestOperationPriceByCoin where merged[coin] == nil {
          merged[coin] = fallback
        }
        prices = merged
        self.error = "Dados de mercado instáveis. Exibindo último preço conhecido."
      }
      let s = summary
      WidgetPortfolioSnapshotStore.save(
        portfolio: s.portfolio,
        unrealized: s.unrealized,
        unrealizedPct: s.unrealizedPct
      )
    } catch {
      self.error = error.localizedDescription
    }
  }

  func saveOperation(editingId: UUID?, form: OperationFormData) async {
    let qtd = Double(form.quantidade.replacingOccurrences(of: ",", with: ".")) ?? 0
    let preco = Double(form.precoUnitario.replacingOccurrences(of: ",", with: ".")) ?? 0
    let taxa = Double(form.taxa.replacingOccurrences(of: ",", with: ".")) ?? 0
    guard qtd > 0, preco > 0 else {
      error = "Quantidade e preço devem ser maiores que zero."
      return
    }

    saving = true
    defer { saving = false }
    do {
      let input = OperationUpsertInput(
        moedaId: form.coinId.lowercased(),
        nome: form.nome,
        simbolo: form.simbolo.uppercased(),
        tipo: form.tipo.lowercased(),
        quantidade: qtd,
        precoUnitario: preco,
        valorTotal: qtd * preco,
        taxa: taxa,
        exchange: form.exchange.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : form.exchange,
        notas: form.notas.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : form.notas,
        dataOperacao: form.dataOperacao
      )

      if let editingId {
        try await SupabaseService.shared.updateOperation(id: editingId, input: input)
      } else {
        try await SupabaseService.shared.createOperation(input: input)
      }
      await refresh()
    } catch {
      self.error = error.localizedDescription
    }
  }

  func deleteOperation(id: UUID) async {
    saving = true
    defer { saving = false }
    do {
      try await SupabaseService.shared.deleteOperation(id: id)
      await refresh()
    } catch {
      self.error = error.localizedDescription
    }
  }

  var coinOptions: [CoinOption] {
    var map: [String: CoinOption] = [:]
    for item in defaultCoins { map[item.id] = item }
    for op in operations {
      let id = op.moedaId.lowercased()
      map[id] = CoinOption(id: id, nome: op.nome, simbolo: op.simbolo.uppercased())
    }
    return map.values.sorted { $0.nome < $1.nome }
  }

  var summary: (portfolio: Double, invested: Double, unrealized: Double, unrealizedPct: Double, realized: Double) {
    let assets = portfolioRows
    let portfolio = assets.reduce(0) { $0 + $1.valorAtual }
    let invested = assets.reduce(0) { $0 + $1.custoBase }
    let unrealized = assets.reduce(0) { $0 + $1.naoRealizado }
    let unrealizedPct = invested > 0 ? (unrealized / invested) * 100 : 0
    let realized = assets.reduce(0) { $0 + $1.realizado }
    return (portfolio, invested, unrealized, unrealizedPct, realized)
  }

  var portfolioRows: [PortfolioAssetRow] {
    struct Lot {
      var qty: Double
      let costUnit: Double
    }

    let sorted = operations.sorted { $0.dataOperacao < $1.dataOperacao }
    var lotsByCoin: [String: [Lot]] = [:]
    var realizedByCoin: [String: Double] = [:]

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
        let proceedsUnit = op.quantidade > 0 ? ((op.valorTotal - op.taxa) / op.quantidade) : 0
        while qtyToSell > 0, !lots.isEmpty {
          var first = lots[0]
          let consumed = min(first.qty, qtyToSell)
          first.qty -= consumed
          qtyToSell -= consumed
          let cost = consumed * first.costUnit
          let proceeds = consumed * proceedsUnit
          realizedByCoin[coin, default: 0] += (proceeds - cost)
          if first.qty <= 1e-9 { lots.removeFirst() } else { lots[0] = first }
        }
      }
      lotsByCoin[coin] = lots
    }

    var rows: [PortfolioAssetRow] = []
    for coin in Set(Array(lotsByCoin.keys) + Array(realizedByCoin.keys)) {
      let lots = lotsByCoin[coin] ?? []
      let qty = lots.reduce(0.0) { $0 + $1.qty }
      let costBase = lots.reduce(0.0) { $0 + ($1.qty * $1.costUnit) }
      let avgCost = qty > 0 ? costBase / qty : 0
      let px = prices[coin] ?? latestOperationPriceByCoin[coin] ?? 0
      let value = qty * px
      let unreal = value - costBase
      let unrealPct = costBase > 0 ? (unreal / costBase) * 100 : 0

      let meta = coinOptions.first(where: { $0.id == coin }) ??
        CoinOption(id: coin, nome: coin.capitalized, simbolo: coin.uppercased())

      rows.append(
        PortfolioAssetRow(
          id: coin,
          nome: meta.nome,
          simbolo: meta.simbolo,
          quantidade: qty,
          custoMedio: avgCost,
          custoBase: costBase,
          precoAtual: px,
          valorAtual: value,
          naoRealizado: unreal,
          naoRealizadoPct: unrealPct,
          realizado: realizedByCoin[coin, default: 0]
        )
      )
    }
    return rows.sorted { $0.valorAtual > $1.valorAtual }
  }

  var operationRows: [OperationMetricRow] {
    struct Lot {
      var qty: Double
      let costUnit: Double
    }

    let sorted = operations.sorted { $0.dataOperacao < $1.dataOperacao }
    var lotsByCoin: [String: [Lot]] = [:]
    var realizedByOp: [UUID: Double] = [:]

    for op in sorted {
      let coin = op.moedaId.lowercased()
      var lots = lotsByCoin[coin] ?? []
      if op.tipo.lowercased() == "compra" {
        let qty = max(0, op.quantidade)
        let unit = qty > 0 ? ((op.valorTotal + op.taxa) / qty) : 0
        lots.append(Lot(qty: qty, costUnit: unit))
      } else {
        var qtyToSell = max(0, op.quantidade)
        let proceedsUnit = op.quantidade > 0 ? ((op.valorTotal - op.taxa) / op.quantidade) : 0
        var realized = 0.0
        while qtyToSell > 0, !lots.isEmpty {
          var first = lots[0]
          let consumed = min(first.qty, qtyToSell)
          first.qty -= consumed
          qtyToSell -= consumed
          let cost = consumed * first.costUnit
          let proceeds = consumed * proceedsUnit
          realized += (proceeds - cost)
          if first.qty <= 1e-9 { lots.removeFirst() } else { lots[0] = first }
        }
        realizedByOp[op.id] = realized
      }
      lotsByCoin[coin] = lots
    }

    let filtered = operations.filter { op in
      switch filter {
      case .compra:
        if op.tipo.lowercased() != "compra" { return false }
      case .venda:
        if op.tipo.lowercased() != "venda" { return false }
      case .todas:
        break
      }

      let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      if q.isEmpty { return true }
      return op.nome.lowercased().contains(q)
        || op.simbolo.lowercased().contains(q)
        || (op.exchange ?? "").lowercased().contains(q)
    }

    return filtered.map { op in
      let coin = op.moedaId.lowercased()
      let px = prices[coin] ?? latestOperationPriceByCoin[coin] ?? 0
      let totalAtual = op.quantidade * px
      let pnl: Double = if op.tipo.lowercased() == "compra" {
        totalAtual - op.valorTotal
      } else {
        realizedByOp[op.id, default: 0]
      }
      let pct = op.valorTotal > 0 ? (pnl / op.valorTotal) * 100 : 0
      return OperationMetricRow(
        id: op.id,
        data: op.dataOperacao,
        tipo: op.tipo,
        moedaId: op.moedaId,
        nome: op.nome,
        simbolo: op.simbolo.uppercased(),
        qtd: op.quantidade,
        valorOp: op.precoUnitario,
        totalOp: op.valorTotal,
        precoAtual: px,
        valorTotalAtual: totalAtual,
        lucro: pnl,
        pct: pct,
        exchange: op.exchange ?? "-"
      )
    }.sorted { $0.data > $1.data }
  }

  private var latestOperationPriceByCoin: [String: Double] {
    var out: [String: Double] = [:]
    for op in operations.sorted(by: { $0.dataOperacao > $1.dataOperacao }) {
      let coin = op.moedaId.lowercased()
      if out[coin] == nil, op.precoUnitario > 0 {
        out[coin] = op.precoUnitario
      }
    }
    return out
  }
}

struct CryptoRootView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @StateObject private var vm = CryptoRootViewModel()
  @State private var editing: OperationRow?
  @State private var deleteTarget: UUID?
  @State private var showingOperationModal = false
  @State private var showDeleteAlert = false

  var body: some View {
    ZStack(alignment: .topLeading) {
      AppTheme.pageBackground.ignoresSafeArea()
      ScrollView {
        VStack(alignment: .leading, spacing: AppLayout.pageSpacing) {
          header
          summaryCards
          portfolioBlock
          operationsHeader
          operationsBlock
        }
        .padding(.horizontal, horizontalSizeClass == .compact ? AppLayout.pageHorizontalCompact : AppLayout.pageHorizontalRegular)
        .padding(.top, AppLayout.pageSpacing)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .tabBarSafeAreaInset()
    .task {
      if vm.operations.isEmpty {
        await vm.refresh()
      }
    }
    .sheet(isPresented: $showingOperationModal) {
      OperationModalView(
        options: vm.coinOptions,
        editing: editing,
        saving: vm.saving,
        onSave: { form in
          Task {
            await vm.saveOperation(editingId: editing?.id, form: form)
            if vm.error == nil {
              editing = nil
              showingOperationModal = false
            }
          }
        },
        onCancel: {
          editing = nil
          showingOperationModal = false
        }
      )
      .presentationDetents([.large])
      .presentationDragIndicator(.visible)
    }
    .alert("Excluir operação?", isPresented: $showDeleteAlert, presenting: deleteTarget) { id in
      Button("Cancelar", role: .cancel) {}
      Button("Excluir", role: .destructive) {
        Task {
          await vm.deleteOperation(id: id)
          deleteTarget = nil
        }
      }
    } message: { _ in
      Text("Essa ação remove a operação de forma permanente.")
    }
  }

  private var header: some View {
    PageHeaderView(
      title: "Gerenciamento de Criptomoedas",
      subtitle: "Controle suas operações de compra e venda"
    ) {
      Button {
        editing = nil
        showingOperationModal = true
      } label: {
        Label("Nova Operação", systemImage: "plus")
          .lineLimit(1)
      }
      .buttonStyle(.borderedProminent)
    }
  }

  private var summaryCards: some View {
    let s = vm.summary
    return VStack(spacing: 10) {
      CryptoMetricCard(title: "Total Portfólio", value: AppFormatters.currency(s.portfolio), subtitle: "", icon: "wallet.pass", valueColor: .white)
      CryptoMetricCard(title: "Total Investido", value: AppFormatters.currency(s.invested), subtitle: "", icon: "creditcard", valueColor: .white)
      CryptoMetricCard(
        title: "L/P Não Realizado",
        value: AppFormatters.currency(s.unrealized),
        subtitle: "(\(AppFormatters.percent(s.unrealizedPct)))",
        icon: s.unrealized >= 0 ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis",
        valueColor: s.unrealized >= 0 ? .green : .red
      )
      CryptoMetricCard(title: "L/P Realizado", value: AppFormatters.currency(s.realized), subtitle: "Total desde o início", icon: "bitcoinsign.circle", valueColor: s.realized >= 0 ? .green : .red)
    }
  }

  private var portfolioBlock: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 2) {
            Text("Meu Portfólio")
              .font(.title3.bold())
              .foregroundStyle(AppTheme.strongText)
            Text("Visão consolidada por criptomoeda")
              .font(.subheadline)
              .foregroundStyle(AppTheme.subtleText)
              .lineLimit(2)
          }
          Spacer()
          Button(vm.loading ? "Atualizando..." : "Atualizar") {
            Task { await vm.refresh() }
          }
          .buttonStyle(.bordered)
        }

        if vm.portfolioRows.isEmpty {
          Text("Sem posições no portfólio")
            .foregroundStyle(AppTheme.subtleText)
            .padding(.vertical, 8)
        } else {
          VStack(spacing: 0) {
            ForEach(vm.portfolioRows) { row in
              VStack(alignment: .leading, spacing: 6) {
                HStack {
                  Text("\(row.nome) (\(row.simbolo))")
                    .foregroundStyle(.white)
                    .font(.headline)
                  Spacer()
                  Text(AppFormatters.currency(row.valorAtual))
                    .foregroundStyle(.white)
                    .font(.headline)
                }

                infoRow([
                  ("Qtde", number(row.quantidade, 4), .white.opacity(0.9)),
                  ("Custo Médio", AppFormatters.currency(row.custoMedio), .white.opacity(0.9)),
                  ("Preço Atual", AppFormatters.currency(row.precoAtual), .white.opacity(0.9)),
                ])

                infoRow([
                  ("L/P Não Realizado", AppFormatters.signedCurrency(row.naoRealizado), row.naoRealizado >= 0 ? .green : .red),
                  ("%", AppFormatters.percent(row.naoRealizadoPct), row.naoRealizado >= 0 ? .green : .red),
                  ("L/P Realizado", AppFormatters.signedCurrency(row.realizado), row.realizado >= 0 ? .green : .red),
                ])
              }
              .padding(.vertical, 8)
              Divider().overlay(AppTheme.border)
            }
          }
        }
      }
    }
  }

  private var operationsHeader: some View {
    VStack(spacing: 8) {
      Picker("", selection: $vm.filter) {
        ForEach(OpsFilter.allCases) { item in
          Text(item.label).tag(item)
        }
      }
      .pickerStyle(.segmented)

      TextField("Buscar moeda ou exchange...", text: $vm.search)
        .textFieldStyle(.roundedBorder)
    }
  }

  private var operationsBlock: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 2) {
            Text("Minhas Operações")
              .font(.title3.bold())
              .foregroundStyle(AppTheme.strongText)
            Text("Registro de suas compras e vendas de criptomoedas")
              .font(.subheadline)
              .foregroundStyle(AppTheme.subtleText)
              .lineLimit(2)
          }
          Spacer()
          Button(vm.loading ? "Atualizando..." : "Atualizar") {
            Task { await vm.refresh() }
          }
          .buttonStyle(.bordered)
        }

        if let error = vm.error {
          Text(error)
            .font(.caption)
            .foregroundStyle(.red)
        }

        if vm.operationRows.isEmpty {
          VStack(spacing: 12) {
            Text("Nenhuma operação encontrada")
              .font(.subheadline)
              .foregroundStyle(AppTheme.subtleText)
            Button {
              editing = nil
              showingOperationModal = true
            } label: {
              Label("Adicionar Operação", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
          }
          .frame(maxWidth: .infinity, minHeight: 160)
        } else {
          VStack(spacing: 0) {
            ForEach(vm.operationRows) { row in
              VStack(alignment: .leading, spacing: 6) {
                HStack {
                  Text(formattedDate(row.data))
                    .font(.caption)
                    .foregroundStyle(AppTheme.subtleText)
                  Spacer()
                  Text(row.tipo.lowercased() == "compra" ? "Compra" : "Venda")
                    .font(.caption.bold())
                    .foregroundStyle(row.tipo.lowercased() == "compra" ? .green : .red)
                }

                HStack {
                  Text("\(row.nome) (\(row.simbolo))")
                    .font(.headline)
                    .foregroundStyle(.white)
                  Spacer()
                  Text(AppFormatters.currency(row.totalOp))
                    .foregroundStyle(.white)
                }

                infoRow([
                  ("Qtde", number(row.qtd, 6), .white.opacity(0.9)),
                  ("Preço", AppFormatters.currency(row.valorOp), .white.opacity(0.9)),
                  ("Atual", AppFormatters.currency(row.precoAtual), .white.opacity(0.9)),
                ])

                infoRow([
                  ("L/P", AppFormatters.signedCurrency(row.lucro), row.lucro >= 0 ? .green : .red),
                  ("%", AppFormatters.percent(row.pct), row.pct >= 0 ? .green : .red),
                  ("Exchange", row.exchange, .white.opacity(0.9)),
                ])

                HStack(spacing: 8) {
                  Button("Editar") {
                    if let raw = vm.operations.first(where: { $0.id == row.id }) {
                      editing = raw
                      showingOperationModal = true
                    }
                  }
                  .buttonStyle(.bordered)
                  .controlSize(.small)

                  Button("Excluir") {
                    deleteTarget = row.id
                    showDeleteAlert = true
                  }
                  .buttonStyle(.bordered)
                  .controlSize(.small)
                  .tint(.red)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
              }
              .padding(.vertical, 8)
              Divider().overlay(AppTheme.border.opacity(0.5))
            }
          }
        }
      }
    }
  }

  private func infoLabel(_ label: String, _ value: String, color: Color = .white.opacity(0.9)) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .font(.caption2)
        .foregroundStyle(AppTheme.subtleText)
      Text(value)
        .font(.caption)
        .foregroundStyle(color)
    }
  }

  @ViewBuilder
  private func infoRow(_ items: [(String, String, Color)]) -> some View {
    let columns: [GridItem] = horizontalSizeClass == .compact
      ? [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
      : [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
      ForEach(Array(items.enumerated()), id: \.offset) { _, item in
        infoLabel(item.0, item.1, color: item.2)
      }
    }
  }

  private func formattedDate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "pt_BR")
    formatter.dateFormat = "dd/MM/yyyy HH:mm"
    return formatter.string(from: date)
  }

  private func number(_ value: Double, _ decimals: Int) -> String {
    String(format: "%.\(decimals)f", value)
  }
}

private struct CryptoMetricCard: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  let title: String
  let value: String
  let subtitle: String
  let icon: String
  let valueColor: Color

  var body: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text(title)
            .font(.caption)
            .foregroundStyle(AppTheme.strongText)
          Spacer()
          Image(systemName: icon)
            .font(.caption)
            .foregroundStyle(valueColor == .white ? .white.opacity(0.55) : valueColor)
        }
        Text(value)
          .font(.system(size: horizontalSizeClass == .compact ? 24 : 32, weight: .bold))
          .foregroundStyle(valueColor)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        if !subtitle.isEmpty {
          Text(subtitle)
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)
        }
      }
      .frame(maxWidth: .infinity, minHeight: 124, alignment: .leading)
    }
  }
}

private struct OperationModalView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  let options: [CoinOption]
  let editing: OperationRow?
  let saving: Bool
  let onSave: (OperationFormData) -> Void
  let onCancel: () -> Void

  @State private var form = OperationFormData()
  @State private var coinQuery = ""
  @State private var showCoinList = false
  @State private var searchResults: [CoinSearchRow] = []
  @State private var searching = false
  @State private var searchError: String?
  @State private var searchTask: Task<Void, Never>?

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          VStack(alignment: .leading, spacing: 8) {
            Text("Criptomoeda")
              .font(.caption)
              .foregroundStyle(AppTheme.subtleText)
            TextField("Buscar por nome ou símbolo...", text: $coinQuery)
              .textFieldStyle(.roundedBorder)
              .onChange(of: coinQuery) { _, newValue in
                runCoinSearch(query: newValue)
              }
              .disabled(editing != nil)

            if let searchError {
              Text(searchError)
                .font(.caption)
                .foregroundStyle(.red)
            }
            if searching {
              Text("Buscando...")
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
            }
            if showCoinList {
              ScrollView {
                VStack(spacing: 0) {
                  ForEach(searchResults) { opt in
                    Button {
                      selectCoin(opt)
                    } label: {
                      HStack {
                        Text(opt.name)
                          .foregroundStyle(.white)
                        Text(opt.symbol.uppercased())
                          .font(.caption)
                          .foregroundStyle(AppTheme.subtleText)
                        if let px = opt.currentPrice {
                          Text(AppFormatters.currency(px))
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.7))
                        }
                        Spacer()
                      }
                      .padding(.horizontal, 10)
                      .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    Divider().background(.white.opacity(0.08))
                  }
                }
              }
              .frame(maxHeight: 120)
              .background(AppTheme.cardBackground)
              .overlay(
                RoundedRectangle(cornerRadius: 8)
                  .stroke(AppTheme.border, lineWidth: 1)
              )
              .clipShape(RoundedRectangle(cornerRadius: 8))
            }
          }

          VStack(alignment: .leading, spacing: 6) {
            Text("Tipo de Operação").font(.caption).foregroundStyle(AppTheme.subtleText)
            Picker("Tipo", selection: $form.tipo) {
              Text("Compra").tag("compra")
              Text("Venda").tag("venda")
            }
            .pickerStyle(.segmented)
          }

          if horizontalSizeClass == .compact {
            VStack(alignment: .leading, spacing: 10) {
              VStack(alignment: .leading, spacing: 6) {
                Text("Quantidade").font(.caption).foregroundStyle(AppTheme.subtleText)
                TextField("0.00", text: $form.quantidade)
                  .textFieldStyle(.roundedBorder)
              }
              VStack(alignment: .leading, spacing: 6) {
                Text("Preço Unitário (USD)").font(.caption).foregroundStyle(AppTheme.subtleText)
                TextField("0.00", text: $form.precoUnitario)
                  .textFieldStyle(.roundedBorder)
              }
              VStack(alignment: .leading, spacing: 6) {
                Text("Data da Operação").font(.caption).foregroundStyle(AppTheme.subtleText)
                DatePicker("", selection: $form.dataOperacao, displayedComponents: [.date])
                  .labelsHidden()
                  .frame(maxWidth: .infinity, alignment: .leading)
              }
              VStack(alignment: .leading, spacing: 6) {
                Text("Taxa").font(.caption).foregroundStyle(AppTheme.subtleText)
                TextField("0.00", text: $form.taxa)
                  .textFieldStyle(.roundedBorder)
              }
            }
          } else {
            HStack(spacing: 12) {
              VStack(alignment: .leading, spacing: 6) {
                Text("Quantidade").font(.caption).foregroundStyle(AppTheme.subtleText)
                TextField("0.00", text: $form.quantidade)
                  .textFieldStyle(.roundedBorder)
              }
              VStack(alignment: .leading, spacing: 6) {
                Text("Preço Unitário (USD)").font(.caption).foregroundStyle(AppTheme.subtleText)
                TextField("0.00", text: $form.precoUnitario)
                  .textFieldStyle(.roundedBorder)
              }
            }

            HStack(spacing: 12) {
              VStack(alignment: .leading, spacing: 6) {
                Text("Data da Operação").font(.caption).foregroundStyle(AppTheme.subtleText)
                DatePicker("", selection: $form.dataOperacao, displayedComponents: [.date])
                  .labelsHidden()
                  .frame(maxWidth: .infinity, alignment: .leading)
              }
              VStack(alignment: .leading, spacing: 6) {
                Text("Taxa").font(.caption).foregroundStyle(AppTheme.subtleText)
                TextField("0.00", text: $form.taxa)
                  .textFieldStyle(.roundedBorder)
              }
            }
          }

          TextField("Exchange (opcional)", text: $form.exchange)
            .textFieldStyle(.roundedBorder)

          VStack(alignment: .leading, spacing: 6) {
            Text("Notas (opcional)").font(.caption).foregroundStyle(AppTheme.subtleText)
            TextEditor(text: $form.notas)
              .frame(height: 84)
              .padding(8)
              .background(AppTheme.cardBackground)
              .overlay(
                RoundedRectangle(cornerRadius: 8)
                  .stroke(AppTheme.border, lineWidth: 1)
              )
              .clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
        .padding(16)
      }
      .background(AppTheme.pageBackground)
      .navigationTitle(editing == nil ? "Nova Operação" : "Editar Operação")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancelar", action: onCancel)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button(saving ? "Salvando..." : (editing == nil ? "Criar Operação" : "Salvar Alterações")) {
            onSave(form)
          }
          .disabled(saving)
        }
      }
    }
    .onAppear {
      if let editing {
        form = OperationFormData(
          coinId: editing.moedaId.lowercased(),
          nome: editing.nome,
          simbolo: editing.simbolo.uppercased(),
          tipo: editing.tipo.lowercased(),
          quantidade: String(editing.quantidade),
          precoUnitario: String(editing.precoUnitario),
          taxa: String(editing.taxa),
          exchange: editing.exchange ?? "",
          notas: editing.notas ?? "",
          dataOperacao: editing.dataOperacao
        )
        coinQuery = "\(editing.nome) (\(editing.simbolo.uppercased()))"
        showCoinList = false
      } else if let first = options.first {
        form.coinId = first.id
        form.nome = first.nome
        form.simbolo = first.simbolo
        coinQuery = "\(first.nome) (\(first.simbolo.uppercased()))"
      }
    }
    .onDisappear {
      searchTask?.cancel()
    }
  }

  private func selectCoin(_ opt: CoinSearchRow) {
    form.coinId = opt.id
    form.nome = opt.name
    form.simbolo = opt.symbol
    coinQuery = "\(opt.name) (\(opt.symbol.uppercased()))"
    showCoinList = false
    searchResults = []
    searchError = nil
  }

  private func runCoinSearch(query: String) {
    guard editing == nil else { return }
    searchTask?.cancel()
    searchError = nil
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.count < 2 {
      searchResults = []
      searching = false
      showCoinList = false
      return
    }

    showCoinList = true
    searching = true
    searchTask = Task {
      try? await Task.sleep(nanoseconds: 350_000_000)
      if Task.isCancelled { return }
      do {
        let result = try await SupabaseService.shared.searchCoins(query: trimmed, limit: 10)
        if Task.isCancelled { return }
        await MainActor.run {
          searchResults = result
          searching = false
          showCoinList = true
          if result.isEmpty { searchError = "Nenhuma moeda encontrada." }
        }
      } catch {
        if Task.isCancelled { return }
        await MainActor.run {
          searching = false
          searchResults = []
          showCoinList = false
          searchError = "Erro ao buscar moedas."
        }
      }
    }
  }
}
