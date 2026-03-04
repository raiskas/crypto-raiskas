import SwiftUI

@MainActor
final class MarketViewModel: ObservableObject {
  @Published var loading = false
  @Published var error: String?
  @Published var tickers: [MarketTicker] = []

  func refresh() async {
    loading = true
    defer { loading = false }

    do {
      tickers = try await SupabaseService.shared.fetchMarketTickers()
      error = nil
    } catch {
      self.error = "Falha ao carregar preços: \(error.localizedDescription)"
    }
  }
}

struct MarketView: View {
  let embedded: Bool
  @StateObject private var vm = MarketViewModel()

  init(embedded: Bool = false) {
    self.embedded = embedded
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        if !embedded {
          SectionTitle(
            title: "Preços de Mercado",
            subtitle: "Acompanhamento de mercado para os principais ativos."
          )
        }

        Spacer()

        Button(vm.loading ? "Atualizando..." : "Atualizar") {
          Task { await vm.refresh() }
        }
        .buttonStyle(.borderedProminent)
        .disabled(vm.loading)
      }

      if let error = vm.error {
        Text(error)
          .foregroundStyle(.red)
          .font(.caption)
      }

      AppCard {
        Table(vm.tickers) {
          TableColumn("Ativo") { row in
            VStack(alignment: .leading, spacing: 2) {
              Text(row.name).bold().foregroundStyle(.white)
              Text(row.symbol).font(.caption).foregroundStyle(.white.opacity(0.65))
            }
          }
          TableColumn("Preço") { row in
            Text(AppFormatters.currency(row.price)).foregroundStyle(.white)
          }
          TableColumn("24h") { row in
            Text(AppFormatters.percent(row.change24hPct))
              .foregroundStyle(row.change24hPct >= 0 ? .green : .red)
          }
          TableColumn("Máx 24h") { row in
            Text(AppFormatters.currency(row.high24h)).foregroundStyle(.white.opacity(0.85))
          }
          TableColumn("Mín 24h") { row in
            Text(AppFormatters.currency(row.low24h)).foregroundStyle(.white.opacity(0.85))
          }
          TableColumn("Atualizado") { row in
            Text(row.updatedAt.formatted(date: .numeric, time: .shortened))
              .foregroundStyle(.white.opacity(0.7))
          }
        }
        .tableStyle(.inset(alternatesRowBackgrounds: true))
        .scrollContentBackground(.hidden)
      }

      Spacer()
    }
    .padding(20)
    .background(AppTheme.pageBackground)
    .task {
      if vm.tickers.isEmpty {
        await vm.refresh()
      }
    }
  }
}
