import SwiftUI

struct HomePerformanceSummary {
  let valorTotalAtual: Double
  let totalInvestido: Double
  let totalNaoRealizado: Double
  let totalRealizado: Double
}

@MainActor
final class HomeViewModel: ObservableObject {
  @Published var loadingPerformance = true
  @Published var errorPerformance: String?
  @Published var performance = HomePerformanceSummary(
    valorTotalAtual: 0,
    totalInvestido: 0,
    totalNaoRealizado: 0,
    totalRealizado: 0
  )

  @Published var loadingTopMoedas = true
  @Published var errorTopMoedas: String?
  @Published var topMoedas: [MarketTicker] = []

  private let top10Ids = [
    "bitcoin", "ethereum", "tether", "binancecoin", "solana",
    "usd-coin", "ripple", "staked-ether", "dogecoin", "cardano",
  ]

  func carregarTudo() async {
    await withTaskGroup(of: Void.self) { group in
      group.addTask { await self.carregarPerformance() }
      group.addTask { await self.carregarTopMoedas() }
    }
  }

  func carregarTopMoedas() async {
    loadingTopMoedas = true
    errorTopMoedas = nil
    do {
      topMoedas = try await SupabaseService.shared.fetchMarketTickers(ids: top10Ids)
    } catch {
      errorTopMoedas = "Mercado instável. Exibindo último snapshot disponível."
      topMoedas = []
    }
    loadingTopMoedas = false
  }

  func carregarPerformance() async {
    loadingPerformance = true
    errorPerformance = nil

    do {
      let operacoes = try await SupabaseService.shared.fetchOperations(limit: 10_000)
      if operacoes.isEmpty {
        performance = HomePerformanceSummary(valorTotalAtual: 0, totalInvestido: 0, totalNaoRealizado: 0, totalRealizado: 0)
        loadingPerformance = false
        return
      }

      let coinIds = Array(Set(operacoes.map { $0.moedaId.lowercased() }))
      var latestPriceByCoin: [String: Double] = [:]
      for op in operacoes.sorted(by: { $0.dataOperacao > $1.dataOperacao }) {
        let key = op.moedaId.lowercased()
        if latestPriceByCoin[key] == nil, op.precoUnitario > 0 {
          latestPriceByCoin[key] = op.precoUnitario
        }
      }

      var priceByCoin: [String: Double] = [:]
      do {
        let market = try await SupabaseService.shared.fetchMarketTickers(ids: coinIds)
        priceByCoin = Dictionary(uniqueKeysWithValues: market.map { ($0.id.lowercased(), $0.price) })
      } catch {
        errorPerformance = "Falha parcial ao buscar mercado. Usando último preço das operações."
      }

      struct Lot {
        var qty: Double
        let costUnit: Double
      }

      var lotsByCoin: [String: [Lot]] = [:]
      var realized = 0.0

      for op in operacoes.sorted(by: { $0.dataOperacao < $1.dataOperacao }) {
        let coin = op.moedaId.lowercased()
        var lots = lotsByCoin[coin] ?? []

        if op.tipo.lowercased() == "compra" {
          let qty = max(op.quantidade, 0)
          let totalCost = op.valorTotal + op.taxa
          let unitCost = qty > 0 ? totalCost / qty : 0
          lots.append(Lot(qty: qty, costUnit: unitCost))
        } else {
          var qtyToSell = max(op.quantidade, 0)
          let proceedsUnit = op.quantidade > 0 ? ((op.valorTotal - op.taxa) / op.quantidade) : 0

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
        }

        lotsByCoin[coin] = lots
      }

      var marketValue = 0.0
      var costBasis = 0.0

      for (coin, lots) in lotsByCoin {
        let px = priceByCoin[coin] ?? latestPriceByCoin[coin] ?? 0
        for lot in lots {
          marketValue += lot.qty * px
          costBasis += lot.qty * lot.costUnit
        }
      }

      let unrealized = marketValue - costBasis
      performance = HomePerformanceSummary(
        valorTotalAtual: marketValue,
        totalInvestido: costBasis,
        totalNaoRealizado: unrealized,
        totalRealizado: realized
      )
    } catch {
      errorPerformance = error.localizedDescription
      performance = HomePerformanceSummary(valorTotalAtual: 0, totalInvestido: 0, totalNaoRealizado: 0, totalRealizado: 0)
    }

    loadingPerformance = false
  }
}

struct HomeView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @EnvironmentObject var appState: AppState
  @StateObject private var vm = HomeViewModel()

  private var username: String {
    appState.currentUserEmail.split(separator: "@").first.map(String.init) ?? "Usuário"
  }

  private var totalPortfolioValue: String {
    vm.loadingPerformance
      ? "Carregando..."
      : "$ \(AppFormatters.currency(vm.performance.valorTotalAtual).replacingOccurrences(of: "$", with: ""))"
  }

  private var totalCostValue: String {
    vm.loadingPerformance
      ? "Carregando..."
      : "$ \(AppFormatters.currency(vm.performance.totalInvestido).replacingOccurrences(of: "$", with: ""))"
  }

  private var unrealizedValue: String {
    guard !vm.loadingPerformance else { return "Carregando..." }
    let sign = vm.performance.totalNaoRealizado >= 0 ? "+" : "-"
    return "\(sign) $ \(AppFormatters.currency(abs(vm.performance.totalNaoRealizado)).replacingOccurrences(of: "$", with: ""))"
  }

  private var realizedValue: String {
    guard !vm.loadingPerformance else { return "Carregando..." }
    let sign = vm.performance.totalRealizado >= 0 ? "+" : "-"
    return "\(sign) $ \(AppFormatters.currency(abs(vm.performance.totalRealizado)).replacingOccurrences(of: "$", with: ""))"
  }

  var body: some View {
    ZStack(alignment: .topLeading) {
      AppTheme.pageBackground.ignoresSafeArea()
      ScrollView {
        VStack(alignment: .leading, spacing: AppLayout.pageSpacing) {
          SectionTitle(
            title: "Dashboard",
            subtitle: "Bem-vindo, \(username)\nAqui está um resumo do seu portfólio."
          )

          if let error = vm.errorPerformance {
            AppCard {
              HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                  .foregroundStyle(.red)
                Text("Erro ao carregar resumo do portfólio: \(error)")
                  .font(.caption)
                  .foregroundStyle(.red)
              }
            }
          }

          VStack(spacing: 10) {
            HomeMetricCard(title: "Total Portfólio", value: totalPortfolioValue, subtitle: "Valor atual de mercado", icon: "wallet.pass")
            HomeMetricCard(title: "Custo Base Total", value: totalCostValue, subtitle: "Custo total de aquisição", icon: "creditcard")
            HomeMetricCard(
              title: "L/P Não Realizado",
              value: unrealizedValue,
              subtitle: "Ganhos/Perdas em ativos atuais",
              icon: vm.performance.totalNaoRealizado >= 0 ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis",
              valueColor: vm.performance.totalNaoRealizado >= 0 ? .green : .red
            )
            HomeMetricCard(title: "L/P Realizado", value: realizedValue, subtitle: "Ganhos/Perdas de vendas", icon: "bitcoinsign.circle")
          }

          HomeTop10Card(
            loading: vm.loadingTopMoedas,
            error: vm.errorTopMoedas,
            moedas: vm.topMoedas,
            onRefresh: { Task { await vm.carregarTopMoedas() } }
          )
        }
        .padding(.horizontal, horizontalSizeClass == .compact ? AppLayout.pageHorizontalCompact : AppLayout.pageHorizontalRegular)
        .padding(.top, AppLayout.pageSpacing)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .tabBarSafeAreaInset()
    .task {
      await vm.carregarTudo()
    }
  }
}

private struct HomeTop10Card: View {
  let loading: Bool
  let error: String?
  let moedas: [MarketTicker]
  let onRefresh: () -> Void

  private var rankedMoedas: [RankedTicker] {
    moedas.enumerated().map { index, item in
      RankedTicker(rank: index + 1, ticker: item)
    }
  }

  var body: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 12) {
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text("Top 10 Criptomoedas")
              .font(.title3.bold())
              .foregroundStyle(AppTheme.strongText)
            Text("Valores atualizados do mercado")
              .font(.caption)
              .foregroundStyle(AppTheme.subtleText)
          }
          Spacer()
          Button {
            onRefresh()
          } label: {
            Label(loading ? "Atualizando..." : "Atualizar", systemImage: "arrow.clockwise")
          }
          .buttonStyle(.bordered)
          .disabled(loading)
        }

        if let error {
          HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
              .foregroundStyle(.red)
            Text("Erro ao carregar top moedas: \(error)")
              .font(.caption)
              .foregroundStyle(.red)
          }
          .padding(.bottom, 4)
        }

        if loading {
          Text("Carregando top criptomoedas...")
            .foregroundStyle(AppTheme.subtleText)
            .padding(.vertical, 10)
        } else if moedas.isEmpty {
          Text("Nenhuma informação disponível")
            .foregroundStyle(AppTheme.subtleText)
            .padding(.vertical, 10)
        } else {
          VStack(spacing: 8) {
            ForEach(rankedMoedas) { row in
              HStack(spacing: 10) {
                Text("#\(row.rank)")
                  .font(.caption)
                  .foregroundStyle(.white.opacity(0.8))
                  .frame(width: 24, alignment: .leading)

                AsyncImage(url: URL(string: row.ticker.imageURL ?? "")) { image in
                  image.resizable().scaledToFit()
                } placeholder: {
                  Circle().fill(Color.white.opacity(0.12))
                }
                .frame(width: 18, height: 18)

                VStack(alignment: .leading, spacing: 1) {
                  Text(row.ticker.name)
                    .foregroundStyle(.white)
                  Text(row.ticker.symbol.uppercased())
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                  Text("$ \(AppFormatters.currency(row.ticker.price).replacingOccurrences(of: "$", with: ""))")
                    .foregroundStyle(.white)
                    .font(.subheadline.bold())
                  Text("\(String(format: "%.2f", row.ticker.change24hPct))%")
                    .foregroundStyle(row.ticker.change24hPct >= 0 ? .green : .red)
                    .font(.caption)
                }
              }
              Divider().overlay(AppTheme.border.opacity(0.45))
            }
          }
        }
      }
    }
  }
}

private struct RankedTicker: Identifiable {
  let rank: Int
  let ticker: MarketTicker
  var id: String { ticker.id }
}

private struct HomeMetricCard: View {
  let title: String
  let value: String
  let subtitle: String
  let icon: String
  var valueColor: Color = .white

  var body: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text(title)
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)
          Spacer()
          Image(systemName: icon)
            .font(.caption)
            .foregroundStyle(.white.opacity(0.55))
        }
        Text(value)
          .font(.title3.bold())
          .foregroundStyle(valueColor)
        Text(subtitle)
          .font(.caption2)
          .foregroundStyle(AppTheme.subtleText)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}
