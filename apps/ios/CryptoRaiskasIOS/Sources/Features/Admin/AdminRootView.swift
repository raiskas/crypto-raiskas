import SwiftUI

enum AdminSubpage: String, CaseIterable, Identifiable {
  case overview = "Visão Geral"
  case usuarios = "Usuários"
  case empresas = "Empresas"

  var id: String { rawValue }
}

struct AdminTabRootView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @EnvironmentObject private var appState: AppState
  @State private var selection: AdminSubpage? = .overview

  var body: some View {
    Group {
      if horizontalSizeClass == .compact {
        NavigationStack {
          List {
            Section {
              NavigationLink {
                AdminPanelView(selection: .constant(.overview))
              } label: {
                Label(AppContract.adminOverviewLabel, systemImage: "rectangle.grid.2x2")
              }
              NavigationLink {
                AdminUsersView()
              } label: {
                Label(AppContract.adminUsuariosLabel, systemImage: "person.2")
              }
              NavigationLink {
                AdminEmpresasView()
              } label: {
                Label(AppContract.adminEmpresasLabel, systemImage: "building.2")
              }
            } header: {
              Text(AppContract.adminMenuTitle)
            }
          }
          .scrollContentBackground(.hidden)
          .background(AppTheme.pageBackground)
          .navigationTitle(AppContract.adminMenuTitle)
          .navigationBarTitleDisplayMode(.inline)
          .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
              Button("Sair") {
                Task { await appState.signOut() }
              }
            }
          }
        }
        .tabBarSafeAreaInset()
      } else {
        NavigationSplitView {
          List(selection: $selection) {
            Section {
              Label(AppContract.adminOverviewLabel, systemImage: "rectangle.grid.2x2")
                .tag(AdminSubpage.overview)
              Label(AppContract.adminUsuariosLabel, systemImage: "person.2")
                .tag(AdminSubpage.usuarios)
              Label(AppContract.adminEmpresasLabel, systemImage: "building.2")
                .tag(AdminSubpage.empresas)
            } header: {
              Text(AppContract.adminMenuTitle)
            }
          }
          .scrollContentBackground(.hidden)
          .background(AppTheme.pageBackground)
          .navigationTitle(AppContract.adminMenuTitle)
          .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
              Button("Sair") {
                Task { await appState.signOut() }
              }
            }
          }
        } detail: {
          Group {
            switch selection ?? .overview {
            case .overview:
              AdminPanelView(selection: $selection)
            case .usuarios:
              AdminUsersView()
            case .empresas:
              AdminEmpresasView()
            }
          }
          .background(AppTheme.pageBackground)
        }
      }
    }
  }
}

@MainActor
final class AdminPanelViewModel: ObservableObject {
  @Published var loading = false
  @Published var error: String?

  func refresh() async {
    loading = true
    defer { loading = false }

    do {
      _ = try await SupabaseService.shared.fetchAdminAccessContext()
      error = nil
    } catch {
      self.error = error.localizedDescription
    }
  }
}

struct AdminPanelView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Binding var selection: AdminSubpage?
  @StateObject private var vm = AdminPanelViewModel()
  @State private var showUsers = false
  @State private var showEmpresas = false

  var body: some View {
    ZStack(alignment: .topLeading) {
      AppTheme.pageBackground.ignoresSafeArea()
      ScrollView {
        VStack(alignment: .leading, spacing: AppLayout.pageSpacing) {
          SectionTitle(title: "Painel Administrativo", subtitle: "")

          if let error = vm.error {
            AppCard {
              Text(error)
                .font(.caption)
                .foregroundStyle(.red)
            }
          }

          VStack(spacing: 14) {
            adminMenuCard(
              icon: "person.3.fill",
              title: "Gerenciar Usuários",
              description: "Criar, editar, desativar e redefinir senhas de usuários"
            ) {
              navigateToUsers()
            }

            adminMenuCard(
              icon: "building.2.fill",
              title: "Gerenciar Empresas",
              description: "Criar, editar e remover empresas"
            ) {
              navigateToEmpresas()
            }
          }
        }
        .padding(.horizontal, AppLayout.pageHorizontalCompact)
        .padding(.top, AppLayout.pageSpacing)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .tabBarSafeAreaInset()
    .navigationDestination(isPresented: $showUsers) {
      AdminUsersView()
    }
    .navigationDestination(isPresented: $showEmpresas) {
      AdminEmpresasView()
    }
    .task { await vm.refresh() }
  }

  private func adminMenuCard(icon: String, title: String, description: String, onTap: @escaping () -> Void) -> some View {
    AppCard {
      VStack(alignment: .leading, spacing: 14) {
        HStack(spacing: 10) {
          Image(systemName: icon)
            .font(.system(size: 20, weight: .bold))
            .foregroundStyle(AppTheme.primaryAccent)
            .frame(width: 40, height: 40)
            .background(AppTheme.primaryAccent.opacity(0.14))
            .clipShape(RoundedRectangle(cornerRadius: 10))

          VStack(alignment: .leading, spacing: 3) {
            Text(title)
              .font(.headline)
              .foregroundStyle(AppTheme.strongText)
            Text(description)
              .font(.subheadline)
              .foregroundStyle(AppTheme.subtleText)
          }
        }

        Button("Acessar", action: onTap)
          .buttonStyle(.bordered)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private func navigateToUsers() {
    if horizontalSizeClass == .compact {
      showUsers = true
    } else {
      selection = .usuarios
    }
  }

  private func navigateToEmpresas() {
    if horizontalSizeClass == .compact {
      showEmpresas = true
    } else {
      selection = .empresas
    }
  }
}
