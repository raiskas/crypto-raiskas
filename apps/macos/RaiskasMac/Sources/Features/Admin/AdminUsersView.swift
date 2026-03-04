import SwiftUI

private enum AdminUsersTab {
  case none
}

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
}

struct AdminUsersView: View {
  @StateObject private var vm = AdminUsersViewModel()

  @State private var selectedUser: AdminUserRow?
  @State private var userForm = UserFormState()

  @State private var selectedGroup: GrupoRow?
  @State private var groupForm = GroupFormState()

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
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

        userSection
        groupSection
      }
      .padding(20)
    }
    .background(AppTheme.pageBackground)
    .task {
      if vm.users.isEmpty, vm.groups.isEmpty {
        await vm.refresh()
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: .openAdminNewUser)) { _ in
      userForm = UserFormState()
      openCreateUserWindow()
    }
    .onReceive(NotificationCenter.default.publisher(for: .openAdminNewGroup)) { _ in
      groupForm = GroupFormState()
      openCreateGroupWindow()
    }
  }

  private var userSection: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text("Gerenciamento de Usuários")
              .font(.title3.bold())
              .foregroundStyle(AppTheme.strongText)
            Text("Gerencie usuários do sistema, senhas e permissões")
              .font(.subheadline)
              .foregroundStyle(AppTheme.subtleText)
          }
          Spacer()
          Button {
            userForm = UserFormState()
            openCreateUserWindow()
          } label: {
            Label("Novo Usuário", systemImage: "person.badge.plus")
          }
          .buttonStyle(.borderedProminent)
          .disabled(!vm.accessContext.isMaster)

          Button(vm.loading ? "Atualizando..." : "Atualizar") {
            Task { await vm.refresh() }
          }
          .buttonStyle(.bordered)
          .disabled(vm.loading)
        }

        Table(vm.users) {
          TableColumn("Nome") { row in
            Text(row.nome ?? "-")
              .foregroundStyle(.white)
          }
          TableColumn("Email") { row in
            Text(row.email)
              .foregroundStyle(.white.opacity(0.85))
          }
          TableColumn("Empresa") { row in
            Text(row.empresaNome ?? "-")
              .foregroundStyle(.white.opacity(0.85))
          }
          TableColumn("Grupo") { row in
            Text(row.grupoNome ?? "-")
              .foregroundStyle(.white.opacity(0.85))
          }
          TableColumn("Status") { row in
            Text((row.ativo ?? true) ? "Ativo" : "Inativo")
              .foregroundStyle((row.ativo ?? true) ? .green : .red)
          }
          TableColumn("Criado em") { row in
            Text(row.createdAt.map { $0.formatted(date: .numeric, time: .shortened) } ?? "-")
              .foregroundStyle(.white.opacity(0.78))
          }
          TableColumn("Último login") { row in
            Text(row.ultimoLoginAt.map { $0.formatted(date: .numeric, time: .shortened) } ?? "-")
              .foregroundStyle(.white.opacity(0.78))
          }
          TableColumn("Ações") { row in
            HStack(spacing: 6) {
              Button("Editar") {
                selectedUser = row
                userForm = UserFormState(
                  nome: row.nome ?? "",
                  email: row.email,
                  password: "",
                  empresaId: row.empresaId,
                  grupoId: row.grupoId,
                  ativo: row.ativo ?? true,
                  isMaster: (row.role ?? "").uppercased() == "MASTER"
                )
                openEditUserWindow()
              }
              .buttonStyle(.bordered)
              .controlSize(.small)
              .disabled(!vm.accessContext.isMaster)

              Button("Excluir", role: .destructive) {
                selectedUser = row
                openDeleteUserWindow()
              }
              .buttonStyle(.bordered)
              .controlSize(.small)
              .disabled(!vm.accessContext.isMaster)
            }
          }
        }
        .tableStyle(.inset(alternatesRowBackgrounds: true))
        .scrollContentBackground(.hidden)
        .frame(minHeight: 300)
      }
    }
  }

  private var groupSection: some View {
    AppCard {
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text("Gerenciamento de Grupos")
              .font(.title3.bold())
              .foregroundStyle(AppTheme.strongText)
            Text("Crie, edite e remova grupos de permissão.")
              .font(.subheadline)
              .foregroundStyle(AppTheme.subtleText)
          }
          Spacer()
          Button {
            groupForm = GroupFormState()
            openCreateGroupWindow()
          } label: {
            Label("Criar Grupo", systemImage: "shield.lefthalf.filled")
          }
          .buttonStyle(.borderedProminent)
          .disabled(!vm.accessContext.isMaster)
        }

        Table(vm.groups) {
          TableColumn("Nome") { row in
            Text(row.nome)
              .foregroundStyle(.white)
          }
          TableColumn("Empresa") { row in
            Text(row.empresaNome ?? "-")
              .foregroundStyle(.white.opacity(0.85))
          }
          TableColumn("Descrição") { row in
            Text(row.descricao ?? "-")
              .foregroundStyle(.white.opacity(0.85))
          }
          TableColumn("Ações") { row in
            HStack(spacing: 6) {
              Button("Editar") {
                selectedGroup = row
                groupForm = GroupFormState(
                  nome: row.nome,
                  descricao: row.descricao ?? "",
                  isMaster: row.isMaster,
                  empresaId: row.empresaId,
                  telasPermitidas: Set(row.telasPermitidas)
                )
                openEditGroupWindow()
              }
              .buttonStyle(.bordered)
              .controlSize(.small)
              .disabled(!vm.accessContext.isMaster)

              Button("Excluir", role: .destructive) {
                selectedGroup = row
                openDeleteGroupWindow()
              }
              .buttonStyle(.bordered)
              .controlSize(.small)
              .disabled(!vm.accessContext.isMaster)
            }
          }
        }
        .tableStyle(.inset(alternatesRowBackgrounds: true))
        .scrollContentBackground(.hidden)
        .frame(minHeight: 260)
      }
    }
  }

  private func openCreateUserWindow() {
    AppWindowPresenter.shared.present(
      id: "admin_user_create",
      title: "Novo Usuário",
      size: CGSize(width: 620, height: 560),
      resizable: true
    ) {
      UserCreateModal(
        form: $userForm,
        empresas: vm.empresas,
        groups: vm.groups,
        saving: vm.actionLoading,
        onCancel: { AppWindowPresenter.shared.dismiss(id: "admin_user_create") },
        onSave: {
          Task {
            await vm.createUser(userForm)
            if vm.error == nil {
              AppWindowPresenter.shared.dismiss(id: "admin_user_create")
            }
          }
        }
      )
    }
  }

  private func openEditUserWindow() {
    guard selectedUser != nil else { return }
    AppWindowPresenter.shared.present(
      id: "admin_user_edit",
      title: "Editar Usuário",
      size: CGSize(width: 620, height: 620),
      resizable: true
    ) {
      UserEditModal(
        user: selectedUser,
        form: $userForm,
        empresas: vm.empresas,
        groups: vm.groups,
        saving: vm.actionLoading,
        canResetPassword: vm.accessContext.isMaster,
        onResetPassword: {
          guard let user = selectedUser else { return }
          Task { await vm.sendResetPassword(email: user.email) }
        },
        onCancel: { AppWindowPresenter.shared.dismiss(id: "admin_user_edit") },
        onSave: {
          guard let user = selectedUser else { return }
          Task {
            await vm.updateUser(userId: user.id, userForm)
            if vm.error == nil {
              AppWindowPresenter.shared.dismiss(id: "admin_user_edit")
            }
          }
        }
      )
    }
  }

  private func openDeleteUserWindow() {
    guard selectedUser != nil else { return }
    AppWindowPresenter.shared.present(
      id: "admin_user_delete_confirm",
      title: "Excluir Usuário",
      size: CGSize(width: 520, height: 230),
      resizable: false
    ) {
      AppConfirmDialogWindow(
        title: "Confirmar Exclusão",
        message: "Tem certeza que deseja remover o usuário \(selectedUser?.nome ?? selectedUser?.email ?? "")?",
        confirmLabel: "Excluir",
        confirmRole: .destructive,
        onCancel: {
          AppWindowPresenter.shared.dismiss(id: "admin_user_delete_confirm")
        },
        onConfirm: {
          guard let user = selectedUser else { return }
          Task {
            await vm.deleteUser(userId: user.id)
            AppWindowPresenter.shared.dismiss(id: "admin_user_delete_confirm")
          }
        }
      )
    }
  }

  private func openCreateGroupWindow() {
    AppWindowPresenter.shared.present(
      id: "admin_group_create",
      title: "Criar Grupo",
      size: CGSize(width: 620, height: 620),
      resizable: true
    ) {
      GroupModal(
        title: "Criar Novo Grupo",
        form: $groupForm,
        empresas: vm.empresas,
        saving: vm.actionLoading,
        onCancel: { AppWindowPresenter.shared.dismiss(id: "admin_group_create") },
        onSave: {
          Task {
            await vm.createGroup(groupForm)
            if vm.error == nil {
              AppWindowPresenter.shared.dismiss(id: "admin_group_create")
            }
          }
        }
      )
    }
  }

  private func openEditGroupWindow() {
    guard selectedGroup != nil else { return }
    AppWindowPresenter.shared.present(
      id: "admin_group_edit",
      title: "Editar Grupo",
      size: CGSize(width: 620, height: 620),
      resizable: true
    ) {
      GroupModal(
        title: "Editar Grupo",
        form: $groupForm,
        empresas: vm.empresas,
        saving: vm.actionLoading,
        onCancel: { AppWindowPresenter.shared.dismiss(id: "admin_group_edit") },
        onSave: {
          guard let group = selectedGroup else { return }
          Task {
            await vm.updateGroup(groupId: group.id, groupForm)
            if vm.error == nil {
              AppWindowPresenter.shared.dismiss(id: "admin_group_edit")
            }
          }
        }
      )
    }
  }

  private func openDeleteGroupWindow() {
    guard selectedGroup != nil else { return }
    AppWindowPresenter.shared.present(
      id: "admin_group_delete_confirm",
      title: "Remover Grupo",
      size: CGSize(width: 520, height: 230),
      resizable: false
    ) {
      AppConfirmDialogWindow(
        title: "Confirmar Remoção",
        message: "Tem certeza que deseja remover o grupo \(selectedGroup?.nome ?? "")?",
        confirmLabel: "Remover",
        confirmRole: .destructive,
        onCancel: {
          AppWindowPresenter.shared.dismiss(id: "admin_group_delete_confirm")
        },
        onConfirm: {
          guard let group = selectedGroup else { return }
          Task {
            await vm.deleteGroup(groupId: group.id)
            AppWindowPresenter.shared.dismiss(id: "admin_group_delete_confirm")
          }
        }
      )
    }
  }
}

private struct UserCreateModal: View {
  @Binding var form: UserFormState
  let empresas: [EmpresaRow]
  let groups: [GrupoRow]
  let saving: Bool
  let onCancel: () -> Void
  let onSave: () -> Void

  var body: some View {
    AppModalContainer(
      title: "Criar Novo Usuário",
      subtitle: "Preencha os dados para criar um novo usuário.",
      width: 560
    ) {
      TextField("Nome", text: $form.nome)
        .textFieldStyle(.roundedBorder)
      TextField("Email", text: $form.email)
        .textFieldStyle(.roundedBorder)
      SecureField("Senha", text: $form.password)
        .textFieldStyle(.roundedBorder)

      Picker("Empresa", selection: Binding(get: {
        form.empresaId ?? empresas.first?.id
      }, set: { form.empresaId = $0 })) {
        ForEach(empresas) { empresa in
          Text(empresa.nome).tag(Optional(empresa.id))
        }
      }

      Picker("Grupo", selection: Binding(get: {
        form.grupoId
      }, set: { form.grupoId = $0 })) {
        ForEach(groups) { group in
          Text(group.nome).tag(Optional(group.id))
        }
      }

      HStack {
        Spacer()
        Button("Cancelar", action: onCancel)
          .buttonStyle(.bordered)
        Button(saving ? "Salvando..." : "Criar Usuário", action: onSave)
          .buttonStyle(.borderedProminent)
          .disabled(
            saving
              || form.nome.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
              || form.email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
              || form.password.count < 6
              || form.empresaId == nil
              || form.grupoId == nil
          )
      }
    }
  }
}

private struct UserEditModal: View {
  let user: AdminUserRow?
  @Binding var form: UserFormState
  let empresas: [EmpresaRow]
  let groups: [GrupoRow]
  let saving: Bool
  let canResetPassword: Bool
  let onResetPassword: () -> Void
  let onCancel: () -> Void
  let onSave: () -> Void

  var body: some View {
    AppModalContainer(
      title: "Editar Usuário",
      subtitle: "Atualize os dados e permissões do usuário.",
      width: 560
    ) {
      TextField("Nome", text: $form.nome)
        .textFieldStyle(.roundedBorder)
      TextField("Email", text: $form.email)
        .textFieldStyle(.roundedBorder)

      Picker("Empresa", selection: Binding(get: {
        form.empresaId ?? empresas.first?.id
      }, set: { form.empresaId = $0 })) {
        ForEach(empresas) { empresa in
          Text(empresa.nome).tag(Optional(empresa.id))
        }
      }

      Picker("Grupo", selection: Binding(get: {
        form.grupoId
      }, set: { form.grupoId = $0 })) {
        Text("Sem grupo").tag(Optional<UUID>.none)
        ForEach(groups) { group in
          Text(group.nome).tag(Optional(group.id))
        }
      }

      Toggle("Ativo", isOn: $form.ativo)
      Toggle("Master", isOn: $form.isMaster)

      if canResetPassword {
        Button("Resetar Senha de \(user?.email ?? "usuário")", action: onResetPassword)
          .buttonStyle(.bordered)
      }

      HStack {
        Spacer()
        Button("Cancelar", action: onCancel)
          .buttonStyle(.bordered)
        Button(saving ? "Salvando..." : "Salvar Alterações", action: onSave)
          .buttonStyle(.borderedProminent)
          .disabled(saving)
      }
    }
  }
}

private struct GroupModal: View {
  let title: String
  @Binding var form: GroupFormState
  let empresas: [EmpresaRow]
  let saving: Bool
  let onCancel: () -> Void
  let onSave: () -> Void

  private let availableScreens: [(id: String, label: String)] = [
    ("home", "Home"),
    ("crypto", "Crypto"),
    ("carteira", "Carteira"),
    ("admin", "Painel Administrativo"),
    ("admin_usuarios", "Admin: Usuários"),
    ("admin_empresas", "Admin: Empresas"),
  ]

  var body: some View {
    AppModalContainer(
      title: title,
      subtitle: "Defina empresa e permissões conforme o padrão web.",
      width: 560
    ) {
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          TextField("Nome do Grupo", text: $form.nome)
            .textFieldStyle(.roundedBorder)
          TextField("Descrição", text: $form.descricao)
            .textFieldStyle(.roundedBorder)
          Toggle("Grupo Master", isOn: $form.isMaster)

          if !form.isMaster {
            Picker("Empresa", selection: Binding(get: {
              form.empresaId ?? empresas.first?.id
            }, set: { form.empresaId = $0 })) {
              ForEach(empresas) { empresa in
                Text(empresa.nome).tag(Optional(empresa.id))
              }
            }
          }

          if !form.isMaster {
            VStack(alignment: .leading, spacing: 8) {
              Text("Telas permitidas")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.strongText)

              ForEach(availableScreens, id: \.id) { screen in
                Toggle(
                  screen.label,
                  isOn: Binding(
                    get: { form.telasPermitidas.contains(screen.id) },
                    set: { checked in
                      if checked {
                        form.telasPermitidas.insert(screen.id)
                      } else {
                        form.telasPermitidas.remove(screen.id)
                      }
                    }
                  )
                )
                .toggleStyle(.checkbox)
              }
            }
          }
        }
      }
      .frame(maxHeight: 340)

      HStack {
        Spacer()
        Button("Cancelar", action: onCancel)
          .buttonStyle(.bordered)
        Button(saving ? "Salvando..." : "Salvar", action: onSave)
          .buttonStyle(.borderedProminent)
          .disabled(saving || form.nome.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (!form.isMaster && form.empresaId == nil))
      }
    }
  }
}
