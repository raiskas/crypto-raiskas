import Foundation

@MainActor
final class AppState: ObservableObject {
  struct PendingAlertNavigation: Equatable {
    let token = UUID()
    let alertId: UUID?
    let assetSymbol: String?
  }

  @Published var isAuthenticated = false
  @Published var currentUserEmail = ""
  @Published var isBootstrapping = true
  @Published var authError: String?
  @Published var selectedDestination: AppDestination = .home
  @Published var pendingAlertNavigation: PendingAlertNavigation?
  private var companionSyncTask: Task<Void, Never>?

  private let service = SupabaseService.shared

  func bootstrap() async {
    do {
      let user = try await service.currentUser()
      isAuthenticated = user != nil
      currentUserEmail = user?.email ?? ""
      authError = nil
      if user != nil {
        await syncCompanionSnapshot()
        startCompanionAutoSync()
      }
      if user == nil {
        selectedDestination = .home
      }
    } catch {
      isAuthenticated = false
      currentUserEmail = ""
      selectedDestination = .home
      // "Auth session missing" means the app is simply logged out.
      authError = isMissingSessionError(error) ? nil : error.localizedDescription
    }
    isBootstrapping = false
  }

  func signIn(email: String, password: String) async {
    do {
      try await service.signIn(email: email, password: password)
      isAuthenticated = true
      currentUserEmail = email
      selectedDestination = .home
      authError = nil
      await syncCompanionSnapshot()
      startCompanionAutoSync()
    } catch {
      authError = error.localizedDescription
    }
  }

  func signOut() async {
    do {
      try await service.signOut()
      isAuthenticated = false
      currentUserEmail = ""
      selectedDestination = .home
      pendingAlertNavigation = nil
      authError = nil
      stopCompanionAutoSync()
    } catch {
      authError = error.localizedDescription
    }
  }

  private func isMissingSessionError(_ error: Error) -> Bool {
    let message = (error as NSError).localizedDescription.lowercased()
    return message.contains("auth session missing")
      || message.contains("session missing")
      || message.contains("invalid refresh token")
  }

  func routeToAlerts(alertId: UUID?, assetSymbol: String?) {
    selectedDestination = .admin
    pendingAlertNavigation = PendingAlertNavigation(alertId: alertId, assetSymbol: assetSymbol)
  }

  func appBecameActive() {
    guard isAuthenticated else { return }
    Task {
      await syncCompanionSnapshot()
      startCompanionAutoSync()
    }
  }

  func appBecameInactive() {
    stopCompanionAutoSync()
  }

  private func startCompanionAutoSync() {
    companionSyncTask?.cancel()
    companionSyncTask = Task { [weak self] in
      guard let self else { return }
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 120 * 1_000_000_000) // 2 min foreground sync
        guard !Task.isCancelled, self.isAuthenticated else { break }
        await self.syncCompanionSnapshot()
      }
    }
  }

  private func stopCompanionAutoSync() {
    companionSyncTask?.cancel()
    companionSyncTask = nil
  }

  func syncCompanionSnapshot() async {
    do {
      let summary = try await service.fetchDashboardSummary()
      WidgetPortfolioSnapshotStore.save(
        portfolio: summary.patrimonio,
        unrealized: summary.resultado,
        unrealizedPct: summary.resultadoPct
      )
    } catch {
      // Keep silent: this is best-effort sync for widget/watch.
    }
  }
}
