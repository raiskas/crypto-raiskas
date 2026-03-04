import Foundation

@MainActor
final class AppState: ObservableObject {
  @Published var isAuthenticated = false
  @Published var currentUserEmail = ""
  @Published var isBootstrapping = true
  @Published var authError: String?

  private let service = SupabaseService.shared

  func bootstrap() async {
    do {
      let user = try await service.currentUser()
      isAuthenticated = user != nil
      currentUserEmail = user?.email ?? ""
      authError = nil
    } catch {
      isAuthenticated = false
      currentUserEmail = ""
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
}
