import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

enum WidgetPortfolioSnapshotStore {
  static let appGroupSuite = "group.com.raiskas.ios"
  static let keyPortfolioTotal = "widget.portfolio_total"
  static let keyUnrealized = "widget.unrealized_total"
  static let keyUnrealizedPct = "widget.unrealized_pct"
  static let keyUpdatedAt = "widget.updated_at"

  static func save(portfolio: Double, unrealized: Double, unrealizedPct: Double) {
    guard let defaults = UserDefaults(suiteName: appGroupSuite) else { return }
    defaults.set(portfolio, forKey: keyPortfolioTotal)
    defaults.set(unrealized, forKey: keyUnrealized)
    defaults.set(unrealizedPct, forKey: keyUnrealizedPct)
    defaults.set(Date().timeIntervalSince1970, forKey: keyUpdatedAt)
    defaults.synchronize()
    #if canImport(WidgetKit)
    WidgetCenter.shared.reloadAllTimelines()
    #endif
  }
}
