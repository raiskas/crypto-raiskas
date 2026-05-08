import SwiftUI
import UIKit
import UserNotifications
#if os(iOS)
import WatchConnectivity
#endif

@main
struct CryptoRaiskasIOSApp: App {
  @UIApplicationDelegateAdaptor(PushNotificationCoordinator.self) private var pushCoordinator
  @Environment(\.scenePhase) private var scenePhase
  @StateObject private var appState = AppState()

  init() {
    configureSystemAppearance()
    #if os(iOS)
    if WCSession.isSupported() {
      let session = WCSession.default
      session.delegate = WatchSessionDelegate.shared
      session.activate()
    }
    #endif
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
          Task { await appState.syncCompanionSnapshot() }
        }
      }
      .onChange(of: scenePhase) { _, newPhase in
        switch newPhase {
        case .active:
          appState.appBecameActive()
        case .inactive, .background:
          appState.appBecameInactive()
        @unknown default:
          break
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
    #if targetEnvironment(simulator)
    // Simulator cannot register real APNs tokens.
    print("[Push] Simulator detected; skipping APNs registration.")
    return
    #else
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      switch settings.authorizationStatus {
      case .authorized, .provisional, .ephemeral:
        DispatchQueue.main.async {
          print("[Push] Notifications already authorized. Calling registerForRemoteNotifications()")
          UIApplication.shared.registerForRemoteNotifications()
        }
      case .notDetermined:
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
          print("[Push] Notification authorization granted: \(granted)")
          guard granted else { return }
          DispatchQueue.main.async {
            print("[Push] Calling registerForRemoteNotifications()")
            UIApplication.shared.registerForRemoteNotifications()
          }
        }
      case .denied:
        print("[Push] Notification authorization denied by user.")
      @unknown default:
        print("[Push] Unknown notification authorization status.")
      }
    }
    #endif
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let hex = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    print("[Push] APNs token received: \(hex)")
    #if DEBUG
      let environment = "sandbox"
    #else
      let environment = "production"
    #endif
    Task {
      do {
        try await SupabaseService.shared.registerDeviceToken(token: hex, environment: environment)
        print("[Push] Device token saved to Supabase with environment: \(environment)")
      } catch {
        print("[Push] Failed to save device token to Supabase: \(error.localizedDescription)")
      }
    }
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("[Push] APNs registration failed: \(error.localizedDescription)")
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
