import Foundation

struct SessionUser: Equatable {
  let authID: UUID
  let email: String
}

struct WalletSummary: Equatable {
  let nome: String
  let patrimonioTotal: Double
  let aporteTotal: Double
  let resultadoTotal: Double
  let resultadoPercentual: Double
}

struct WalletSnapshotPoint: Identifiable, Equatable {
  let id = UUID()
  let date: Date
  let carteira: Double
  let aporte: Double
  let resultado: Double
}

struct OperationRow: Identifiable, Equatable {
  let id: UUID
  let moedaId: String
  let nome: String
  let simbolo: String
  let tipo: String
  let quantidade: Double
  let precoUnitario: Double
  let valorTotal: Double
  let taxa: Double
  let exchange: String?
  let notas: String?
  let dataOperacao: Date
}

struct DashboardSummary: Equatable {
  let patrimonio: Double
  let aporte: Double
  let resultado: Double
  let resultadoPct: Double
  let totalOperacoes: Int
}

struct MarketTicker: Identifiable, Equatable, Codable {
  let id: String
  let symbol: String
  let name: String
  let price: Double
  let change24hPct: Double
  let marketCap: Double
  let high24h: Double
  let low24h: Double
  let imageURL: String?
  let updatedAt: Date
}

struct AdminUserRow: Identifiable, Equatable {
  let id: UUID
  let authId: UUID?
  let email: String
  let nome: String?
  let empresaId: UUID?
  let empresaNome: String?
  let grupoId: UUID?
  let grupoNome: String?
  let role: String?
  let ativo: Bool?
  let createdAt: Date?
  let ultimoLoginAt: Date?
}

struct EmpresaRow: Identifiable, Equatable {
  let id: UUID
  let nome: String
  let cnpj: String?
  let telefone: String?
  let emailContato: String?
  let enderecoRua: String?
  let enderecoNumero: String?
  let enderecoComplemento: String?
  let enderecoBairro: String?
  let enderecoCidade: String?
  let enderecoEstado: String?
  let enderecoCep: String?
  let ativo: Bool?
  let criadoEm: Date?
  let atualizadoEm: Date?
}

struct GrupoRow: Identifiable, Equatable {
  let id: UUID
  let nome: String
  let descricao: String?
  let isMaster: Bool
  let empresaId: UUID?
  let empresaNome: String?
  let telasPermitidas: [String]
}

struct AdminAccessContext: Equatable {
  let isMaster: Bool
  let empresaId: UUID?
}

struct CryptoCarteiraDTO: Decodable {
  let id: UUID
  let nome: String
  let valor_inicial: Double
}

struct CryptoAporteDTO: Decodable {
  let id: UUID?
  let carteira_id: UUID?
  let valor: Double
  let data_aporte: String?
  let descricao: String?
}

struct CryptoSnapshotDTO: Decodable {
  let data_ref: String
  let aporte_liquido: Double
  let patrimonio_total: Double
}

struct WalletConfigRow: Identifiable, Equatable {
  let id: UUID
  let nome: String
  let valorInicial: Double
}

struct WalletAporteRow: Identifiable, Equatable {
  let id: UUID
  let carteiraId: UUID
  let valor: Double
  let dataAporte: Date
  let descricao: String?
}

struct CryptoOperacaoDTO: Decodable {
  let id: UUID
  let moeda_id: String
  let nome: String
  let simbolo: String
  let tipo: String
  let quantidade: Double
  let preco_unitario: Double
  let valor_total: Double
  let taxa: Double
  let exchange: String?
  let notas: String?
  let data_operacao: String
}

struct AdminUserDTO: Decodable {
  let id: UUID
  let auth_id: UUID?
  let email: String?
  let nome: String?
  let is_master: Bool?
  let ativo: Bool?
  let criado_em: String?
  let empresa_id: UUID?
  let empresas: EmpresaNomeDTO?
}

struct EmpresaNomeDTO: Decodable {
  let nome: String?
}

struct UsuarioGrupoDTO: Decodable {
  let usuario_id: UUID
  let grupo_id: UUID
}

struct GrupoNomeDTO: Decodable {
  let id: UUID
  let nome: String
}

struct AdminCreateUserInput: Equatable {
  let nome: String
  let email: String
  let password: String
  let empresaId: UUID
  let grupoId: UUID?
}

struct AdminUpdateUserInput: Equatable {
  let userId: UUID
  let nome: String
  let email: String
  let empresaId: UUID
  let grupoId: UUID?
  let ativo: Bool
  let isMaster: Bool
}

struct CurrentUsuarioDTO: Decodable {
  let id: UUID
  let auth_id: UUID
  let email: String
  let nome: String
  let is_master: Bool
  let empresa_id: UUID?
}

struct CoinGeckoTickerDTO: Decodable {
  let id: String
  let symbol: String
  let name: String
  let current_price: Double
  let price_change_percentage_24h: Double?
  let market_cap: Double?
  let high_24h: Double?
  let low_24h: Double?
  let image: String?
  let last_updated: String?
}

struct CoinSearchRow: Identifiable, Equatable {
  let id: String
  let symbol: String
  let name: String
  let imageURL: String?
  let currentPrice: Double?
}

struct EmpresaDTO: Decodable {
  let id: UUID
  let nome: String
  let cnpj: String?
  let telefone: String?
  let email_contato: String?
  let endereco_rua: String?
  let endereco_numero: String?
  let endereco_complemento: String?
  let endereco_bairro: String?
  let endereco_cidade: String?
  let endereco_estado: String?
  let endereco_cep: String?
  let ativo: Bool?
  let criado_em: String?
  let atualizado_em: String?
}

struct GrupoDTO: Decodable {
  let id: UUID
  let nome: String
  let descricao: String?
  let is_master: Bool?
  let empresa_id: UUID?
  let telas_permitidas: [String]?
  let empresas: EmpresaNomeDTO?
}

struct EmpresaUpsertInput: Equatable {
  let nome: String
  let cnpj: String?
  let telefone: String?
  let emailContato: String?
  let enderecoRua: String?
  let enderecoNumero: String?
  let enderecoComplemento: String?
  let enderecoBairro: String?
  let enderecoCidade: String?
  let enderecoEstado: String?
  let enderecoCep: String?
  let ativo: Bool
}

struct OperationUpsertInput: Equatable {
  let moedaId: String
  let nome: String
  let simbolo: String
  let tipo: String
  let quantidade: Double
  let precoUnitario: Double
  let valorTotal: Double
  let taxa: Double
  let exchange: String?
  let notas: String?
  let dataOperacao: Date

  func toInsertPayload(usuarioId: UUID) -> OperationInsertPayload {
    OperationInsertPayload(
      usuario_id: usuarioId.uuidString,
      moeda_id: moedaId,
      nome: nome,
      simbolo: simbolo,
      tipo: tipo.lowercased(),
      quantidade: quantidade,
      preco_unitario: precoUnitario,
      valor_total: valorTotal,
      taxa: taxa,
      exchange: exchange,
      notas: notas,
      data_operacao: ISO8601DateFormatter().string(from: dataOperacao)
    )
  }

  func toUpdatePayload(usuarioId: UUID) -> OperationUpdatePayload {
    OperationUpdatePayload(
      usuario_id: usuarioId.uuidString,
      moeda_id: moedaId,
      nome: nome,
      simbolo: simbolo,
      tipo: tipo.lowercased(),
      quantidade: quantidade,
      preco_unitario: precoUnitario,
      valor_total: valorTotal,
      taxa: taxa,
      exchange: exchange,
      notas: notas,
      data_operacao: ISO8601DateFormatter().string(from: dataOperacao)
    )
  }
}

struct OperationInsertPayload: Encodable {
  let usuario_id: String
  let moeda_id: String
  let nome: String
  let simbolo: String
  let tipo: String
  let quantidade: Double
  let preco_unitario: Double
  let valor_total: Double
  let taxa: Double
  let exchange: String?
  let notas: String?
  let data_operacao: String
}

struct OperationUpdatePayload: Encodable {
  let usuario_id: String
  let moeda_id: String
  let nome: String
  let simbolo: String
  let tipo: String
  let quantidade: Double
  let preco_unitario: Double
  let valor_total: Double
  let taxa: Double
  let exchange: String?
  let notas: String?
  let data_operacao: String
}
