import Foundation
#if os(iOS)
import WatchConnectivity

@MainActor
enum WatchSnapshotSync {
  static func pushSnapshot(portfolio: Double, unrealized: Double, unrealizedPct: Double, updatedAt: Date = Date()) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    let payload: [String: Any] = [
      WidgetPortfolioSnapshotStore.keyPortfolioTotal: portfolio,
      WidgetPortfolioSnapshotStore.keyUnrealized: unrealized,
      WidgetPortfolioSnapshotStore.keyUnrealizedPct: unrealizedPct,
      WidgetPortfolioSnapshotStore.keyUpdatedAt: updatedAt.timeIntervalSince1970,
    ]

    guard session.activationState == .activated else {
      WatchSessionDelegate.shared.pendingPayload = payload
      if session.delegate == nil {
        session.delegate = WatchSessionDelegate.shared
        session.activate()
      }
      session.transferUserInfo(payload)
      return
    }

    do {
      try session.updateApplicationContext(payload)
    } catch {
      session.transferUserInfo(payload)
    }
  }
}

final class WatchSessionDelegate: NSObject, WCSessionDelegate {
  static let shared = WatchSessionDelegate()
  var pendingPayload: [String: Any]?

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated else { return }

    if let pendingPayload {
      do {
        try session.updateApplicationContext(pendingPayload)
        self.pendingPayload = nil
        return
      } catch {
        session.transferUserInfo(pendingPayload)
      }
    }

    if let latest = WidgetPortfolioSnapshotStore.readLatest() {
      Task { @MainActor in
        WatchSnapshotSync.pushSnapshot(
          portfolio: latest.portfolio,
          unrealized: latest.unrealized,
          unrealizedPct: latest.unrealizedPct,
          updatedAt: latest.updatedAt
        )
      }
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }
}
#endif
