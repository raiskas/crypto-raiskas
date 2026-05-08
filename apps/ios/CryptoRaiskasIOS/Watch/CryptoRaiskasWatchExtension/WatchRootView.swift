import SwiftUI

struct WatchRootView: View {
  var body: some View {
    TabView {
      WatchHomeView()
      WatchCryptoView()
      WatchCarteiraView()
    }
    .tabViewStyle(.verticalPage)
  }
}

private struct Header: View {
  let title: String
  var body: some View {
    Text(title)
      .font(.headline)
      .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct MetricRow: View {
  let label: String
  let value: String
  let valueColor: Color

  var body: some View {
    HStack {
      Text(label)
        .foregroundStyle(.secondary)
      Spacer(minLength: 8)
      Text(value)
        .foregroundStyle(valueColor)
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .font(.caption2)
  }
}

private func currency(_ value: Double) -> String {
  let f = NumberFormatter()
  f.numberStyle = .currency
  f.currencyCode = "USD"
  f.maximumFractionDigits = 2
  f.minimumFractionDigits = 2
  return f.string(from: NSNumber(value: value)) ?? "$0.00"
}

private func percent(_ value: Double) -> String {
  String(format: "%.2f%%", value)
}

struct WatchHomeView: View {
  @EnvironmentObject private var store: WatchSnapshotStore

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Header(title: "Home")
      MetricRow(label: "Patrimônio", value: currency(store.snapshot.portfolioTotal), valueColor: .white)
      MetricRow(
        label: "L/P",
        value: percent(store.snapshot.unrealizedPct),
        valueColor: store.snapshot.unrealized >= 0 ? .green : .red
      )
      Spacer(minLength: 0)
      Text("Atualizado")
        .font(.caption2)
        .foregroundStyle(.secondary)
      Text(store.snapshot.updatedAt, style: .time)
        .font(.caption2)
    }
    .padding(10)
  }
}

struct WatchCryptoView: View {
  @EnvironmentObject private var store: WatchSnapshotStore

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Header(title: "Crypto")
      MetricRow(label: "Total", value: currency(store.snapshot.portfolioTotal), valueColor: .white)
      MetricRow(label: "L/P %", value: percent(store.snapshot.unrealizedPct), valueColor: store.snapshot.unrealized >= 0 ? .green : .red)
      Spacer(minLength: 0)
      Text("Resumo via iPhone")
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
    .padding(10)
  }
}

struct WatchCarteiraView: View {
  @EnvironmentObject private var store: WatchSnapshotStore

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Header(title: "Carteira")
      MetricRow(label: "Valor", value: currency(store.snapshot.portfolioTotal), valueColor: .white)
      MetricRow(label: "L/P USD", value: currency(store.snapshot.unrealized), valueColor: store.snapshot.unrealized >= 0 ? .green : .red)
      MetricRow(label: "L/P %", value: percent(store.snapshot.unrealizedPct), valueColor: store.snapshot.unrealized >= 0 ? .green : .red)
      Spacer(minLength: 0)
      Text(store.snapshot.updatedAt, style: .relative)
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
    .padding(10)
  }
}
