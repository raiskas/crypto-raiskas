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

enum OperationSortColumn {
  case data
  case nome
  case quantidade
  case valorTotal
  case valorAtualizado
  case lucro
  case percentual
}

enum SortDirection {
  case asc
  case desc
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
  @Published var sortColumn: OperationSortColumn = .data
  @Published var sortDirection: SortDirection = .desc

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
        for (coin, fallback) in latestOperationPriceByCoin {
          if merged[coin] == nil {
            merged[coin] = fallback
          }
        }
        prices = merged
      } catch {
        var merged = prices
        for (coin, fallback) in latestOperationPriceByCoin {
          if merged[coin] == nil {
            merged[coin] = fallback
          }
        }
        prices = merged
        self.error = "Dados de mercado instáveis. Exibindo último preço conhecido."
      }
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
    for item in defaultCoins {
      map[item.id] = item
    }
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
          if first.qty <= 1e-9 {
            lots.removeFirst()
          } else {
            lots[0] = first
          }
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
          if first.qty <= 1e-9 {
            lots.removeFirst()
          } else {
            lots[0] = first
          }
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

    let mapped = filtered.map { op in
      let coin = op.moedaId.lowercased()
      let px = prices[coin] ?? latestOperationPriceByCoin[coin] ?? 0
      let totalAtual = op.quantidade * px
      let pnl: Double
      if op.tipo.lowercased() == "compra" {
        pnl = totalAtual - op.valorTotal
      } else {
        pnl = realizedByOp[op.id, default: 0]
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
    }

    return mapped.sorted { lhs, rhs in
      let result: Bool
      switch sortColumn {
      case .data:
        result = lhs.data < rhs.data
      case .nome:
        result = lhs.nome.localizedCaseInsensitiveCompare(rhs.nome) == .orderedAscending
      case .quantidade:
        result = lhs.qtd < rhs.qtd
      case .valorTotal:
        result = lhs.totalOp < rhs.totalOp
      case .valorAtualizado:
        result = lhs.valorTotalAtual < rhs.valorTotalAtual
      case .lucro:
        result = lhs.lucro < rhs.lucro
      case .percentual:
        result = lhs.pct < rhs.pct
      }
      return sortDirection == .asc ? result : !result
    }
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

  func requestSort(_ column: OperationSortColumn) {
    if sortColumn == column {
      sortDirection = sortDirection == .asc ? .desc : .asc
    } else {
      sortColumn = column
      sortDirection = .desc
    }
  }
}

struct CryptoRootView: View {
  @StateObject private var vm = CryptoRootViewModel()
  @State private var editing: OperationRow?
  @State private var deletingId: UUID?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        header
        summaryCards
        portfolioBlock
        operationsHeader
        operationsBlock
      }
      .padding(20)
      .frame(maxWidth: .infinity, alignment: .topLeading)
    }
    .background(AppTheme.pageBackground)
    .task {
      if vm.operations.isEmpty {
        await vm.refresh()
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: .openCryptoNewOperation)) { _ in
      editing = nil
      openOperationWindow()
    }
  }

  private var header: some View {
    HStack {
      SectionTitle(
        title: "Gerenciamento de Criptomoedas",
        subtitle: "Controle suas operações de compra e venda"
      )
      Spacer()
      Button {
        editing = nil
        openOperationWindow()
      } label: {
        Label("Nova Operação", systemImage: "plus")
      }
      .buttonStyle(.borderedProminent)
    }
  }

  private var summaryCards: some View {
    let s = vm.summary
    return HStack(spacing: 12) {
      CryptoMetricCard(
        title: "Total Portfólio",
        value: AppFormatters.currency(s.portfolio),
        subtitle: "",
        icon: "wallet.pass",
        valueColor: .white
      )
      CryptoMetricCard(
        title: "Total Investido",
        value: AppFormatters.currency(s.invested),
        subtitle: "",
        icon: "creditcard",
        valueColor: .white
      )
      CryptoMetricCard(
        title: "L/P Não Realizado",
        value: AppFormatters.currency(s.unrealized),
        subtitle: "(\(AppFormatters.percent(s.unrealizedPct)))",
        icon: s.unrealized >= 0 ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis",
        valueColor: s.unrealized >= 0 ? .green : .red
      )
      CryptoMetricCard(
        title: "L/P Realizado",
        value: AppFormatters.currency(s.realized),
        subtitle: "Total desde o início",
        icon: "bitcoinsign.circle",
        valueColor: s.realized >= 0 ? .green : .red
      )
    }
  }

  private var portfolioBlock: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text("Meu Portfólio")
              .font(.title3.bold())
              .foregroundStyle(AppTheme.strongText)
            Text("Visão consolidada por criptomoeda")
              .font(.subheadline)
              .foregroundStyle(AppTheme.subtleText)
          }
          Spacer()
          Button(vm.loading ? "Atualizando..." : "Atualizar") {
            Task { await vm.refresh() }
          }
          .buttonStyle(.bordered)
        }

        Table(vm.portfolioRows) {
          TableColumn("Moeda") { row in
            Text("\(row.nome) (\(row.simbolo))")
              .foregroundStyle(.white)
          }
          TableColumn("Qtde Atual") { row in Text(number(row.quantidade, 4)).foregroundStyle(.white.opacity(0.88)) }
          TableColumn("Custo Médio (FIFO)") { row in Text(AppFormatters.currency(row.custoMedio)).foregroundStyle(.white.opacity(0.88)) }
          TableColumn("Custo Base Atual") { row in Text(AppFormatters.currency(row.custoBase)).foregroundStyle(.white.opacity(0.88)) }
          TableColumn("Preço Atual") { row in Text(AppFormatters.currency(row.precoAtual)).foregroundStyle(.white.opacity(0.88)) }
          TableColumn("Valor Total Atual") { row in Text(AppFormatters.currency(row.valorAtual)).foregroundStyle(.white) }
          TableColumn("L/P Não Realizado") { row in
            Text(AppFormatters.signedCurrency(row.naoRealizado))
              .foregroundStyle(row.naoRealizado >= 0 ? .green : .red)
          }
          TableColumn("% Não Realizado") { row in
            Text(AppFormatters.percent(row.naoRealizadoPct))
              .foregroundStyle(row.naoRealizado >= 0 ? .green : .red)
          }
          TableColumn("L/P Realizado (Total)") { row in
            Text(AppFormatters.signedCurrency(row.realizado))
              .foregroundStyle(row.realizado >= 0 ? .green : .red)
          }
        }
        .tableStyle(.inset(alternatesRowBackgrounds: true))
        .scrollContentBackground(.hidden)
        .frame(minHeight: 240, maxHeight: 300)
      }
    }
  }

  private var operationsHeader: some View {
    HStack {
      Picker("", selection: $vm.filter) {
        ForEach(OpsFilter.allCases) { item in
          Text(item.label).tag(item)
        }
      }
      .pickerStyle(.segmented)
      .frame(width: 240)

      Spacer()

      TextField("Buscar moeda ou exchange...", text: $vm.search)
        .textFieldStyle(.roundedBorder)
        .frame(width: 320)
    }
  }

  private var operationsBlock: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text("Minhas Operações")
              .font(.title3.bold())
              .foregroundStyle(AppTheme.strongText)
            Text("Registro de suas compras e vendas de criptomoedas")
              .font(.subheadline)
              .foregroundStyle(AppTheme.subtleText)
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
              openOperationWindow()
            } label: {
              Label("Adicionar Operação", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
          }
          .frame(maxWidth: .infinity, minHeight: 220)
        } else {
          operationsGrid
            .frame(minHeight: 360)
        }
      }
    }
  }

  private var operationsGrid: some View {
    ScrollView([.horizontal, .vertical]) {
      VStack(alignment: .leading, spacing: 0) {
        operationsHeaderRow
        Divider().background(AppTheme.border)
        ForEach(vm.operationRows) { row in
          operationsDataRow(row)
          Divider().background(AppTheme.border.opacity(0.5))
        }
      }
    }
    .background(AppTheme.cardBackground)
    .clipShape(RoundedRectangle(cornerRadius: 10))
    .overlay(
      RoundedRectangle(cornerRadius: 10).stroke(AppTheme.border, lineWidth: 1)
    )
  }

  private var operationsHeaderRow: some View {
    HStack(spacing: 0) {
      sortableHeader("Data", width: 132, column: .data)
      textHeader("Tipo", width: 90)
      sortableHeader("Moeda", width: 160, column: .nome)
      sortableHeader("Qtde", width: 110, column: .quantidade)
      textHeader("Valor Op.", width: 120)
      sortableHeader("Total Op.", width: 130, column: .valorTotal)
      if vm.filter == .compra {
        textHeader("Valor Atual", width: 120)
        sortableHeader("Valor Total Atual", width: 150, column: .valorAtualizado)
        sortableHeader("Lucro/Prejuízo", width: 145, column: .lucro)
        sortableHeader("%", width: 90, column: .percentual)
      }
      textHeader("Exchange", width: 130)
      textHeader("Ações", width: 170)
    }
    .frame(height: 42)
  }

  private func operationsDataRow(_ row: OperationMetricRow) -> some View {
    HStack(spacing: 0) {
      cell(formattedDate(row.data), width: 132, color: .white.opacity(0.92))
      cell(row.tipo.lowercased() == "compra" ? "Compra" : "Venda", width: 90, color: row.tipo.lowercased() == "compra" ? .green : .red, bold: true)
      cell("\(row.nome) (\(row.simbolo))", width: 160, color: .white)
      cell(number(row.qtd, 6), width: 110, color: .white.opacity(0.92))
      cell(AppFormatters.currency(row.valorOp), width: 120, color: .white.opacity(0.92))
      cell(AppFormatters.currency(row.totalOp), width: 130, color: .white.opacity(0.92))
      if vm.filter == .compra {
        cell(AppFormatters.currency(row.precoAtual), width: 120, color: .white.opacity(0.92))
        cell(AppFormatters.currency(row.valorTotalAtual), width: 150, color: .white.opacity(0.92))
        cell(AppFormatters.signedCurrency(row.lucro), width: 145, color: row.lucro >= 0 ? .green : .red)
        cell(AppFormatters.percent(row.pct), width: 90, color: row.pct >= 0 ? .green : .red)
      }
      cell(row.exchange, width: 130, color: .white.opacity(0.85))
      HStack(spacing: 6) {
        Button("Editar") {
          if let raw = vm.operations.first(where: { $0.id == row.id }) {
            editing = raw
            openOperationWindow()
          }
        }
        .buttonStyle(.bordered)
        .controlSize(.small)

        Button("Excluir") {
          deletingId = row.id
          openDeleteOperationWindow()
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .tint(.red)
      }
      .frame(width: 170, alignment: .leading)
      .padding(.horizontal, 8)
    }
    .frame(height: 44)
  }

  private func sortableHeader(_ title: String, width: CGFloat, column: OperationSortColumn) -> some View {
    Button {
      vm.requestSort(column)
    } label: {
      HStack(spacing: 6) {
        Text(title)
          .font(.footnote.weight(.semibold))
          .foregroundStyle(AppTheme.subtleText)
        Image(systemName: sortIcon(for: column))
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(AppTheme.subtleText.opacity(vm.sortColumn == column ? 1 : 0.35))
      }
      .frame(width: width, alignment: .leading)
      .padding(.horizontal, 8)
    }
    .buttonStyle(.plain)
  }

  private func textHeader(_ title: String, width: CGFloat) -> some View {
    Text(title)
      .font(.footnote.weight(.semibold))
      .foregroundStyle(AppTheme.subtleText)
      .frame(width: width, alignment: .leading)
      .padding(.horizontal, 8)
  }

  private func cell(_ value: String, width: CGFloat, color: Color, bold: Bool = false) -> some View {
    Text(value)
      .font(.footnote.weight(bold ? .semibold : .regular))
      .foregroundStyle(color)
      .lineLimit(1)
      .frame(width: width, alignment: .leading)
      .padding(.horizontal, 8)
  }

  private func sortIcon(for column: OperationSortColumn) -> String {
    guard vm.sortColumn == column else { return "arrow.up.arrow.down" }
    return vm.sortDirection == .asc ? "arrow.up" : "arrow.down"
  }

  private func openOperationWindow() {
    AppWindowPresenter.shared.present(
      id: "crypto_operation_modal",
      title: editing == nil ? "Nova Operação" : "Editar Operação",
      size: CGSize(width: 920, height: 640),
      resizable: true
    ) {
      OperationModalView(
        options: vm.coinOptions,
        editing: editing,
        saving: vm.saving,
        onSave: { form in
          Task {
            await vm.saveOperation(editingId: editing?.id, form: form)
            if vm.error == nil {
              editing = nil
              AppWindowPresenter.shared.dismiss(id: "crypto_operation_modal")
            }
          }
        },
        onCancel: {
          editing = nil
          AppWindowPresenter.shared.dismiss(id: "crypto_operation_modal")
        }
      )
    }
  }

  private func openDeleteOperationWindow() {
    guard deletingId != nil else { return }
    AppWindowPresenter.shared.present(
      id: "crypto_delete_operation_confirm",
      title: "Excluir Operação",
      size: CGSize(width: 500, height: 230),
      resizable: false
    ) {
      AppConfirmDialogWindow(
        title: "Excluir operação?",
        message: "Essa ação remove a operação de forma permanente.",
        confirmLabel: "Excluir",
        confirmRole: .destructive,
        onCancel: {
          deletingId = nil
          AppWindowPresenter.shared.dismiss(id: "crypto_delete_operation_confirm")
        },
        onConfirm: {
          guard let id = deletingId else { return }
          Task {
            await vm.deleteOperation(id: id)
            deletingId = nil
            AppWindowPresenter.shared.dismiss(id: "crypto_delete_operation_confirm")
          }
        }
      )
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
          .font(.system(size: 39, weight: .bold))
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
    AppModalContainer(
      title: editing == nil ? "Nova Operação" : "Editar Operação",
      subtitle: editing == nil
        ? "Adicione uma nova operação de compra ou venda."
        : "Modifique os detalhes da sua operação.",
      width: 860
    ) {
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
        .frame(width: 220)
      }

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
        VStack(alignment: .leading, spacing: 6) {
          Text("Valor Total (USD)").font(.caption).foregroundStyle(AppTheme.subtleText)
          Text(AppFormatters.currency(calculatedTotal))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(AppTheme.cardBackground)
            .overlay(
              RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
      }

      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 6) {
          Text("Data da Operação").font(.caption).foregroundStyle(AppTheme.subtleText)
          DatePicker(
            "",
            selection: $form.dataOperacao,
            displayedComponents: [.date]
          )
          .labelsHidden()
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        VStack(alignment: .leading, spacing: 6) {
          Text("Exchange (opcional)").font(.caption).foregroundStyle(AppTheme.subtleText)
          TextField("Binance, Coinbase...", text: $form.exchange)
            .textFieldStyle(.roundedBorder)
        }
        VStack(alignment: .leading, spacing: 6) {
          Text("Taxa").font(.caption).foregroundStyle(AppTheme.subtleText)
          TextField("0.00", text: $form.taxa)
            .textFieldStyle(.roundedBorder)
        }
      }

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

      HStack {
        Spacer()
        Button("Cancelar", action: onCancel)
          .buttonStyle(.bordered)
        Button(saving ? "Salvando..." : (editing == nil ? "Criar Operação" : "Salvar Alterações")) {
          onSave(form)
        }
        .buttonStyle(.borderedProminent)
        .disabled(saving)
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

  private var calculatedTotal: Double {
    let qtd = Double(form.quantidade.replacingOccurrences(of: ",", with: ".")) ?? 0
    let price = Double(form.precoUnitario.replacingOccurrences(of: ",", with: ".")) ?? 0
    return qtd * price
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
          if result.isEmpty {
            searchError = "Nenhuma moeda encontrada."
          }
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
