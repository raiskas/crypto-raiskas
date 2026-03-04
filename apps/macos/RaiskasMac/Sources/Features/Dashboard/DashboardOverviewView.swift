import Charts
import SwiftUI

@MainActor
final class DashboardOverviewViewModel: ObservableObject {
  @Published var loading = false
  @Published var error: String?
  @Published var summary = DashboardSummary(patrimonio: 0, aporte: 0, resultado: 0, resultadoPct: 0, totalOperacoes: 0)
  @Published var miniSeries: [WalletSnapshotPoint] = []

  func refresh() async {
    loading = true
    defer { loading = false }

    do {
      summary = try await SupabaseService.shared.fetchDashboardSummary()
      let wallet = try await SupabaseService.shared.fetchWalletSummaryAndHistory(months: 3)
      miniSeries = wallet.1
      error = nil
    } catch let err {
      error = err.localizedDescription
    }
  }
}

struct DashboardOverviewView: View {
  @StateObject private var vm = DashboardOverviewViewModel()

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      SectionTitle(
        title: "Dashboard",
        subtitle: "Resumo executivo da carteira e atividade operacional."
      )

      HStack(spacing: 12) {
        StatCard(title: "Patrimônio", value: AppFormatters.currency(vm.summary.patrimonio), color: .blue)
        StatCard(title: "Aporte", value: AppFormatters.currency(vm.summary.aporte), color: .orange)
        StatCard(title: "Resultado", value: "\(AppFormatters.signedCurrency(vm.summary.resultado)) (\(AppFormatters.percent(vm.summary.resultadoPct)))", color: vm.summary.resultado >= 0 ? .green : .red)
        StatCard(title: "Operações", value: "\(vm.summary.totalOperacoes)", color: .white)
      }

      HStack {
        Button(vm.loading ? "Atualizando..." : "Atualizar") {
          Task { await vm.refresh() }
        }
        .buttonStyle(.borderedProminent)
        .disabled(vm.loading)

        if let error = vm.error {
          Text(error)
            .foregroundStyle(.red)
            .font(.caption)
        }
      }

      AppCard {
        VStack(alignment: .leading, spacing: 10) {
          Text("Evolução (3M)")
            .font(.subheadline.bold())
            .foregroundStyle(AppTheme.strongText)

          if vm.miniSeries.isEmpty {
            Text("Sem dados de histórico para o período.")
              .foregroundStyle(AppTheme.subtleText)
              .font(.caption)
          } else {
            Chart(vm.miniSeries) { item in
              LineMark(
                x: .value("Data", item.date),
                y: .value("Carteira", item.carteira)
              )
              .foregroundStyle(.blue)
              .lineStyle(.init(lineWidth: 2.6))
            }
            .chartLegend(.hidden)
            .chartXAxis {
              AxisMarks(values: .automatic(desiredCount: 6))
            }
            .chartYAxis {
              AxisMarks(position: .trailing)
            }
            .frame(height: 220)
          }
        }
      }

      Spacer(minLength: 0)
    }
    .padding(20)
    .background(AppTheme.pageBackground)
    .task {
      if vm.summary.totalOperacoes == 0 {
        await vm.refresh()
      }
    }
  }
}
