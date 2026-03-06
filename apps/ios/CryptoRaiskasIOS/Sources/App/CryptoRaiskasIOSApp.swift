import SwiftUI
import UIKit
import UserNotifications

@main
struct CryptoRaiskasIOSApp: App {
  @UIApplicationDelegateAdaptor(PushNotificationCoordinator.self) private var pushCoordinator
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
      .onAppear {
        pushCoordinator.bind(appState: appState)
      }
      .onChange(of: appState.isAuthenticated) { _, isAuthenticated in
        if isAuthenticated {
          pushCoordinator.requestAuthorizationAndRegister()
        }
      }
      .onOpenURL { url in
        guard url.scheme?.lowercased() == "cryptoraiskas" else { return }
        guard url.host?.lowercased() == "alerts" || url.path.lowercased().contains("alerts") else { return }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let alertId = components?.queryItems?.first(where: { $0.name == "alertId" })?.value.flatMap(UUID.init(uuidString:))
        let symbol = components?.queryItems?.first(where: { $0.name == "assetSymbol" || $0.name == "symbol" })?.value
        appState.routeToAlerts(alertId: alertId, assetSymbol: symbol)
      }
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

final class PushNotificationCoordinator: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  private weak var appState: AppState?
  private var didRequestPermission = false

  func bind(appState: AppState) {
    self.appState = appState
    UNUserNotificationCenter.current().delegate = self
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    if let payload = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
      routeFromPushPayload(payload)
    }
    return true
  }

  func requestAuthorizationAndRegister() {
    guard !didRequestPermission else { return }
    didRequestPermission = true
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
      guard granted else { return }
      DispatchQueue.main.async {
        UIApplication.shared.registerForRemoteNotifications()
      }
    }
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let hex = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    #if DEBUG
      let environment = "sandbox"
    #else
      let environment = "production"
    #endif
    Task { try? await SupabaseService.shared.registerDeviceToken(token: hex, environment: environment) }
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("APNs registration failed: \(error.localizedDescription)")
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    routeFromPushPayload(response.notification.request.content.userInfo)
    completionHandler()
  }

  private func routeFromPushPayload(_ payload: [AnyHashable: Any]) {
    let alertId = (payload["alertId"] as? String).flatMap(UUID.init(uuidString:))
    let assetSymbol = (payload["assetSymbol"] as? String) ?? (payload["symbol"] as? String)
    Task { @MainActor in
      appState?.routeToAlerts(alertId: alertId, assetSymbol: assetSymbol)
    }
  }
}
