import SwiftUI

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
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @StateObject private var vm = AdminEmpresasViewModel()
  @State private var selectedEmpresa: EmpresaRow?
  @State private var form = EmpresaFormState()
  @State private var modalMode: ModalMode?
  @State private var showDeleteConfirm = false

  private enum ModalMode: Identifiable {
    case create
    case edit

    var id: String {
      switch self {
      case .create: return "create"
      case .edit: return "edit"
      }
    }
  }

  var body: some View {
    ZStack(alignment: .topLeading) {
      AppTheme.pageBackground.ignoresSafeArea()
      ScrollView {
        VStack(alignment: .leading, spacing: AppLayout.pageSpacing) {
          PageHeaderView(title: "Empresas", subtitle: "") {
            createButtonProminent
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
              HStack(alignment: .top) {
                Text("Gerenciamento de Empresas")
                  .font(.headline)
                  .foregroundStyle(AppTheme.strongText)
                Spacer()
                if horizontalSizeClass == .compact {
                  VStack(alignment: .trailing, spacing: 8) {
                    createButtonCompact
                    refreshButton
                  }
                } else {
                  createButtonCompact
                  refreshButton
                }
              }

              if vm.empresas.isEmpty {
                Text("Nenhuma empresa encontrada.")
                  .foregroundStyle(AppTheme.subtleText)
                  .padding(.vertical, 8)
              } else {
                ForEach(vm.empresas) { row in
                  if horizontalSizeClass == .compact {
                    empresaRowCompact(row)
                  } else {
                    empresaRowRegular(row)
                  }
                  Divider().overlay(AppTheme.border)
                }
              }
            }
          }
      }
        .padding(.bottom, 12)
        .padding(.horizontal, horizontalSizeClass == .compact ? AppLayout.pageHorizontalCompact : AppLayout.pageHorizontalRegular)
        .padding(.top, AppLayout.pageSpacing)
      }
      .background(AppTheme.pageBackground)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .navigationTitle(AppContract.adminEmpresasLabel)
    .navigationBarTitleDisplayMode(.inline)
    .tabBarSafeAreaInset()
    .task {
      if vm.empresas.isEmpty { await vm.refresh() }
    }
    .sheet(item: $modalMode) { mode in
      EmpresaFormModal(
        title: mode == .create ? "Criar Empresa" : "Editar Empresa",
        form: $form,
        loading: vm.actionLoading,
        onCancel: { modalMode = nil },
        onSubmit: {
          switch mode {
          case .create:
            Task {
              await vm.create(input: form.toInput())
              if vm.error == nil { modalMode = nil }
            }
          case .edit:
            guard let row = selectedEmpresa else { return }
            Task {
              await vm.update(id: row.id, input: form.toInput())
              if vm.error == nil { modalMode = nil }
            }
          }
        }
      )
      .presentationDetents([.large])
    }
    .alert("Remover Empresa", isPresented: $showDeleteConfirm, presenting: selectedEmpresa) { row in
      Button("Cancelar", role: .cancel) {}
      Button("Excluir", role: .destructive) {
        Task { await vm.delete(id: row.id) }
      }
    } message: { _ in
      Text("Tem certeza que deseja remover esta empresa?")
    }
  }

  private var createButtonProminent: some View {
    Button {
      form = EmpresaFormState()
      modalMode = .create
    } label: {
      Label("Criar Empresa", systemImage: "plus.circle")
    }
    .buttonStyle(.borderedProminent)
    .disabled(!vm.accessContext.isMaster)
  }

  private var createButtonCompact: some View {
    Button {
      form = EmpresaFormState()
      modalMode = .create
    } label: {
      Label(horizontalSizeClass == .compact ? "Criar" : "Criar Empresa", systemImage: "plus.circle")
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

  private func empresaRowRegular(_ row: EmpresaRow) -> some View {
    HStack(alignment: .center, spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        Text(row.nome)
          .foregroundStyle(AppTheme.strongText)
          .font(.headline)
        Text(row.emailContato ?? "-")
          .foregroundStyle(AppTheme.subtleText)
          .font(.caption)
      }

      Spacer()

      Text((row.ativo ?? true) ? "Ativa" : "Inativa")
        .foregroundStyle((row.ativo ?? true) ? .green : .red)
        .font(.caption.bold())

      Text(row.criadoEm.map { AppFormatters.dateDayMonth.string(from: $0) } ?? "-")
        .foregroundStyle(AppTheme.strongText.opacity(0.8))
        .font(.caption)

      if vm.accessContext.isMaster {
        empresaActions(row)
      }
    }
  }

  private func empresaRowCompact(_ row: EmpresaRow) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(row.nome)
        .foregroundStyle(AppTheme.strongText)
        .font(.headline)

      if let email = row.emailContato, !email.isEmpty {
        Text(email)
          .foregroundStyle(AppTheme.subtleText)
          .font(.caption)
      }

      HStack {
        Text("Status:")
          .font(.caption2)
          .foregroundStyle(AppTheme.subtleText)
        Text((row.ativo ?? true) ? "Ativa" : "Inativa")
          .foregroundStyle((row.ativo ?? true) ? .green : .red)
          .font(.caption.bold())
      }

      HStack {
        Text("Criada em:")
          .font(.caption2)
          .foregroundStyle(AppTheme.subtleText)
        Text(row.criadoEm.map { AppFormatters.dateDayMonth.string(from: $0) } ?? "-")
          .foregroundStyle(AppTheme.strongText.opacity(0.85))
          .font(.caption)
      }

      if vm.accessContext.isMaster {
        empresaActions(row)
      }
    }
  }

  private func empresaActions(_ row: EmpresaRow) -> some View {
    HStack(spacing: 6) {
      Button {
        selectedEmpresa = row
        form = .from(row)
        modalMode = .edit
      } label: {
        Label("Editar", systemImage: "pencil")
      }
      .buttonStyle(.borderedProminent)
      .tint(AppTheme.primaryAccent)
      .controlSize(.small)

      Button(role: .destructive) {
        selectedEmpresa = row
        showDeleteConfirm = true
      } label: {
        Label("Excluir", systemImage: "trash")
      }
      .buttonStyle(.borderedProminent)
      .tint(.red)
      .controlSize(.small)
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
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 10) {
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
}

private extension String {
  var nilIfBlank: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}
