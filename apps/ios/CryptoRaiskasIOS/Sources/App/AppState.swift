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

  private let service = SupabaseService.shared

  func bootstrap() async {
    do {
      let user = try await service.currentUser()
      isAuthenticated = user != nil
      currentUserEmail = user?.email ?? ""
      authError = nil
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
}
