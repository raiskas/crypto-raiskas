import Foundation

@MainActor
final class PortfolioViewModel: ObservableObject {
  @Published var loading = false
  @Published var generatingHistory = false
  @Published var error: String?
  @Published var warning: String?
  @Published var summary = WalletSummary(nome: "Carteira Principal", patrimonioTotal: 0, aporteTotal: 0, resultadoTotal: 0, resultadoPercentual: 0)
  @Published var history: [WalletSnapshotPoint] = []
  @Published var domainX: ClosedRange<Date> = Date() ... Date()
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
      var mergedPrices = prices
      for ticker in tickers {
        mergedPrices[ticker.id.lowercased()] = ticker.price
      }
      prices = mergedPrices

      if let first = history.first?.date, let last = history.last?.date {
        domainX = first ... last
      } else {
        let now = Date()
        domainX = now ... now
      }
      updatedAt = Date()
      error = nil
      warning = marketWarning
    } catch let err {
      error = err.localizedDescription
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

  func closestPoint(to date: Date) -> WalletSnapshotPoint? {
    guard !history.isEmpty else { return nil }
    return history.min { lhs, rhs in
      abs(lhs.date.timeIntervalSince(date)) < abs(rhs.date.timeIntervalSince(date))
    }
  }

  var updatedAtText: String {
    guard let updatedAt else { return "-" }
    return updatedAt.formatted(date: .numeric, time: .standard)
  }

  var exposureCount: Int {
    assetStats.filter { $0.marketValue > 0.0001 }.count
  }

  var gainersCount: Int {
    assetStats.filter { $0.unrealized > 0 }.count
  }

  var losersCount: Int {
    assetStats.filter { $0.unrealized < 0 }.count
  }

  var marketValue: Double {
    assetStats.reduce(0.0) { $0 + $1.marketValue }
  }

  var unrealizedTotal: Double {
    assetStats.reduce(0.0) { $0 + $1.unrealized }
  }

  var currentCash: Double {
    var cash = walletConfig?.valorInicial ?? summary.aporteTotal
    for aporte in aportes {
      cash += aporte.valor
    }
    for op in operations {
      if op.tipo.lowercased() == "compra" {
        cash -= (op.valorTotal + op.taxa)
      } else {
        cash += (op.valorTotal - op.taxa)
      }
    }
    return cash
  }

  var patrimonioTotal: Double {
    currentCash + marketValue
  }

  var resultadoTotal: Double {
    patrimonioTotal - summary.aporteTotal
  }

  var resultadoPct: Double {
    summary.aporteTotal > 0 ? (resultadoTotal / summary.aporteTotal) * 100 : 0
  }

  private var assetStats: [(marketValue: Double, unrealized: Double)] {
    struct Lot {
      var qty: Double
      let costUnit: Double
    }

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
          if first.qty <= 1e-9 {
            lots.removeFirst()
          } else {
            lots[0] = first
          }
        }
      }
      lotsByCoin[coin] = lots
    }

    let opFallbackPriceByCoin = latestOperationPriceByCoin

    return lotsByCoin.map { coin, lots in
      let px = prices[coin] ?? opFallbackPriceByCoin[coin] ?? 0
      let market = lots.reduce(0.0) { $0 + ($1.qty * px) }
      let cost = lots.reduce(0.0) { $0 + ($1.qty * $1.costUnit) }
      return (market, market - cost)
    }
  }

  private var latestOperationPriceByCoin: [String: Double] {
    var out: [String: Double] = [:]
    for op in operations.sorted(by: { $0.dataOperacao > $1.dataOperacao }) {
      let key = op.moedaId.lowercased()
      if out[key] == nil, op.precoUnitario > 0 {
        out[key] = op.precoUnitario
      }
    }
    return out
  }
}
