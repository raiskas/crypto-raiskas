import SwiftUI

struct UserFormState {
  var nome = ""
  var email = ""
  var password = ""
  var empresaId: UUID?
  var grupoId: UUID?
  var ativo = true
  var isMaster = false
}

struct GroupFormState {
  var nome = ""
  var descricao = ""
  var isMaster = false
  var empresaId: UUID?
  var telasPermitidas: Set<String> = []
}

@MainActor
final class AdminUsersViewModel: ObservableObject {
  @Published var loading = false
  @Published var actionLoading = false
  @Published var error: String?
  @Published var success: String?

  @Published var users: [AdminUserRow] = []
  @Published var groups: [GrupoRow] = []
  @Published var empresas: [EmpresaRow] = []
  @Published var accessContext = AdminAccessContext(isMaster: false, empresaId: nil)

  func refresh() async {
    loading = true
    defer { loading = false }

    do {
      async let contextTask = SupabaseService.shared.fetchAdminAccessContext()
      async let usersTask = SupabaseService.shared.fetchAdminUsers(limit: 400)
      async let groupsTask = SupabaseService.shared.fetchGrupos(limit: 400)
      async let empresasTask = SupabaseService.shared.fetchEmpresas(limit: 400)

      accessContext = try await contextTask
      users = try await usersTask
      groups = try await groupsTask
      empresas = try await empresasTask
      error = nil
    } catch {
      self.error = "Falha ao carregar dados administrativos: \(error.localizedDescription)"
    }
  }

  func createUser(_ form: UserFormState) async {
    guard accessContext.isMaster else {
      error = "Apenas usuário master pode criar usuários."
      return
    }
    guard let empresaId = form.empresaId else {
      error = "Selecione uma empresa."
      return
    }
    guard form.grupoId != nil else {
      error = "Selecione um grupo."
      return
    }

    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.createAdminUser(
        input: AdminCreateUserInput(
          nome: form.nome,
          email: form.email,
          password: form.password,
          empresaId: empresaId,
          grupoId: form.grupoId
        )
      )
      success = "Usuário criado com sucesso."
      error = nil
      await refresh()
    } catch {
      self.error = "Falha ao criar usuário: \(error.localizedDescription)"
      self.success = nil
    }
  }

  func updateUser(userId: UUID, _ form: UserFormState) async {
    guard accessContext.isMaster else {
      error = "Apenas usuário master pode editar usuários."
      return
    }
    guard let empresaId = form.empresaId else {
      error = "Selecione uma empresa."
      return
    }

    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.updateAdminUser(
        input: AdminUpdateUserInput(
          userId: userId,
          nome: form.nome,
          email: form.email,
          empresaId: empresaId,
          grupoId: form.grupoId,
          ativo: form.ativo,
          isMaster: form.isMaster
        )
      )
      success = "Usuário atualizado com sucesso."
      error = nil
      await refresh()
    } catch {
      self.error = "Falha ao atualizar usuário: \(error.localizedDescription)"
      self.success = nil
    }
  }

  func deleteUser(userId: UUID) async {
    guard accessContext.isMaster else {
      error = "Apenas usuário master pode remover usuários."
      return
    }

    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.deleteAdminUser(userId: userId)
      success = "Usuário removido com sucesso."
      error = nil
      await refresh()
    } catch {
      self.error = "Falha ao remover usuário: \(error.localizedDescription)"
      self.success = nil
    }
  }

  func sendResetPassword(email: String) async {
    guard accessContext.isMaster else {
      error = "Apenas usuário master pode resetar senha."
      return
    }

    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.sendAdminPasswordReset(email: email)
      success = "E-mail de redefinição enviado para \(email)."
      error = nil
    } catch {
      self.error = "Falha ao enviar reset: \(error.localizedDescription)"
      self.success = nil
    }
  }

  func createGroup(_ form: GroupFormState) async {
    guard accessContext.isMaster else {
      error = "Apenas usuário master pode criar grupos."
      return
    }

    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.createGrupo(
        nome: form.nome,
        descricao: form.descricao,
        isMaster: form.isMaster,
        empresaId: form.isMaster ? nil : form.empresaId,
        telasPermitidas: form.isMaster ? [] : Array(form.telasPermitidas)
      )
      success = "Grupo criado com sucesso."
      error = nil
      await refresh()
    } catch {
      self.error = "Falha ao criar grupo: \(error.localizedDescription)"
      self.success = nil
    }
  }

  func updateGroup(groupId: UUID, _ form: GroupFormState) async {
    guard accessContext.isMaster else {
      error = "Apenas usuário master pode editar grupos."
      return
    }

    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.updateGrupo(
        id: groupId,
        nome: form.nome,
        descricao: form.descricao,
        isMaster: form.isMaster,
        empresaId: form.isMaster ? nil : form.empresaId,
        telasPermitidas: form.isMaster ? [] : Array(form.telasPermitidas)
      )
      success = "Grupo atualizado com sucesso."
      error = nil
      await refresh()
    } catch {
      self.error = "Falha ao atualizar grupo: \(error.localizedDescription)"
      self.success = nil
    }
  }

  func deleteGroup(groupId: UUID) async {
    guard accessContext.isMaster else {
      error = "Apenas usuário master pode remover grupos."
      return
    }

    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.deleteGrupo(id: groupId)
      success = "Grupo removido com sucesso."
      error = nil
      await refresh()
    } catch {
      self.error = "Falha ao remover grupo: \(error.localizedDescription)"
      self.success = nil
    }
  }

  var filteredEmpresasForCurrentUser: [EmpresaRow] {
    if accessContext.isMaster { return empresas }
    guard let empresaId = accessContext.empresaId else { return [] }
    return empresas.filter { $0.id == empresaId }
  }

  var visibleUsers: [AdminUserRow] {
    if accessContext.isMaster { return users }
    guard let empresaId = accessContext.empresaId else { return [] }
    return users.filter { $0.empresaId == empresaId }
  }

  var visibleGroups: [GrupoRow] {
    if accessContext.isMaster { return groups }
    guard let empresaId = accessContext.empresaId else { return [] }
    return groups.filter { $0.empresaId == empresaId }
  }
}

private enum AdminModal: Identifiable {
  case createUser
  case editUser
  case createGroup
  case editGroup

  var id: String {
    switch self {
    case .createUser: return "createUser"
    case .editUser: return "editUser"
    case .createGroup: return "createGroup"
    case .editGroup: return "editGroup"
    }
  }
}

struct AdminUsersView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @StateObject private var vm = AdminUsersViewModel()

  @State private var selectedUser: AdminUserRow?
  @State private var selectedGroup: GrupoRow?
  @State private var userForm = UserFormState()
  @State private var groupForm = GroupFormState()

  @State private var activeModal: AdminModal?
  @State private var showDeleteUserConfirm = false
  @State private var showDeleteGroupConfirm = false

  private let allAllowedScreens = [
    "home",
    "crypto",
    "carteira",
    "admin",
    "admin.usuarios",
    "admin.empresas",
  ]

  var body: some View {
    ZStack(alignment: .topLeading) {
      AppTheme.pageBackground.ignoresSafeArea()
      ScrollView {
        VStack(alignment: .leading, spacing: AppLayout.pageSpacing) {
          PageHeaderView(title: "Usuários", subtitle: "") {
            newUserButton
          }

        VStack(alignment: .leading, spacing: 2) {
          Text("Gerenciamento de Usuários")
            .font(.title2.bold())
            .foregroundStyle(AppTheme.strongText)
          Text("Gerencie usuários do sistema, senhas e permissões")
            .font(.subheadline)
            .foregroundStyle(AppTheme.subtleText)
        }

        if let error = vm.error {
          AppCard {
            Text(error)
              .font(.caption)
              .foregroundStyle(.red)
          }
        }

        if let success = vm.success {
          AppCard {
            Text(success)
              .font(.caption)
              .foregroundStyle(.green)
          }
        }

        usersSection
        groupsSection
      }
        .padding(.bottom, 12)
        .padding(.horizontal, horizontalSizeClass == .compact ? AppLayout.pageHorizontalCompact : AppLayout.pageHorizontalRegular)
        .padding(.top, AppLayout.pageSpacing)
      }
      .background(AppTheme.pageBackground)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .navigationTitle(AppContract.adminUsuariosLabel)
    .navigationBarTitleDisplayMode(.inline)
    .tabBarSafeAreaInset()
    .task {
      if vm.users.isEmpty { await vm.refresh() }
    }
    .sheet(item: $activeModal) { modal in
      switch modal {
      case .createUser, .editUser:
        UserFormModal(
          title: modal == .createUser ? "Novo Usuário" : "Editar Usuário",
          form: $userForm,
          empresas: vm.filteredEmpresasForCurrentUser,
          grupos: filteredGroupsByForm,
          loading: vm.actionLoading,
          canEditMaster: vm.accessContext.isMaster,
          onCancel: { activeModal = nil },
          onSubmit: {
            switch modal {
            case .createUser:
              Task {
                await vm.createUser(userForm)
                if vm.error == nil { activeModal = nil }
              }
            case .editUser:
              guard let row = selectedUser else { return }
              Task {
                await vm.updateUser(userId: row.id, userForm)
                if vm.error == nil { activeModal = nil }
              }
            default:
              break
            }
          }
        )
        .presentationDetents([.large])

      case .createGroup, .editGroup:
        GroupFormModal(
          title: modal == .createGroup ? "Criar Novo Grupo" : "Editar Grupo",
          form: $groupForm,
          empresas: vm.filteredEmpresasForCurrentUser,
          allAllowedScreens: allAllowedScreens,
          loading: vm.actionLoading,
          canEditMaster: vm.accessContext.isMaster,
          onCancel: { activeModal = nil },
          onSubmit: {
            switch modal {
            case .createGroup:
              Task {
                await vm.createGroup(groupForm)
                if vm.error == nil { activeModal = nil }
              }
            case .editGroup:
              guard let row = selectedGroup else { return }
              Task {
                await vm.updateGroup(groupId: row.id, groupForm)
                if vm.error == nil { activeModal = nil }
              }
            default:
              break
            }
          }
        )
        .presentationDetents([.large])
      }
    }
    .alert("Remover Usuário", isPresented: $showDeleteUserConfirm, presenting: selectedUser) { row in
      Button("Cancelar", role: .cancel) {}
      Button("Excluir", role: .destructive) {
        Task { await vm.deleteUser(userId: row.id) }
      }
    } message: { _ in
      Text("Tem certeza que deseja remover este usuário?")
    }
    .alert("Remover Grupo", isPresented: $showDeleteGroupConfirm, presenting: selectedGroup) { row in
      Button("Cancelar", role: .cancel) {}
      Button("Excluir", role: .destructive) {
        Task { await vm.deleteGroup(groupId: row.id) }
      }
    } message: { _ in
      Text("Tem certeza que deseja remover este grupo?")
    }
  }

  private var usersSection: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .top) {
          Text("Gerenciamento de Usuários")
            .font(.headline)
            .foregroundStyle(AppTheme.strongText)
          Spacer()
          if horizontalSizeClass == .compact {
            VStack(alignment: .trailing, spacing: 8) {
              newUserButtonCompact
              refreshButton
            }
          } else {
            newUserButtonCompact
            refreshButton
          }
        }

        if vm.visibleUsers.isEmpty {
          Text("Nenhum usuário encontrado.")
            .foregroundStyle(AppTheme.subtleText)
            .padding(.vertical, 8)
        } else {
          ForEach(vm.visibleUsers) { row in
            if horizontalSizeClass == .compact {
              userRowCompact(row)
            } else {
              userRowRegular(row)
            }
            Divider().overlay(AppTheme.border)
          }
        }
      }
    }
  }

  private var groupsSection: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .top) {
          Text("Gerenciamento de Grupos")
            .font(.headline)
            .foregroundStyle(AppTheme.strongText)
          Spacer()
          createGroupButtonCompact
        }

        if vm.visibleGroups.isEmpty {
          Text("Nenhum grupo encontrado.")
            .foregroundStyle(AppTheme.subtleText)
            .padding(.vertical, 8)
        } else {
          ForEach(vm.visibleGroups) { row in
            if horizontalSizeClass == .compact {
              groupRowCompact(row)
            } else {
              groupRowRegular(row)
            }
            Divider().overlay(AppTheme.border)
          }
        }
      }
    }
  }

  private var filteredGroupsByForm: [GrupoRow] {
    guard let empresaId = userForm.empresaId else { return [] }
    return vm.groups.filter { group in
      if group.isMaster { return vm.accessContext.isMaster }
      return group.empresaId == empresaId
    }
  }

  private func prepareCreateUserForm() {
    userForm = UserFormState()
    let empresas = vm.filteredEmpresasForCurrentUser
    userForm.empresaId = empresas.first?.id
    userForm.grupoId = vm.groups.first(where: { $0.empresaId == userForm.empresaId || $0.isMaster })?.id
  }

  private func prepareEditUserForm(_ row: AdminUserRow) {
    userForm = UserFormState(
      nome: row.nome ?? "",
      email: row.email,
      password: "",
      empresaId: row.empresaId,
      grupoId: row.grupoId,
      ativo: row.ativo ?? true,
      isMaster: row.role == "master"
    )
  }

  private func prepareCreateGroupForm() {
    groupForm = GroupFormState()
    groupForm.empresaId = vm.filteredEmpresasForCurrentUser.first?.id
    groupForm.telasPermitidas = Set(allAllowedScreens)
  }

  private func prepareEditGroupForm(_ row: GrupoRow) {
    groupForm = GroupFormState(
      nome: row.nome,
      descricao: row.descricao ?? "",
      isMaster: row.isMaster,
      empresaId: row.empresaId,
      telasPermitidas: Set(row.telasPermitidas)
    )
  }

  private var newUserButton: some View {
    Button {
      prepareCreateUserForm()
      activeModal = .createUser
    } label: {
      Label("Novo Usuário", systemImage: "person.badge.plus")
    }
    .buttonStyle(.borderedProminent)
    .disabled(!vm.accessContext.isMaster)
  }

  private var newUserButtonCompact: some View {
    Button {
      prepareCreateUserForm()
      activeModal = .createUser
    } label: {
      Label("Novo", systemImage: "person.badge.plus")
    }
    .buttonStyle(.borderedProminent)
    .disabled(!vm.accessContext.isMaster)
  }

  private var refreshButton: some View {
    Button(vm.loading ? "Atualizando..." : "Atualizar") {
      Task { await vm.refresh() }
    }
    .buttonStyle(.borderedProminent)
    .disabled(vm.loading)
  }

  private var createGroupButtonCompact: some View {
    Button {
      prepareCreateGroupForm()
      activeModal = .createGroup
    } label: {
      Label(horizontalSizeClass == .compact ? "Grupo" : "Criar Grupo", systemImage: "shield")
    }
    .buttonStyle(.borderedProminent)
    .disabled(!vm.accessContext.isMaster)
  }

  private func userRowRegular(_ row: AdminUserRow) -> some View {
    HStack(spacing: 10) {
      VStack(alignment: .leading, spacing: 2) {
        Text(row.nome ?? "-")
          .foregroundStyle(AppTheme.strongText)
        Text(row.email)
          .font(.caption)
          .foregroundStyle(AppTheme.subtleText)
      }

      Spacer()

      Text(row.empresaNome ?? "-")
        .font(.caption)
        .foregroundStyle(AppTheme.strongText.opacity(0.85))

      Text(row.grupoNome ?? "-")
        .font(.caption)
        .foregroundStyle(AppTheme.strongText.opacity(0.85))

      Text((row.ativo ?? true) ? "Ativo" : "Inativo")
        .font(.caption.bold())
        .foregroundStyle((row.ativo ?? true) ? .green : .red)

      Text(row.ultimoLoginAt.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "-")
        .font(.caption)
        .foregroundStyle(AppTheme.strongText.opacity(0.8))

      if vm.accessContext.isMaster {
        actionButtonsForUser(row)
      }
    }
  }

  private func userRowCompact(_ row: AdminUserRow) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(row.nome ?? "-")
        .foregroundStyle(AppTheme.strongText)
        .font(.headline)
      Text(row.email)
        .font(.caption)
        .foregroundStyle(AppTheme.subtleText)

      HStack {
        Text("Empresa:")
          .font(.caption2)
          .foregroundStyle(AppTheme.subtleText)
        Text(row.empresaNome ?? "-")
          .font(.caption)
          .foregroundStyle(AppTheme.strongText.opacity(0.9))
      }
      HStack {
        Text("Grupo:")
          .font(.caption2)
          .foregroundStyle(AppTheme.subtleText)
        Text(row.grupoNome ?? "-")
          .font(.caption)
          .foregroundStyle(AppTheme.strongText.opacity(0.9))
      }
      HStack {
        Text("Status:")
          .font(.caption2)
          .foregroundStyle(AppTheme.subtleText)
        Text((row.ativo ?? true) ? "Ativo" : "Inativo")
          .font(.caption.bold())
          .foregroundStyle((row.ativo ?? true) ? .green : .red)
      }

      if vm.accessContext.isMaster {
        actionButtonsForUser(row)
      }
    }
  }

  private func actionButtonsForUser(_ row: AdminUserRow) -> some View {
    HStack(spacing: 6) {
      Button {
        selectedUser = row
        prepareEditUserForm(row)
        activeModal = .editUser
      } label: {
        Label("Editar", systemImage: "pencil")
      }
      .buttonStyle(.borderedProminent)
      .tint(AppTheme.primaryAccent)
      .controlSize(.small)

      Button {
        Task { await vm.sendResetPassword(email: row.email) }
      } label: {
        Label("Reset", systemImage: "envelope.badge")
      }
      .buttonStyle(.borderedProminent)
      .tint(.indigo)
      .controlSize(.small)

      Button(role: .destructive) {
        selectedUser = row
        showDeleteUserConfirm = true
      } label: {
        Label("Excluir", systemImage: "trash")
      }
      .buttonStyle(.borderedProminent)
      .tint(.red)
      .controlSize(.small)
    }
  }

  private func groupRowRegular(_ row: GrupoRow) -> some View {
    HStack(spacing: 10) {
      VStack(alignment: .leading, spacing: 2) {
        Text(row.nome)
          .foregroundStyle(AppTheme.strongText)
        Text(row.descricao ?? "-")
          .font(.caption)
          .foregroundStyle(AppTheme.subtleText)
      }

      Spacer()

      Text(row.empresaNome ?? "-")
        .font(.caption)
        .foregroundStyle(AppTheme.strongText.opacity(0.85))

      if vm.accessContext.isMaster {
        actionButtonsForGroup(row)
      }
    }
  }

  private func groupRowCompact(_ row: GrupoRow) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(row.nome)
        .foregroundStyle(AppTheme.strongText)
        .font(.headline)
      Text(row.descricao ?? "-")
        .font(.caption)
        .foregroundStyle(AppTheme.subtleText)
      HStack {
        Text("Empresa:")
          .font(.caption2)
          .foregroundStyle(AppTheme.subtleText)
        Text(row.empresaNome ?? "-")
          .font(.caption)
          .foregroundStyle(AppTheme.strongText.opacity(0.9))
      }
      if vm.accessContext.isMaster {
        actionButtonsForGroup(row)
      }
    }
  }

  private func actionButtonsForGroup(_ row: GrupoRow) -> some View {
    HStack(spacing: 6) {
      Button {
        selectedGroup = row
        prepareEditGroupForm(row)
        activeModal = .editGroup
      } label: {
        Label("Editar", systemImage: "pencil")
      }
      .buttonStyle(.borderedProminent)
      .tint(AppTheme.primaryAccent)
      .controlSize(.small)

      Button(role: .destructive) {
        selectedGroup = row
        showDeleteGroupConfirm = true
      } label: {
        Label("Excluir", systemImage: "trash")
      }
      .buttonStyle(.borderedProminent)
      .tint(.red)
      .controlSize(.small)
    }
  }
}

private struct UserFormModal: View {
  let title: String
  @Binding var form: UserFormState
  let empresas: [EmpresaRow]
  let grupos: [GrupoRow]
  let loading: Bool
  let canEditMaster: Bool
  let onCancel: () -> Void
  let onSubmit: () -> Void

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 10) {
          TextField("Nome", text: $form.nome)
            .textFieldStyle(.roundedBorder)
          TextField("Email", text: $form.email)
            .textFieldStyle(.roundedBorder)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)

          if title.contains("Novo") {
            SecureField("Senha", text: $form.password)
              .textFieldStyle(.roundedBorder)
          }

          Picker("Empresa", selection: $form.empresaId) {
            ForEach(empresas) { empresa in
              Text(empresa.nome).tag(Optional(empresa.id))
            }
          }
          .pickerStyle(.menu)

          Picker("Grupo", selection: $form.grupoId) {
            Text("Sem grupo").tag(Optional<UUID>.none)
            ForEach(grupos) { group in
              Text(group.nome).tag(Optional(group.id))
            }
          }
          .pickerStyle(.menu)

          if canEditMaster {
            Toggle("Usuário master", isOn: $form.isMaster)
          }

          Toggle("Usuário ativo", isOn: $form.ativo)
        }
        .padding(16)
      }
      .background(AppTheme.pageBackground)
      .navigationTitle(title)
      .navigationBarBackButtonHidden(true)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button(action: onCancel) {
            Image(systemName: "chevron.left")
          }
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button(loading ? "Salvando..." : "Salvar", action: onSubmit)
            .buttonStyle(.borderedProminent)
            .disabled(
              loading ||
                form.nome.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                form.email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                (title.contains("Novo") && form.password.count < 6)
            )
        }
      }
    }
  }
}

private struct GroupFormModal: View {
  let title: String
  @Binding var form: GroupFormState
  let empresas: [EmpresaRow]
  let allAllowedScreens: [String]
  let loading: Bool
  let canEditMaster: Bool
  let onCancel: () -> Void
  let onSubmit: () -> Void

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 10) {
          TextField("Nome do Grupo", text: $form.nome)
            .textFieldStyle(.roundedBorder)
          TextField("Descrição", text: $form.descricao)
            .textFieldStyle(.roundedBorder)

          if canEditMaster {
            Toggle("Grupo Master", isOn: $form.isMaster)
          }

          if !form.isMaster {
            Picker("Empresa", selection: $form.empresaId) {
              Text("Selecione uma empresa").tag(Optional<UUID>.none)
              ForEach(empresas) { empresa in
                Text(empresa.nome).tag(Optional(empresa.id))
              }
            }
            .pickerStyle(.menu)

            VStack(alignment: .leading, spacing: 6) {
              Text("Telas permitidas")
                .font(.headline)
                .foregroundStyle(AppTheme.strongText)

              ForEach(allAllowedScreens, id: \.self) { screen in
                Toggle(screenLabel(screen), isOn: Binding(
                  get: { form.telasPermitidas.contains(screen) },
                  set: { checked in
                    if checked { form.telasPermitidas.insert(screen) }
                    else { form.telasPermitidas.remove(screen) }
                  }
                ))
              }
            }
          }
        }
        .padding(16)
      }
      .background(AppTheme.pageBackground)
      .navigationTitle(title)
      .navigationBarBackButtonHidden(true)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button(action: onCancel) {
            Image(systemName: "chevron.left")
          }
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button(loading ? "Salvando..." : "Salvar", action: onSubmit)
            .buttonStyle(.borderedProminent)
            .disabled(loading || form.nome.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
      }
    }
  }

  private func screenLabel(_ key: String) -> String {
    switch key {
    case "home": return "Home"
    case "crypto": return "Crypto"
    case "carteira": return "Carteira"
    case "admin": return "Painel Administrativo"
    case "admin.usuarios": return "Admin: Usuários"
    case "admin.empresas": return "Admin: Empresas"
    default: return key
    }
  }
}
