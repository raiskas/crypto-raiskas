import SwiftUI

struct MainTabView: View {
  @EnvironmentObject var appState: AppState

  var body: some View {
    ZStack(alignment: .topLeading) {
      AppTheme.pageBackground.ignoresSafeArea()

      TabView(selection: $appState.selectedDestination) {
        RootFillContainer {
          HomeView()
        }
        .tabItem {
          Label(AppContract.homeLabel, systemImage: "house")
        }
        .tag(AppDestination.home)

        RootFillContainer {
          CryptoRootView()
        }
        .tabItem {
          Label(AppContract.cryptoLabel, systemImage: "bitcoinsign.circle")
        }
        .tag(AppDestination.crypto)

        RootFillContainer {
          PortfolioView()
        }
        .tabItem {
          Label(AppContract.carteiraLabel, systemImage: "chart.line.uptrend.xyaxis")
        }
        .tag(AppDestination.carteira)

        RootFillContainer {
          AdminTabRootView()
        }
        .tabItem {
          Label(AppContract.adminMenuTitle, systemImage: "person.3")
        }
        .tag(AppDestination.admin)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .background(AppTheme.pageBackground.ignoresSafeArea())
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .tint(AppTheme.primaryAccent)
  }
}

private struct RootFillContainer<Content: View>: View {
  @ViewBuilder let content: () -> Content

  var body: some View {
    content()
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}
