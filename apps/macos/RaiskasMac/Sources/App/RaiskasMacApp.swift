import SwiftUI

@main
struct RaiskasMacApp: App {
  @StateObject private var appState = AppState()

  init() {
    ProcessInfo.processInfo.setValue(AppContract.appName, forKey: "processName")
  }

  private func openModal(_ modal: Notification.Name, ensuringScreen screen: Notification.Name) {
    NotificationCenter.default.post(name: screen, object: nil)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
      NotificationCenter.default.post(name: modal, object: nil)
    }
  }

  var body: some Scene {
    WindowGroup {
      Group {
        if appState.isBootstrapping {
          ProgressView("Carregando sessão...")
            .frame(minWidth: 920, minHeight: 620)
        } else if appState.isAuthenticated {
          MainShellView()
            .environmentObject(appState)
        } else {
          SignInView()
            .environmentObject(appState)
        }
      }
      .task {
        if appState.isBootstrapping {
          await appState.bootstrap()
        }
      }
    }
    .windowStyle(.automatic)
    .commands {
      CommandMenu("Telas") {
        Button(AppContract.homeLabel) {
          NotificationCenter.default.post(name: .navigateToHome, object: nil)
        }
        Button(AppContract.cryptoLabel) {
          NotificationCenter.default.post(name: .navigateToCrypto, object: nil)
        }
        Button(AppContract.carteiraLabel) {
          NotificationCenter.default.post(name: .navigateToCarteira, object: nil)
        }
        Divider()
        Button("\(AppContract.adminMenuTitle) • \(AppContract.adminOverviewLabel)") {
          NotificationCenter.default.post(name: .navigateToAdminOverview, object: nil)
        }
        Button("\(AppContract.adminMenuTitle) • \(AppContract.adminUsuariosLabel)") {
          NotificationCenter.default.post(name: .navigateToAdminUsuarios, object: nil)
        }
        Button("\(AppContract.adminMenuTitle) • \(AppContract.adminEmpresasLabel)") {
          NotificationCenter.default.post(name: .navigateToAdminEmpresas, object: nil)
        }
      }

      CommandMenu("Modais") {
        Button(AppContract.modalCryptoNewOperationLabel) {
          openModal(.openCryptoNewOperation, ensuringScreen: .navigateToCrypto)
        }
        Button(AppContract.modalPortfolioAdminLabel) {
          openModal(.openPortfolioAdmin, ensuringScreen: .navigateToCarteira)
        }
        Divider()
        Button(AppContract.modalAdminNewUserLabel) {
          openModal(.openAdminNewUser, ensuringScreen: .navigateToAdminUsuarios)
        }
        Button(AppContract.modalAdminNewGroupLabel) {
          openModal(.openAdminNewGroup, ensuringScreen: .navigateToAdminUsuarios)
        }
        Button(AppContract.modalAdminNewEmpresaLabel) {
          openModal(.openAdminNewEmpresa, ensuringScreen: .navigateToAdminEmpresas)
        }
      }
    }
  }
}
