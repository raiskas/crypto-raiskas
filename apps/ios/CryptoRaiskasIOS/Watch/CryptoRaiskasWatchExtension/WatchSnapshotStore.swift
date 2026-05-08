import Foundation
import WatchConnectivity

struct WatchPortfolioSnapshot: Equatable {
  let portfolioTotal: Double
  let unrealized: Double
  let unrealizedPct: Double
  let updatedAt: Date
}

@MainActor
final class WatchSnapshotStore: NSObject, ObservableObject {
  @Published var snapshot: WatchPortfolioSnapshot

  private let keyPortfolioTotal = "widget.portfolio_total"
  private let keyUnrealized = "widget.unrealized_total"
  private let keyUnrealizedPct = "widget.unrealized_pct"
  private let keyUpdatedAt = "widget.updated_at"

  override init() {
    let defaults = UserDefaults.standard
    let ts = defaults.double(forKey: keyUpdatedAt)
    self.snapshot = WatchPortfolioSnapshot(
      portfolioTotal: defaults.double(forKey: keyPortfolioTotal),
      unrealized: defaults.double(forKey: keyUnrealized),
      unrealizedPct: defaults.double(forKey: keyUnrealizedPct),
      updatedAt: ts > 0 ? Date(timeIntervalSince1970: ts) : Date()
    )
    super.init()

    if WCSession.isSupported() {
      let session = WCSession.default
      session.delegate = self
      session.activate()
      if !session.receivedApplicationContext.isEmpty {
        apply(payload: session.receivedApplicationContext)
      }
    }
  }

  private func apply(payload: [String: Any]) {
    guard
      let portfolio = payload[keyPortfolioTotal] as? Double,
      let unrealized = payload[keyUnrealized] as? Double,
      let unrealizedPct = payload[keyUnrealizedPct] as? Double
    else { return }

    let timestamp = payload[keyUpdatedAt] as? Double ?? Date().timeIntervalSince1970

    let defaults = UserDefaults.standard
    defaults.set(portfolio, forKey: keyPortfolioTotal)
    defaults.set(unrealized, forKey: keyUnrealized)
    defaults.set(unrealizedPct, forKey: keyUnrealizedPct)
    defaults.set(timestamp, forKey: keyUpdatedAt)

    snapshot = WatchPortfolioSnapshot(
      portfolioTotal: portfolio,
      unrealized: unrealized,
      unrealizedPct: unrealizedPct,
      updatedAt: Date(timeIntervalSince1970: timestamp)
    )
  }
}

extension WatchSnapshotStore: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    Task { @MainActor in
      self.apply(payload: applicationContext)
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    Task { @MainActor in
      self.apply(payload: userInfo)
    }
  }
}
