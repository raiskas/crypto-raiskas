import SwiftUI

struct MainShellView: View {
  @EnvironmentObject var appState: AppState
  @State private var selection: AppDestination? = .home
  @State private var adminExpanded = true

  var body: some View {
    NavigationSplitView {
      VStack(spacing: 12) {
        HStack(spacing: 10) {
          if let logo = NSImage(named: "logo-sem-fundo") {
            Image(nsImage: logo)
              .resizable()
              .scaledToFit()
              .frame(width: 30, height: 30)
          } else {
            Circle()
              .fill(AppTheme.primaryAccent)
              .frame(width: 20, height: 20)
          }

          VStack(alignment: .leading, spacing: 1) {
            Text(AppContract.appName)
              .font(.headline.bold())
              .foregroundStyle(AppTheme.strongText)
            Text("macOS")
              .font(.caption2)
              .foregroundStyle(AppTheme.subtleText)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.top, 14)

        List {
          menuRow(.home)
          menuRow(.crypto)
          menuRow(.carteira)

          Section {
            DisclosureGroup(
              isExpanded: $adminExpanded,
              content: {
                VStack(spacing: 2) {
                  adminSubRow(.adminOverview)
                  adminSubRow(.adminUsuarios)
                  adminSubRow(.adminEmpresas)
                }
                .padding(.leading, 8)
              },
              label: {
                HStack(spacing: 8) {
                  Image(systemName: "person.3")
                    .font(.system(size: 15, weight: .semibold))
                  Text(AppContract.adminMenuTitle)
                    .font(.system(size: 16, weight: .semibold))
                }
                .foregroundStyle(AppTheme.strongText)
              }
            )
            .disclosureGroupStyle(.automatic)
          }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)

        Spacer(minLength: 0)
      }
      .background(AppTheme.sidebarBackground)
    } detail: {
      VStack(spacing: 0) {
        header
        Divider().overlay(Color.white.opacity(0.08))
        content
      }
      .background(AppTheme.pageBackground)
    }
    .navigationSplitViewStyle(.balanced)
    .frame(minWidth: 1320, minHeight: 840)
    .onReceive(NotificationCenter.default.publisher(for: .navigateToCrypto)) { _ in
      selection = .crypto
    }
    .onReceive(NotificationCenter.default.publisher(for: .navigateToHome)) { _ in
      selection = .home
    }
    .onReceive(NotificationCenter.default.publisher(for: .navigateToCarteira)) { _ in
      selection = .carteira
    }
    .onReceive(NotificationCenter.default.publisher(for: .navigateToAdminOverview)) { _ in
      adminExpanded = true
      selection = .adminOverview
    }
    .onReceive(NotificationCenter.default.publisher(for: .navigateToAdminUsuarios)) { _ in
      adminExpanded = true
      selection = .adminUsuarios
    }
    .onReceive(NotificationCenter.default.publisher(for: .navigateToAdminEmpresas)) { _ in
      adminExpanded = true
      selection = .adminEmpresas
    }
  }

  private var header: some View {
    HStack {
      VStack(alignment: .leading, spacing: 2) {
        Text(headerTitle)
          .font(.headline.bold())
          .foregroundStyle(AppTheme.strongText)
        Text(headerSubtitle)
          .font(.caption)
          .foregroundStyle(AppTheme.subtleText)
      }

      Spacer()

      Text(appState.currentUserEmail)
        .font(.caption)
        .foregroundStyle(.white.opacity(0.7))

      Button("Sair") {
        Task { await appState.signOut() }
      }
      .buttonStyle(.bordered)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 10)
    .background(AppTheme.headerBackground)
  }

  @ViewBuilder
  private var content: some View {
    switch selection ?? .home {
    case .home:
      HomeView()
    case .crypto:
      CryptoRootView()
    case .carteira:
      PortfolioView()
    case .adminOverview:
      AdminPanelView()
    case .adminUsuarios:
      AdminUsersView()
    case .adminEmpresas:
      AdminEmpresasView()
    }
  }

  private var headerTitle: String {
    switch selection ?? .home {
    case .home: return "Home"
    case .crypto: return "Crypto"
    case .carteira: return "Carteira"
    case .adminOverview, .adminUsuarios, .adminEmpresas:
      return AppContract.adminMenuTitle
    }
  }

  private var headerSubtitle: String {
    switch selection ?? .home {
    case .adminOverview:
      return "Subpágina: Visão Geral"
    case .adminUsuarios:
      return "Subpágina: Usuários"
    case .adminEmpresas:
      return "Subpágina: Empresas"
    default:
      return "Área administrativa"
    }
  }

  @ViewBuilder
  private func menuRow(_ item: AppDestination) -> some View {
    Button {
      selection = item
    } label: {
      HStack(spacing: 8) {
        Image(systemName: item.icon)
          .font(.system(size: 15, weight: .semibold))
        Text(item.title)
          .font(.system(size: 16, weight: .semibold))
      }
      .foregroundStyle(AppTheme.strongText)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.vertical, 6)
      .padding(.horizontal, 6)
      .background((selection == item) ? AppTheme.primaryAccent.opacity(0.22) : .clear)
      .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    .buttonStyle(.plain)
  }

  @ViewBuilder
  private func adminSubRow(_ item: AppDestination) -> some View {
    Button {
      selection = item
    } label: {
      HStack(spacing: 8) {
        Image(systemName: item.icon)
          .font(.system(size: 13, weight: .semibold))
        Text(item.title.replacingOccurrences(of: "Admin ", with: ""))
          .font(.system(size: 14, weight: .semibold))
      }
      .foregroundStyle(AppTheme.strongText)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.vertical, 4)
      .padding(.horizontal, 6)
      .background((selection == item) ? AppTheme.primaryAccent.opacity(0.22) : .clear)
      .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    .buttonStyle(.plain)
  }
}
