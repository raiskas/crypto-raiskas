import SwiftUI

enum AdminSubpage: String, CaseIterable, Identifiable {
  case overview = "Visão Geral"
  case usuarios = "Usuários"
  case empresas = "Empresas"
  case alertas = "Alertas"

  var id: String { rawValue }
}

struct AdminTabRootView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @EnvironmentObject private var appState: AppState
  @State private var selection: AdminSubpage? = .overview
  @State private var showAlertas = false

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
              NavigationLink {
                AdminAlertsView()
              } label: {
                Label(AppContract.adminAlertasLabel, systemImage: "bell.badge")
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
        .onAppear {
          if appState.pendingAlertNavigation != nil {
            showAlertas = true
          }
        }
        .onChange(of: appState.pendingAlertNavigation?.token) { _, token in
          guard token != nil else { return }
          showAlertas = true
        }
        .navigationDestination(isPresented: $showAlertas) {
          AdminAlertsView()
        }
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
              Label(AppContract.adminAlertasLabel, systemImage: "bell.badge")
                .tag(AdminSubpage.alertas)
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
            case .alertas:
              AdminAlertsView()
            }
          }
          .background(AppTheme.pageBackground)
        }
        .onAppear {
          if appState.pendingAlertNavigation != nil {
            selection = .alertas
          }
        }
        .onChange(of: appState.pendingAlertNavigation?.token) { _, token in
          guard token != nil else { return }
          selection = .alertas
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
  @State private var showAlertas = false

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

            adminMenuCard(
              icon: "bell.badge.fill",
              title: "Alertas de Preço",
              description: "Crie alertas por ativo e receba push quando bater o alvo"
            ) {
              navigateToAlertas()
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
    .navigationDestination(isPresented: $showAlertas) {
      AdminAlertsView()
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

  private func navigateToAlertas() {
    if horizontalSizeClass == .compact {
      showAlertas = true
    } else {
      selection = .alertas
    }
  }
}

@MainActor
final class AdminAlertsViewModel: ObservableObject {
  @Published var loading = false
  @Published var saving = false
  @Published var error: String?
  @Published var alerts: [PriceAlertRow] = []
  @Published var highlightedAlertId: UUID?
  @Published var highlightedSymbol: String?

  func refresh() async {
    loading = true
    defer { loading = false }
    do {
      alerts = try await SupabaseService.shared.fetchPriceAlerts()
      error = nil
    } catch {
      self.error = "Falha ao carregar alertas: \(error.localizedDescription)"
    }
  }

  private func save(id: UUID?, form: PriceAlertFormState) async {
    guard !saving else { return }
    saving = true
    defer { saving = false }
    do {
      let input = PriceAlertUpsertInput(
        assetSymbol: form.assetSymbol.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
        providerAssetId: {
          let value = form.providerAssetId.trimmingCharacters(in: .whitespacesAndNewlines)
          return value.isEmpty ? nil : value
        }(),
        direction: .cross,
        repeatMode: form.repeatMode,
        targetPrice: max(0.00000001, form.targetPrice),
        enabled: true,
        cooldownMinutes: 0
      )
      if let id {
        try await SupabaseService.shared.updatePriceAlert(id: id, input: input)
      } else {
        try await SupabaseService.shared.createPriceAlert(input: input)
      }
      error = nil
      await refresh()
    } catch {
      self.error = "Falha ao salvar alerta: \(error.localizedDescription)"
    }
  }

  func delete(id: UUID) async {
    do {
      try await SupabaseService.shared.deletePriceAlert(id: id)
      alerts.removeAll { $0.id == id }
      error = nil
    } catch {
      self.error = "Falha ao excluir alerta: \(error.localizedDescription)"
    }
  }

  func toggle(id: UUID, enabled: Bool) async {
    do {
      try await SupabaseService.shared.setPriceAlertEnabled(id: id, enabled: enabled)
      if let idx = alerts.firstIndex(where: { $0.id == id }) {
        var current = alerts[idx]
        current = PriceAlertRow(
          id: current.id,
          assetSymbol: current.assetSymbol,
          providerAssetId: current.providerAssetId,
          direction: current.direction,
          repeatMode: current.repeatMode,
          targetPrice: current.targetPrice,
          enabled: enabled,
          isTriggered: false,
          cooldownMinutes: current.cooldownMinutes,
          lastPrice: current.lastPrice,
          lastTriggeredAt: current.lastTriggeredAt,
          nextEligibleAt: current.nextEligibleAt,
          updatedAt: Date()
        )
        alerts[idx] = current
      }
      error = nil
    } catch {
      self.error = "Falha ao atualizar status do alerta: \(error.localizedDescription)"
    }
  }

  func saveFromView(id: UUID?, form: PriceAlertFormState) async {
    await save(id: id, form: form)
  }
}

struct PriceAlertFormState {
  var assetSymbol = "BTC"
  var providerAssetId = ""
  var repeatMode: PriceAlertRepeatMode = .always
  var targetPrice: Double = 0
}

struct AdminAlertsView: View {
  @EnvironmentObject private var appState: AppState
  @StateObject private var vm = AdminAlertsViewModel()
  @State private var showForm = false
  @State private var editing: PriceAlertRow?
  @State private var form = PriceAlertFormState()
  @State private var deleteTarget: PriceAlertRow?

  var body: some View {
    ZStack(alignment: .topLeading) {
      AppTheme.pageBackground.ignoresSafeArea()
      ScrollView {
        VStack(alignment: .leading, spacing: AppLayout.pageSpacing) {
          SectionTitle(title: "Alertas de Preço", subtitle: "Configure gatilhos de preço com envio de push")

          if let error = vm.error {
            AppCard {
              Text(error)
                .font(.caption)
                .foregroundStyle(.red)
            }
          }

          AppCard {
            VStack(alignment: .leading, spacing: 12) {
              HStack {
                Text("Meus Alertas")
                  .font(.headline)
                  .foregroundStyle(AppTheme.strongText)
                Spacer()
                Button {
                  openCreate()
                } label: {
                  Label("Novo Alerta", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
                Button {
                  Task { await vm.refresh() }
                } label: {
                  Label("Atualizar", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(vm.loading)
              }

              if vm.loading {
                ProgressView("Carregando alertas...")
                  .foregroundStyle(AppTheme.subtleText)
              } else if vm.alerts.isEmpty {
                Text("Nenhum alerta cadastrado.")
                  .font(.subheadline)
                  .foregroundStyle(AppTheme.subtleText)
              } else {
                VStack(spacing: 10) {
                  ForEach(vm.alerts) { row in
                    alertRow(row)
                  }
                }
              }
            }
          }
        }
        .padding(.horizontal, AppLayout.pageHorizontalCompact)
        .padding(.vertical, AppLayout.pageSpacing)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .navigationTitle(AppContract.adminAlertasLabel)
    .navigationBarTitleDisplayMode(.inline)
    .tabBarSafeAreaInset()
    .sheet(isPresented: $showForm) {
      PriceAlertFormModal(
        title: editing == nil ? "Criar Alerta" : "Editar Alerta",
        form: $form,
        saving: vm.saving,
        onSave: {
          let id = editing?.id
          Task {
            await vm.saveFromView(id: id, form: form)
            if vm.error == nil { showForm = false }
          }
        },
        onCancel: { showForm = false }
      )
      .presentationDetents([.fraction(0.62), .large])
      .presentationDragIndicator(.visible)
    }
    .alert("Excluir Alerta", isPresented: Binding(
      get: { deleteTarget != nil },
      set: { if !$0 { deleteTarget = nil } }
    )) {
      Button("Cancelar", role: .cancel) { deleteTarget = nil }
      Button("Excluir", role: .destructive) {
        if let id = deleteTarget?.id {
          Task { await vm.delete(id: id) }
        }
        deleteTarget = nil
      }
    } message: {
      Text("Deseja remover este alerta?")
    }
    .task { await vm.refresh() }
    .onAppear {
      if let pending = appState.pendingAlertNavigation {
        vm.highlightedAlertId = pending.alertId
        vm.highlightedSymbol = pending.assetSymbol?.uppercased()
        appState.pendingAlertNavigation = nil
      }
    }
    .onChange(of: appState.pendingAlertNavigation?.token) { _, token in
      guard token != nil else { return }
      if let pending = appState.pendingAlertNavigation {
        vm.highlightedAlertId = pending.alertId
        vm.highlightedSymbol = pending.assetSymbol?.uppercased()
        appState.pendingAlertNavigation = nil
      }
    }
  }

  @ViewBuilder
  private func alertRow(_ row: PriceAlertRow) -> some View {
    let highlighted = (vm.highlightedAlertId == row.id) || (vm.highlightedSymbol == row.assetSymbol.uppercased())
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        VStack(alignment: .leading, spacing: 3) {
          Text(row.assetSymbol.uppercased())
            .font(.headline)
            .foregroundStyle(AppTheme.strongText)
          Text("Cruzar \(AppFormatters.currency(row.targetPrice))")
            .font(.subheadline)
            .foregroundStyle(AppTheme.subtleText)
        }
        Spacer()
        Toggle("", isOn: Binding(
          get: { row.enabled },
          set: { value in Task { await vm.toggle(id: row.id, enabled: value) } }
        ))
        .labelsHidden()
      }

      HStack(spacing: 10) {
        statusBadge(row)
        Text(row.repeatMode == .always ? "Repete sempre" : "Dispara uma vez")
          .font(.caption)
          .foregroundStyle(AppTheme.subtleText)
        if let lastPrice = row.lastPrice {
          Text("Último preço: \(AppFormatters.currency(lastPrice))")
            .font(.caption)
            .foregroundStyle(AppTheme.subtleText)
        }
      }

      HStack(spacing: 8) {
        Button {
          openEdit(row)
        } label: {
          Label("Editar", systemImage: "pencil")
        }
        .buttonStyle(.bordered)

        Button(role: .destructive) {
          deleteTarget = row
        } label: {
          Label("Excluir", systemImage: "trash")
        }
        .buttonStyle(.bordered)
      }
    }
    .padding(10)
    .background(AppTheme.cardBackground.opacity(highlighted ? 0.95 : 0.8))
    .overlay(
      RoundedRectangle(cornerRadius: 10)
        .stroke(highlighted ? AppTheme.primaryAccent : AppTheme.border, lineWidth: highlighted ? 1.5 : 1)
    )
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private func statusBadge(_ row: PriceAlertRow) -> some View {
    let status: (label: String, color: Color) = {
      if !row.enabled { return ("Desativado", .gray) }
      if row.isTriggered { return ("Disparado", .orange) }
      return ("Ativo", .green)
    }()

    return Text(status.label)
      .font(.caption.bold())
      .foregroundStyle(status.color)
      .padding(.horizontal, 8)
      .padding(.vertical, 4)
      .background(status.color.opacity(0.12))
      .clipShape(Capsule())
  }

  private func openCreate() {
    editing = nil
    form = PriceAlertFormState()
    showForm = true
  }

  private func openEdit(_ row: PriceAlertRow) {
    editing = row
    form = PriceAlertFormState(
      assetSymbol: row.assetSymbol,
      providerAssetId: row.providerAssetId ?? "",
      repeatMode: row.repeatMode,
      targetPrice: row.targetPrice
    )
    showForm = true
  }
}

private struct PriceAlertFormModal: View {
  let title: String
  @Binding var form: PriceAlertFormState
  let saving: Bool
  let onSave: () -> Void
  let onCancel: () -> Void

  @State private var coinQuery = ""
  @State private var showCoinList = false
  @State private var searchResults: [CoinSearchRow] = []
  @State private var searching = false
  @State private var searchError: String?
  @State private var searchTask: Task<Void, Never>?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          VStack(alignment: .leading, spacing: 8) {
            Text("Criptomoeda")
              .font(.caption)
              .foregroundStyle(AppTheme.subtleText)
            TextField("Buscar por nome ou símbolo...", text: $coinQuery)
              .textInputAutocapitalization(.characters)
              .autocorrectionDisabled(true)
              .onChange(of: coinQuery) { _, newValue in
                runCoinSearch(query: newValue)
              }

            if let searchError {
              Text(searchError)
                .font(.caption)
                .foregroundStyle(.red)
            }

            if searching {
              Text("Buscando...")
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
            }

            if showCoinList {
              ScrollView {
                VStack(spacing: 0) {
                  ForEach(searchResults) { opt in
                    Button {
                      selectCoin(opt)
                    } label: {
                      HStack {
                        VStack(alignment: .leading, spacing: 2) {
                          Text(opt.name)
                            .foregroundStyle(AppTheme.strongText)
                          Text(opt.symbol.uppercased())
                            .font(.caption)
                            .foregroundStyle(AppTheme.subtleText)
                        }
                        Spacer()
                        if let px = opt.currentPrice {
                          Text(AppFormatters.currency(px))
                            .font(.caption)
                            .foregroundStyle(AppTheme.subtleText)
                        }
                      }
                      .padding(.horizontal, 10)
                      .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)

                    if opt.id != searchResults.last?.id {
                      Divider()
                    }
                  }
                }
              }
              .frame(maxHeight: 160)
            } else if !form.assetSymbol.isEmpty {
              Text("Selecionada: \(form.assetSymbol.uppercased())")
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
            }
          }

          VStack(alignment: .leading, spacing: 6) {
            Text("Quando o preço cruzar esse valor")
              .font(.caption)
              .foregroundStyle(AppTheme.subtleText)
            Text("O alerta dispara se vier de cima para baixo ou de baixo para cima.")
              .font(.caption2)
              .foregroundStyle(AppTheme.subtleText)
          }

          VStack(alignment: .leading, spacing: 6) {
            Text("Valor do alerta (USD)")
              .font(.caption)
              .foregroundStyle(AppTheme.subtleText)
            TextField("Preço alvo", value: $form.targetPrice, format: .number)
              .keyboardType(.decimalPad)
          }

          VStack(alignment: .leading, spacing: 6) {
            Text("Repetição")
              .font(.caption)
              .foregroundStyle(AppTheme.subtleText)
            Picker("Repetição", selection: $form.repeatMode) {
              Text("Sempre").tag(PriceAlertRepeatMode.always)
              Text("Uma vez").tag(PriceAlertRepeatMode.once)
            }
            .pickerStyle(.segmented)
          }
        }
      }
      .scrollContentBackground(.hidden)
      .background(AppTheme.pageBackground)
      .navigationTitle(title)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancelar", action: onCancel)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button(saving ? "Salvando..." : "Salvar", action: onSave)
            .disabled(saving || form.assetSymbol.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || form.targetPrice <= 0)
        }
      }
    }
    .onAppear {
      if !form.providerAssetId.isEmpty {
        coinQuery = "\(form.assetSymbol.uppercased()) (\(form.providerAssetId))"
      } else {
        coinQuery = form.assetSymbol.uppercased()
      }
    }
    .onDisappear {
      searchTask?.cancel()
    }
  }

  private func selectCoin(_ opt: CoinSearchRow) {
    form.assetSymbol = opt.symbol.uppercased()
    form.providerAssetId = opt.id
    coinQuery = "\(opt.name) (\(opt.symbol.uppercased()))"
    showCoinList = false
    searchResults = []
    searchError = nil
  }

  private func runCoinSearch(query: String) {
    searchTask?.cancel()
    searchError = nil
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.count < 2 {
      searchResults = []
      searching = false
      showCoinList = false
      return
    }

    showCoinList = true
    searching = true
    searchTask = Task {
      try? await Task.sleep(nanoseconds: 350_000_000)
      if Task.isCancelled { return }
      do {
        let result = try await SupabaseService.shared.searchCoins(query: trimmed, limit: 10)
        if Task.isCancelled { return }
        await MainActor.run {
          searchResults = result
          searching = false
          showCoinList = true
          if result.isEmpty {
            searchError = "Nenhuma moeda encontrada."
          }
        }
      } catch {
        if Task.isCancelled { return }
        await MainActor.run {
          searching = false
          searchResults = []
          showCoinList = false
          searchError = "Erro ao buscar moedas."
        }
      }
    }
  }
}
