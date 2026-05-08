import SwiftUI

@main
struct CryptoRaiskasWatchApp: App {
  @StateObject private var store = WatchSnapshotStore()

  var body: some Scene {
    WindowGroup {
      WatchRootView()
        .environmentObject(store)
    }
  }
}
