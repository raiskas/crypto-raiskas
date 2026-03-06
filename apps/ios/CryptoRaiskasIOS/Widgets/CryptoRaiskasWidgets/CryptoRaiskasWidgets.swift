import SwiftUI
import WidgetKit

private enum WidgetFormats {
  static func compactCurrency(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "USD"
    formatter.maximumFractionDigits = 1
    formatter.minimumFractionDigits = 0
    formatter.notANumberSymbol = "$0"
    formatter.usesSignificantDigits = false

    let absValue = abs(value)
    let sign = value < 0 ? "-" : ""
    switch absValue {
    case 1_000_000...:
      let v = absValue / 1_000_000
      return "\(sign)$\(String(format: "%.1f", v))M"
    case 1_000...:
      let v = absValue / 1_000
      return "\(sign)$\(String(format: "%.1f", v))k"
    default:
      return formatter.string(from: NSNumber(value: value)) ?? "$0"
    }
  }

  static func fullCurrency(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "USD"
    formatter.maximumFractionDigits = 2
    formatter.minimumFractionDigits = 2
    formatter.notANumberSymbol = "$0.00"
    return formatter.string(from: NSNumber(value: value)) ?? "$0.00"
  }
}

struct PortfolioSnapshotEntry: TimelineEntry {
  let date: Date
  let portfolioTotal: Double
  let unrealized: Double
  let unrealizedPct: Double
}

struct PortfolioSnapshotProvider: TimelineProvider {
  private let appGroupSuite = "group.com.raiskas.ios"
  private let keyPortfolioTotal = "widget.portfolio_total"
  private let keyUnrealized = "widget.unrealized_total"
  private let keyUnrealizedPct = "widget.unrealized_pct"
  private let keyUpdatedAt = "widget.updated_at"

  func placeholder(in context: Context) -> PortfolioSnapshotEntry {
    PortfolioSnapshotEntry(
      date: Date(),
      portfolioTotal: 87432.07,
      unrealized: -12344.91,
      unrealizedPct: -12.38
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (PortfolioSnapshotEntry) -> Void) {
    completion(loadFromSharedDefaults() ?? placeholder(in: context))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PortfolioSnapshotEntry>) -> Void) {
    let entry = loadFromSharedDefaults() ?? placeholder(in: context)
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: entry.date) ?? entry.date.addingTimeInterval(1800)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func loadFromSharedDefaults() -> PortfolioSnapshotEntry? {
    guard let defaults = UserDefaults(suiteName: appGroupSuite) else { return nil }
    let hasPortfolio = defaults.object(forKey: keyPortfolioTotal) != nil
    let hasUnrealized = defaults.object(forKey: keyUnrealized) != nil
    let hasUnrealizedPct = defaults.object(forKey: keyUnrealizedPct) != nil
    guard hasPortfolio && hasUnrealized && hasUnrealizedPct else { return nil }

    let timestamp = defaults.double(forKey: keyUpdatedAt)
    let date = timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : Date()
    return PortfolioSnapshotEntry(
      date: date,
      portfolioTotal: defaults.double(forKey: keyPortfolioTotal),
      unrealized: defaults.double(forKey: keyUnrealized),
      unrealizedPct: defaults.double(forKey: keyUnrealizedPct)
    )
  }
}

struct PortfolioWidgetView: View {
  @Environment(\.widgetFamily) private var family
  var entry: PortfolioSnapshotProvider.Entry

  private var unrealizedColor: Color {
    entry.unrealized >= 0 ? .green : .red
  }

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [Color(red: 0.01, green: 0.13, blue: 0.36), Color(red: 0.0, green: 0.08, blue: 0.23)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )

      if family == .accessoryRectangular {
        VStack(alignment: .leading, spacing: 4) {
          HStack(spacing: 5) {
            Image("WidgetCardLogo")
              .resizable()
              .renderingMode(.original)
              .interpolation(.high)
              .scaledToFit()
              .frame(width: 20, height: 20)
              .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
            Text("Total")
              .font(.caption2.weight(.semibold))
              .foregroundStyle(.white.opacity(0.82))
              .lineLimit(1)
          }
          Text(entry.portfolioTotal, format: .currency(code: "USD").precision(.fractionLength(2)))
            .font(.system(size: 15, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(12)
      } else {
        VStack(alignment: .leading, spacing: 6) {
          Text("Crypto Raiskas")
            .font(.caption2)
            .foregroundStyle(.white.opacity(0.85))

          Text("Total do Portfólio")
            .font(.caption)
            .foregroundStyle(.white.opacity(0.75))

          Text(entry.portfolioTotal, format: .currency(code: "USD"))
            .font(.title3.weight(.bold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.7)

          VStack(alignment: .leading, spacing: 2) {
            Text("L/P Não Realizado")
              .font(.caption2)
              .foregroundStyle(.white.opacity(0.72))
            HStack(spacing: 6) {
              Text(entry.unrealized, format: .currency(code: "USD"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(unrealizedColor)
              Text("(\(entry.unrealizedPct / 100, format: .percent.precision(.fractionLength(2))))")
                .font(.caption.weight(.semibold))
                .foregroundStyle(unrealizedColor)
            }
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(12)
      }
    }
    .containerBackground(for: .widget) { Color.clear }
    .widgetURL(URL(string: "cryptoraiskas://carteira"))
  }
}

struct PortfolioLockAccessoryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: PortfolioSnapshotProvider.Entry

  private var unrealizedColor: Color {
    entry.unrealized >= 0 ? .green : .red
  }

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        VStack(spacing: 1) {
          Text("L/P")
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(.white.opacity(0.9))
          Text(entry.unrealizedPct / 100, format: .percent.precision(.fractionLength(1)))
            .font(.system(size: 11, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(unrealizedColor)
            .minimumScaleFactor(0.5)
            .lineLimit(1)
        }
      case .accessoryInline:
        Text("L/P \(entry.unrealizedPct / 100, format: .percent.precision(.fractionLength(2)))")
          .font(.caption2.weight(.semibold))
          .monospacedDigit()
          .foregroundStyle(unrealizedColor)
      case .accessoryRectangular:
        HStack(alignment: .center, spacing: 10) {
          WidgetBrandBadge()

          VStack(alignment: .leading, spacing: 2) {
            Text(WidgetFormats.fullCurrency(entry.portfolioTotal))
              .font(.system(size: 14, weight: .heavy, design: .rounded))
              .monospacedDigit()
              .foregroundStyle(.white.opacity(0.98))
              .lineLimit(1)
              .minimumScaleFactor(0.7)

            HStack(spacing: 4) {
              Text("L/P")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white.opacity(0.94))
              Text(entry.unrealizedPct / 100, format: .percent.precision(.fractionLength(1)))
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(unrealizedColor)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            }
          }

          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      default:
        HStack(spacing: 6) {
          Text("L/P")
            .font(.caption2.weight(.semibold))
          Text(entry.unrealizedPct / 100, format: .percent.precision(.fractionLength(2)))
            .font(.caption2.weight(.semibold))
            .foregroundStyle(unrealizedColor)
        }
      }
    }
    .containerBackground(for: .widget) { Color.clear }
    .widgetURL(URL(string: "cryptoraiskas://carteira"))
  }
}

private struct WidgetBrandBadge: View {
  var body: some View {
    Image("WidgetCardLogo")
      .resizable()
      .renderingMode(.original)
      .interpolation(.high)
      .scaledToFill()
      .frame(width: 30, height: 30)
      .clipped()
      .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
  }
}

struct CryptoRaiskasPortfolioWidget: Widget {
  let kind: String = "CryptoRaiskasPortfolioWidgetV9"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: PortfolioSnapshotProvider()) { entry in
      PortfolioWidgetView(entry: entry)
    }
    .configurationDisplayName("Carteira Crypto Raiskas")
    .description("Total do portfólio e L/P não realizado.")
    .supportedFamilies([
      .systemSmall
    ])
  }
}

struct CryptoRaiskasLockWidget: Widget {
  let kind: String = "CryptoRaiskasLockWidgetV10"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: PortfolioSnapshotProvider()) { entry in
      PortfolioLockAccessoryView(entry: entry)
    }
    .configurationDisplayName("L/P da Carteira")
    .description("L/P não realizado na tela bloqueada.")
    .supportedFamilies([.accessoryInline, .accessoryRectangular, .accessoryCircular])
  }
}

@main
struct CryptoRaiskasWidgetsBundle: WidgetBundle {
  var body: some Widget {
    CryptoRaiskasPortfolioWidget()
    CryptoRaiskasLockWidget()
  }
}
