import SwiftUI
import UIKit

@main
struct CryptoRaiskasIOSApp: App {
  @StateObject private var appState = AppState()

  init() {
    configureSystemAppearance()
  }

  var body: some Scene {
    WindowGroup {
      ZStack(alignment: .topLeading) {
        AppTheme.pageBackground
          .ignoresSafeArea()

        Group {
          if appState.isBootstrapping {
            ProgressView("Carregando sessão...")
              .foregroundStyle(AppTheme.strongText)
          } else if appState.isAuthenticated {
            MainTabView()
              .environmentObject(appState)
          } else {
            SignInView()
              .environmentObject(appState)
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .preferredColorScheme(.dark)
      .task {
        if appState.isBootstrapping {
          await appState.bootstrap()
        }
      }
    }
  }

  private func configureSystemAppearance() {
    let page = UIColor(red: 8/255, green: 24/255, blue: 58/255, alpha: 1)
    let text = UIColor.white
    let accent = UIColor(red: 29/255, green: 120/255, blue: 255/255, alpha: 1)

    let nav = UINavigationBarAppearance()
    nav.configureWithOpaqueBackground()
    nav.backgroundColor = page
    nav.titleTextAttributes = [.foregroundColor: text]
    nav.largeTitleTextAttributes = [.foregroundColor: text]
    UINavigationBar.appearance().standardAppearance = nav
    UINavigationBar.appearance().scrollEdgeAppearance = nav
    UINavigationBar.appearance().compactAppearance = nav
    UINavigationBar.appearance().tintColor = text

    let tab = UITabBarAppearance()
    tab.configureWithTransparentBackground()
    tab.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
    tab.backgroundColor = .clear
    tab.stackedLayoutAppearance.normal.iconColor = text.withAlphaComponent(0.75)
    tab.stackedLayoutAppearance.normal.titleTextAttributes = [
      .foregroundColor: text.withAlphaComponent(0.75),
    ]
    tab.stackedLayoutAppearance.selected.iconColor = accent
    tab.stackedLayoutAppearance.selected.titleTextAttributes = [
      .foregroundColor: accent,
    ]
    UITabBar.appearance().standardAppearance = tab
    UITabBar.appearance().scrollEdgeAppearance = tab
    UITabBar.appearance().isTranslucent = true

  }
}
