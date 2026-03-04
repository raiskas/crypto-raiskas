import SwiftUI

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
  @StateObject private var vm = AdminPanelViewModel()

  var body: some View {
    VStack(alignment: .leading, spacing: 24) {
      SectionTitle(
        title: "Painel Administrativo",
        subtitle: ""
      )

      if let error = vm.error {
        AppCard {
          Text(error)
            .font(.caption)
            .foregroundStyle(.red)
        }
      }

      HStack(spacing: 14) {
        AdminMenuCard(
          icon: "person.3.fill",
          title: "Gerenciar Usuários",
          description: "Criar, editar, desativar e redefinir senhas de usuários",
          onTap: { NotificationCenter.default.post(name: .navigateToAdminUsuarios, object: nil) }
        )

        AdminMenuCard(
          icon: "building.2.fill",
          title: "Gerenciar Empresas",
          description: "Criar, editar e remover empresas",
          onTap: { NotificationCenter.default.post(name: .navigateToAdminEmpresas, object: nil) }
        )
      }

      Spacer(minLength: 0)
    }
    .padding(20)
    .background(AppTheme.pageBackground)
    .task {
      await vm.refresh()
    }
  }
}

private struct AdminMenuCard: View {
  let icon: String
  let title: String
  let description: String
  let onTap: () -> Void

  var body: some View {
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
              .lineLimit(3)
          }
        }

        Button("Acessar", action: onTap)
          .buttonStyle(.bordered)
      }
      .frame(maxWidth: .infinity, minHeight: 170, alignment: .leading)
    }
  }
}

@MainActor
final class AdminEmpresasViewModel: ObservableObject {
  @Published var loading = false
  @Published var actionLoading = false
  @Published var error: String?
  @Published var success: String?
  @Published var empresas: [EmpresaRow] = []
  @Published var accessContext = AdminAccessContext(isMaster: false, empresaId: nil)

  func refresh() async {
    loading = true
    defer { loading = false }

    do {
      accessContext = try await SupabaseService.shared.fetchAdminAccessContext()
      empresas = try await SupabaseService.shared.fetchEmpresas(limit: 400)
      error = nil
    } catch {
      self.error = "Erro ao carregar empresas: \(error.localizedDescription)"
    }
  }

  func create(input: EmpresaUpsertInput) async {
    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.createEmpresa(input: input)
      success = "Empresa criada com sucesso!"
      error = nil
      await refresh()
    } catch {
      self.error = "Erro ao criar empresa: \(error.localizedDescription)"
      self.success = nil
    }
  }

  func update(id: UUID, input: EmpresaUpsertInput) async {
    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.updateEmpresa(id: id, input: input)
      success = "Empresa atualizada com sucesso!"
      error = nil
      await refresh()
    } catch {
      self.error = "Erro ao atualizar empresa: \(error.localizedDescription)"
      self.success = nil
    }
  }

  func delete(id: UUID) async {
    actionLoading = true
    defer { actionLoading = false }

    do {
      try await SupabaseService.shared.deleteEmpresa(id: id)
      success = "Empresa removida com sucesso!"
      error = nil
      await refresh()
    } catch {
      self.error = "Erro ao remover empresa: \(error.localizedDescription)"
      self.success = nil
    }
  }
}

private struct EmpresaFormState {
  var nome = ""
  var cnpj = ""
  var telefone = ""
  var emailContato = ""
  var enderecoRua = ""
  var enderecoNumero = ""
  var enderecoComplemento = ""
  var enderecoBairro = ""
  var enderecoCidade = ""
  var enderecoEstado = ""
  var enderecoCep = ""
  var ativo = true

  func toInput() -> EmpresaUpsertInput {
    EmpresaUpsertInput(
      nome: nome,
      cnpj: cnpj.nilIfBlank,
      telefone: telefone.nilIfBlank,
      emailContato: emailContato.nilIfBlank,
      enderecoRua: enderecoRua.nilIfBlank,
      enderecoNumero: enderecoNumero.nilIfBlank,
      enderecoComplemento: enderecoComplemento.nilIfBlank,
      enderecoBairro: enderecoBairro.nilIfBlank,
      enderecoCidade: enderecoCidade.nilIfBlank,
      enderecoEstado: enderecoEstado.nilIfBlank,
      enderecoCep: enderecoCep.nilIfBlank,
      ativo: ativo
    )
  }

  static func from(_ row: EmpresaRow) -> EmpresaFormState {
    EmpresaFormState(
      nome: row.nome,
      cnpj: row.cnpj ?? "",
      telefone: row.telefone ?? "",
      emailContato: row.emailContato ?? "",
      enderecoRua: row.enderecoRua ?? "",
      enderecoNumero: row.enderecoNumero ?? "",
      enderecoComplemento: row.enderecoComplemento ?? "",
      enderecoBairro: row.enderecoBairro ?? "",
      enderecoCidade: row.enderecoCidade ?? "",
      enderecoEstado: row.enderecoEstado ?? "",
      enderecoCep: row.enderecoCep ?? "",
      ativo: row.ativo ?? true
    )
  }
}

struct AdminEmpresasView: View {
  @StateObject private var vm = AdminEmpresasViewModel()
  @State private var selectedEmpresa: EmpresaRow?
  @State private var form = EmpresaFormState()

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text("Empresas")
          .font(.system(size: 30, weight: .bold))
          .foregroundStyle(AppTheme.strongText)
        Spacer()
        Button {
          form = EmpresaFormState()
          openCreateEmpresaWindow()
        } label: {
          Label("Criar Empresa", systemImage: "plus.circle")
        }
        .buttonStyle(.borderedProminent)
        .disabled(!vm.accessContext.isMaster)
      }

      VStack(alignment: .leading, spacing: 2) {
        Text("Gerenciamento de Empresas")
          .font(.title2.bold())
          .foregroundStyle(AppTheme.strongText)
        Text("Adicione, edite ou remova empresas do sistema.")
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

      AppCard {
        VStack(alignment: .leading, spacing: 10) {
          HStack {
            Text("Gerenciamento de Empresas")
              .font(.headline)
              .foregroundStyle(AppTheme.strongText)
            Spacer()
            Button {
              form = EmpresaFormState()
              openCreateEmpresaWindow()
            } label: {
              Label("Criar Empresa", systemImage: "plus.circle")
            }
            .buttonStyle(.bordered)
            .disabled(!vm.accessContext.isMaster)

            Button(vm.loading ? "Atualizando..." : "Atualizar") {
              Task { await vm.refresh() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(vm.loading)
          }

          Table(vm.empresas) {
            TableColumn("Nome") { row in
              Text(row.nome)
                .foregroundStyle(AppTheme.strongText)
            }
            TableColumn("CNPJ") { row in
              Text(row.cnpj ?? "-")
                .foregroundStyle(AppTheme.strongText.opacity(0.85))
            }
            TableColumn("Email Contato") { row in
              Text(row.emailContato ?? "-")
                .foregroundStyle(AppTheme.strongText.opacity(0.85))
            }
            TableColumn("Status") { row in
              Text((row.ativo ?? true) ? "Ativa" : "Inativa")
                .foregroundStyle((row.ativo ?? true) ? .green : .red)
            }
            TableColumn("Criado em") { row in
              Text(row.criadoEm.map { AppFormatters.dateDayMonth.string(from: $0) } ?? "-")
                .foregroundStyle(AppTheme.strongText.opacity(0.8))
            }
            TableColumn("Ações") { row in
              HStack(spacing: 8) {
                Button {
                  selectedEmpresa = row
                  form = .from(row)
                  openEditEmpresaWindow()
                } label: {
                  Image(systemName: "pencil")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(!vm.accessContext.isMaster)

                Button(role: .destructive) {
                  selectedEmpresa = row
                  openDeleteEmpresaWindow()
                } label: {
                  Image(systemName: "trash")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(!vm.accessContext.isMaster)
              }
            }
          }
          .tableStyle(.inset(alternatesRowBackgrounds: true))
          .scrollContentBackground(.hidden)
          .frame(minHeight: 420)
        }
      }

      Spacer(minLength: 0)
    }
    .padding(20)
    .background(AppTheme.pageBackground)
    .task {
      if vm.empresas.isEmpty { await vm.refresh() }
    }
    .onReceive(NotificationCenter.default.publisher(for: .openAdminNewEmpresa)) { _ in
      form = EmpresaFormState()
      openCreateEmpresaWindow()
    }
  }

  private func openCreateEmpresaWindow() {
    AppWindowPresenter.shared.present(
      id: "admin_empresa_create",
      title: "Criar Empresa",
      size: CGSize(width: 780, height: 760),
      resizable: true
    ) {
      EmpresaFormModal(
        title: "Criar Empresa",
        form: $form,
        loading: vm.actionLoading,
        onCancel: { AppWindowPresenter.shared.dismiss(id: "admin_empresa_create") },
        onSubmit: {
          Task {
            await vm.create(input: form.toInput())
            if vm.error == nil {
              AppWindowPresenter.shared.dismiss(id: "admin_empresa_create")
            }
          }
        }
      )
    }
  }

  private func openEditEmpresaWindow() {
    guard selectedEmpresa != nil else { return }
    AppWindowPresenter.shared.present(
      id: "admin_empresa_edit",
      title: "Editar Empresa",
      size: CGSize(width: 780, height: 760),
      resizable: true
    ) {
      EmpresaFormModal(
        title: "Editar Empresa",
        form: $form,
        loading: vm.actionLoading,
        onCancel: { AppWindowPresenter.shared.dismiss(id: "admin_empresa_edit") },
        onSubmit: {
          guard let row = selectedEmpresa else { return }
          Task {
            await vm.update(id: row.id, input: form.toInput())
            if vm.error == nil {
              AppWindowPresenter.shared.dismiss(id: "admin_empresa_edit")
            }
          }
        }
      )
    }
  }

  private func openDeleteEmpresaWindow() {
    guard selectedEmpresa != nil else { return }
    AppWindowPresenter.shared.present(
      id: "admin_empresa_delete_confirm",
      title: "Remover Empresa",
      size: CGSize(width: 500, height: 230),
      resizable: false
    ) {
      AppConfirmDialogWindow(
        title: "Remover empresa",
        message: "Tem certeza que deseja remover esta empresa?",
        confirmLabel: "Excluir",
        confirmRole: .destructive,
        onCancel: {
          AppWindowPresenter.shared.dismiss(id: "admin_empresa_delete_confirm")
        },
        onConfirm: {
          guard let row = selectedEmpresa else { return }
          Task {
            await vm.delete(id: row.id)
            AppWindowPresenter.shared.dismiss(id: "admin_empresa_delete_confirm")
          }
        }
      )
    }
  }
}

private struct EmpresaFormModal: View {
  let title: String
  @Binding var form: EmpresaFormState
  let loading: Bool
  let onCancel: () -> Void
  let onSubmit: () -> Void

  var body: some View {
    AppModalContainer(
      title: title,
      subtitle: "Preencha os campos da empresa.",
      width: 700
    ) {
      Group {
        TextField("Nome", text: $form.nome)
        TextField("CNPJ", text: $form.cnpj)
        TextField("Telefone", text: $form.telefone)
        TextField("Email de contato", text: $form.emailContato)
        TextField("CEP", text: $form.enderecoCep)
        TextField("Rua", text: $form.enderecoRua)
        TextField("Número", text: $form.enderecoNumero)
        TextField("Complemento", text: $form.enderecoComplemento)
        TextField("Bairro", text: $form.enderecoBairro)
        TextField("Cidade", text: $form.enderecoCidade)
        TextField("Estado (UF)", text: $form.enderecoEstado)
      }
      .textFieldStyle(.roundedBorder)

      Toggle("Empresa ativa", isOn: $form.ativo)

      HStack {
        Spacer()
        Button("Cancelar", action: onCancel)
          .buttonStyle(.bordered)
        Button(loading ? "Salvando..." : "Salvar", action: onSubmit)
          .buttonStyle(.borderedProminent)
          .disabled(loading || form.nome.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
      }
    }
  }
}

private extension String {
  var nilIfBlank: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}
