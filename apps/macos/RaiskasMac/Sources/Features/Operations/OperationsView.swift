import SwiftUI

@MainActor
final class OperationsViewModel: ObservableObject {
  @Published var loading = false
  @Published var error: String?
  @Published var operations: [OperationRow] = []
  @Published var typeFilter: String = "all"
  @Published var search = ""

  func refresh() async {
    loading = true
    defer { loading = false }

    do {
      operations = try await SupabaseService.shared.fetchOperations(limit: 400)
      error = nil
    } catch let err {
      error = err.localizedDescription
    }
  }

  var filtered: [OperationRow] {
    operations.filter { op in
      let byType = typeFilter == "all" || op.tipo == typeFilter
      let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      let bySearch = q.isEmpty || op.nome.lowercased().contains(q) || op.simbolo.lowercased().contains(q)
      return byType && bySearch
    }
  }
}

struct OperationsView: View {
  let embedded: Bool
  @StateObject private var vm = OperationsViewModel()

  init(embedded: Bool = false) {
    self.embedded = embedded
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if !embedded {
        SectionTitle(
          title: "Operações de Criptomoedas",
          subtitle: "Lista de operações com filtros e busca."
        )
      }

      HStack(spacing: 10) {
        Picker("Tipo", selection: $vm.typeFilter) {
          Text("Todos").tag("all")
          Text("Compra").tag("compra")
          Text("Venda").tag("venda")
        }
        .pickerStyle(.segmented)
        .frame(width: 260)

        TextField("Buscar ativo (ex: BTC)", text: $vm.search)
          .textFieldStyle(.roundedBorder)
          .frame(maxWidth: 340)

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
        VStack(spacing: 10) {
          HStack {
            Text("Registros: \(vm.filtered.count)")
              .foregroundStyle(AppTheme.subtleText)
              .font(.caption)
            Spacer()
          }

          Table(vm.filtered) {
            TableColumn("Data") { row in
              Text(row.dataOperacao.formatted(date: .numeric, time: .shortened))
                .foregroundStyle(.white.opacity(0.85))
            }
            TableColumn("Ativo") { row in
              VStack(alignment: .leading, spacing: 2) {
                Text(row.nome).bold().foregroundStyle(.white)
                Text(row.simbolo.uppercased()).font(.caption).foregroundStyle(.white.opacity(0.65))
              }
            }
            TableColumn("Tipo") { row in
              Text(row.tipo.uppercased())
                .foregroundStyle(row.tipo == "compra" ? .green : .red)
            }
            TableColumn("Qtd") { row in
              Text(String(format: "%.6f", row.quantidade)).foregroundStyle(.white.opacity(0.85))
            }
            TableColumn("Preço") { row in
              Text(currency(row.precoUnitario)).foregroundStyle(.white.opacity(0.85))
            }
            TableColumn("Total") { row in
              Text(currency(row.valorTotal)).foregroundStyle(.white.opacity(0.85))
            }
            TableColumn("Exchange") { row in
              Text(row.exchange ?? "-").foregroundStyle(.white.opacity(0.7))
            }
          }
          .tableStyle(.inset(alternatesRowBackgrounds: true))
          .scrollContentBackground(.hidden)
          .frame(maxHeight: .infinity)
        }
      }

      Spacer(minLength: 0)
    }
    .padding(20)
    .background(AppTheme.pageBackground)
    .task {
      if vm.operations.isEmpty {
        await vm.refresh()
      }
    }
  }

  private func currency(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "USD"
    formatter.maximumFractionDigits = 2
    return formatter.string(from: NSNumber(value: value)) ?? "$0.00"
  }
}
