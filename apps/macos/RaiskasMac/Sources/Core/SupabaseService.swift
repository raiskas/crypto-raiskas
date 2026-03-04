import Foundation
import Supabase

private struct AuthUserDefaultsStorage: AuthLocalStorage, @unchecked Sendable {
  private let defaults: UserDefaults
  private let namespace: String

  init(defaults: UserDefaults = .standard, namespace: String = "com.raiskas.auth") {
    self.defaults = defaults
    self.namespace = namespace
  }

  private func scopedKey(_ key: String) -> String {
    "\(namespace).\(key)"
  }

  func store(key: String, value: Data) throws {
    defaults.set(value, forKey: scopedKey(key))
  }

  func retrieve(key: String) throws -> Data? {
    defaults.data(forKey: scopedKey(key))
  }

  func remove(key: String) throws {
    defaults.removeObject(forKey: scopedKey(key))
  }
}

@MainActor
final class SupabaseService {
  static let shared = SupabaseService()

  let client: SupabaseClient
  private var marketTickerCache: [String: MarketTicker] = [:]
  private var marketTickerCacheUpdatedAt: Date?
  private let marketTickerFreshTTL: TimeInterval = 120

  private struct MarketTickerCachePayload: Codable {
    let updatedAt: Date
    let tickers: [MarketTicker]
  }

  private init() {
    client = SupabaseClient(
      supabaseURL: AppConfig.supabaseURL,
      supabaseKey: AppConfig.supabaseAnonKey,
      options: .init(
        auth: .init(
          storage: AuthUserDefaultsStorage(),
          emitLocalSessionAsInitialSession: true
        )
      )
    )
  }

  private func marketTickerCacheURL() -> URL? {
    FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
      .appendingPathComponent("raiskas_market_tickers_cache.json")
  }

  private func loadMarketTickerCacheFromDiskIfNeeded() {
    guard marketTickerCacheUpdatedAt == nil, let url = marketTickerCacheURL() else { return }
    guard let data = try? Data(contentsOf: url) else { return }
    guard let payload = try? JSONDecoder().decode(MarketTickerCachePayload.self, from: data) else { return }
    marketTickerCache = Dictionary(uniqueKeysWithValues: payload.tickers.map { ($0.id.lowercased(), $0) })
    marketTickerCacheUpdatedAt = payload.updatedAt
  }

  private func persistMarketTickerCache() {
    guard let url = marketTickerCacheURL() else { return }
    let payload = MarketTickerCachePayload(
      updatedAt: marketTickerCacheUpdatedAt ?? Date(),
      tickers: Array(marketTickerCache.values)
    )
    guard let data = try? JSONEncoder().encode(payload) else { return }
    try? data.write(to: url, options: .atomic)
  }

  private func cachedTickers(for ids: [String], allowStale: Bool) -> [MarketTicker] {
    loadMarketTickerCacheFromDiskIfNeeded()
    if !allowStale, let updated = marketTickerCacheUpdatedAt {
      if Date().timeIntervalSince(updated) > marketTickerFreshTTL {
        return []
      }
    }
    let normalized = ids.map { $0.lowercased() }
    return normalized.compactMap { marketTickerCache[$0] }
  }

  private func mergeMarketTickerCache(_ tickers: [MarketTicker]) {
    guard !tickers.isEmpty else { return }
    for ticker in tickers {
      marketTickerCache[ticker.id.lowercased()] = ticker
    }
    marketTickerCacheUpdatedAt = Date()
    persistMarketTickerCache()
  }

  private func fallbackCoinMeta(for id: String) -> (symbol: String, name: String) {
    let map: [String: (String, String)] = [
      "bitcoin": ("BTC", "Bitcoin"),
      "ethereum": ("ETH", "Ethereum"),
      "ripple": ("XRP", "XRP"),
      "solana": ("SOL", "Solana"),
      "dogecoin": ("DOGE", "Dogecoin"),
      "cardano": ("ADA", "Cardano"),
      "binancecoin": ("BNB", "BNB"),
      "tether": ("USDT", "Tether"),
      "usd-coin": ("USDC", "USD Coin"),
      "staked-ether": ("STETH", "Lido Staked Ether"),
    ]
    if let known = map[id.lowercased()] {
      return (known.0, known.1)
    }
    let clean = id.replacingOccurrences(of: "-", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    let symbol = clean.replacingOccurrences(of: " ", with: "").prefix(6).uppercased()
    return (symbol.isEmpty ? id.uppercased() : symbol, clean.capitalized)
  }

  private func fetchSimplePrices(ids: [String]) async -> [String: Double] {
    guard !ids.isEmpty else { return [:] }
    let idsJoined = ids.joined(separator: ",")
    guard let url = URL(string: "https://api.coingecko.com/api/v3/simple/price?ids=\(idsJoined)&vs_currencies=usd") else {
      return [:]
    }

    var request = URLRequest(url: url)
    request.timeoutInterval = 15
    request.setValue("application/json", forHTTPHeaderField: "Accept")

    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
        return [:]
      }
      guard let json = try JSONSerialization.jsonObject(with: data) as? [String: [String: Any]] else {
        return [:]
      }
      var out: [String: Double] = [:]
      for (coinId, fields) in json {
        if let usd = fields["usd"] as? Double {
          out[coinId.lowercased()] = usd
        } else if let usdInt = fields["usd"] as? Int {
          out[coinId.lowercased()] = Double(usdInt)
        }
      }
      return out
    } catch {
      return [:]
    }
  }

  func signIn(email: String, password: String) async throws {
    _ = try await client.auth.signIn(email: email, password: password)
  }

  func signOut() async throws {
    try await client.auth.signOut()
  }

  func sendPasswordReset(email: String) async throws {
    try await client.auth.resetPasswordForEmail(email)
  }

  func sendAdminPasswordReset(email: String) async throws {
    try await ensureMasterAccess()
    try await client.auth.resetPasswordForEmail(email)
  }

  func currentUser() async throws -> SessionUser? {
    let session = try await client.auth.session
    guard let user = session.user.email else { return nil }
    return SessionUser(authID: session.user.id, email: user)
  }

  private func currentAuthUserId() async throws -> UUID {
    let session = try await client.auth.session
    return session.user.id
  }

  private func currentInternalUser() async throws -> CurrentUsuarioDTO {
    let authId = try await currentAuthUserId()
    let rows: [CurrentUsuarioDTO] = try await client
      .from("usuarios")
      .select("id,auth_id,email,nome,is_master,empresa_id")
      .eq("auth_id", value: authId.uuidString)
      .limit(1)
      .execute()
      .value

    guard let user = rows.first else {
      throw NSError(
        domain: "RaiskasMac",
        code: 404,
        userInfo: [NSLocalizedDescriptionKey: "Perfil interno não encontrado em usuarios."]
      )
    }
    return user
  }

  func fetchAdminAccessContext() async throws -> AdminAccessContext {
    let current = try await currentInternalUser()
    return AdminAccessContext(isMaster: current.is_master, empresaId: current.empresa_id)
  }

  private func ensureMasterAccess() async throws {
    let current = try await currentInternalUser()
    guard current.is_master else {
      throw NSError(
        domain: "RaiskasMac",
        code: 403,
        userInfo: [NSLocalizedDescriptionKey: "Apenas usuário master pode executar esta ação."]
      )
    }
  }

  private func estimateSummaryWithoutWallet() async throws -> (WalletSummary, [WalletSnapshotPoint]) {
    let operations = try await fetchOperations(limit: 5000)
    guard !operations.isEmpty else {
      return (
        WalletSummary(nome: "Carteira Principal", patrimonioTotal: 0, aporteTotal: 0, resultadoTotal: 0, resultadoPercentual: 0),
        []
      )
    }

    var qtyBySymbol: [String: Double] = [:]
    var cash: Double = 0

    for op in operations.sorted(by: { $0.dataOperacao < $1.dataOperacao }) {
      let symbol = op.simbolo.uppercased()
      let qtd = max(0, op.quantidade)
      if op.tipo.lowercased() == "compra" {
        qtyBySymbol[symbol, default: 0] += qtd
        cash -= op.valorTotal
      } else {
        qtyBySymbol[symbol, default: 0] -= qtd
        cash += op.valorTotal
      }
    }

    let tickers = (try? await fetchMarketTickers()) ?? []
    let priceBySymbol = Dictionary(uniqueKeysWithValues: tickers.map { ($0.symbol.uppercased(), $0.price) })
    let ativos = qtyBySymbol.reduce(0.0) { acc, row in
      let qty = max(0, row.value)
      let px = priceBySymbol[row.key] ?? 0
      return acc + (qty * px)
    }

    let patrimonio = cash + ativos
    let result = patrimonio // sem valor inicial/aportes no modo legado
    let now = Date()
    return (
      WalletSummary(
        nome: "Carteira Principal",
        patrimonioTotal: patrimonio,
        aporteTotal: 0,
        resultadoTotal: result,
        resultadoPercentual: 0
      ),
      [
        WalletSnapshotPoint(
          date: now,
          carteira: patrimonio,
          aporte: 0,
          resultado: result
        ),
      ]
    )
  }

  func fetchWalletSummaryAndHistory(months: Int = 12) async throws -> (WalletSummary, [WalletSnapshotPoint]) {
    let internalUser = try await currentInternalUser()

    let carteiras: [CryptoCarteiraDTO] = try await client
      .from("crypto_carteiras")
      .select("id,nome,valor_inicial")
      .eq("usuario_id", value: internalUser.id.uuidString)
      .eq("ativo", value: true)
      .limit(1)
      .execute()
      .value

    guard let carteira = carteiras.first else {
      return try await estimateSummaryWithoutWallet()
    }

    let aportes: [CryptoAporteDTO] = try await client
      .from("crypto_carteira_aportes")
      .select("valor")
      .eq("carteira_id", value: carteira.id.uuidString)
      .execute()
      .value

    let totalAportes = aportes.reduce(0) { $0 + $1.valor }
    let aporteTotal = carteira.valor_inicial + totalAportes

    let fromDate = Calendar.current.date(byAdding: .month, value: -max(1, months), to: Date()) ?? Date()
    let fromKey = ISO8601DateFormatter().string(from: fromDate).prefix(10)

    let snapshots: [CryptoSnapshotDTO] = try await client
      .from("crypto_carteira_snapshots")
      .select("data_ref,aporte_liquido,patrimonio_total")
      .eq("carteira_id", value: carteira.id.uuidString)
      .gte("data_ref", value: String(fromKey))
      .order("data_ref", ascending: true)
      .execute()
      .value

    let dateFormatter = DateFormatter()
    dateFormatter.dateFormat = "yyyy-MM-dd"
    dateFormatter.locale = Locale(identifier: "en_US_POSIX")
    dateFormatter.timeZone = TimeZone(secondsFromGMT: 0)

    let points = snapshots.compactMap { item -> WalletSnapshotPoint? in
      guard let date = dateFormatter.date(from: item.data_ref) else { return nil }
      return WalletSnapshotPoint(
        date: date,
        carteira: item.patrimonio_total,
        aporte: item.aporte_liquido,
        resultado: item.patrimonio_total - item.aporte_liquido
      )
    }

    let patrimonio = points.last?.carteira ?? aporteTotal
    let resultado = patrimonio - aporteTotal
    let resultadoPct = aporteTotal > 0 ? (resultado / aporteTotal) * 100 : 0

    return (
      WalletSummary(
        nome: carteira.nome,
        patrimonioTotal: patrimonio,
        aporteTotal: aporteTotal,
        resultadoTotal: resultado,
        resultadoPercentual: resultadoPct
      ),
      points
    )
  }

  func fetchWalletConfigAndAportes() async throws -> (WalletConfigRow?, [WalletAporteRow]) {
    let internalUser = try await currentInternalUser()
    let carteiras: [CryptoCarteiraDTO] = try await client
      .from("crypto_carteiras")
      .select("id,nome,valor_inicial")
      .eq("usuario_id", value: internalUser.id.uuidString)
      .eq("ativo", value: true)
      .order("criado_em", ascending: false)
      .limit(1)
      .execute()
      .value

    guard let carteira = carteiras.first else {
      return (nil, [])
    }

    let aportes: [CryptoAporteDTO] = try await client
      .from("crypto_carteira_aportes")
      .select("id,carteira_id,valor,data_aporte,descricao")
      .eq("carteira_id", value: carteira.id.uuidString)
      .order("data_aporte", ascending: false)
      .execute()
      .value

    let iso = ISO8601DateFormatter()
    let mapped = aportes.compactMap { row -> WalletAporteRow? in
      guard let id = row.id, let carteiraId = row.carteira_id else { return nil }
      let date = row.data_aporte.flatMap { iso.date(from: $0) } ?? Date()
      return WalletAporteRow(
        id: id,
        carteiraId: carteiraId,
        valor: row.valor,
        dataAporte: date,
        descricao: row.descricao
      )
    }

    return (
      WalletConfigRow(id: carteira.id, nome: carteira.nome, valorInicial: carteira.valor_inicial),
      mapped
    )
  }

  func upsertWallet(nome: String, valorInicial: Double) async throws {
    let internalUser = try await currentInternalUser()

    let existing: [CryptoCarteiraDTO] = try await client
      .from("crypto_carteiras")
      .select("id,nome,valor_inicial")
      .eq("usuario_id", value: internalUser.id.uuidString)
      .eq("ativo", value: true)
      .limit(1)
      .execute()
      .value

    struct WalletPayload: Encodable {
      let usuario_id: String
      let nome: String
      let valor_inicial: Double
      let ativo: Bool
    }
    let payload = WalletPayload(
      usuario_id: internalUser.id.uuidString,
      nome: nome,
      valor_inicial: valorInicial,
      ativo: true
    )

    if let carteira = existing.first {
      _ = try await client
        .from("crypto_carteiras")
        .update(payload)
        .eq("id", value: carteira.id.uuidString)
        .eq("usuario_id", value: internalUser.id.uuidString)
        .execute()
    } else {
      _ = try await client
        .from("crypto_carteiras")
        .insert(payload)
        .execute()
    }
  }

  func saveAporte(
    id: UUID? = nil,
    carteiraId: UUID,
    valor: Double,
    dataAporte: Date,
    descricao: String?
  ) async throws {
    struct AportePayload: Encodable {
      let carteira_id: String
      let valor: Double
      let data_aporte: String
      let descricao: String?
    }
    let iso = ISO8601DateFormatter()
    let payload = AportePayload(
      carteira_id: carteiraId.uuidString,
      valor: valor,
      data_aporte: iso.string(from: dataAporte),
      descricao: descricao
    )

    if let id {
      _ = try await client
        .from("crypto_carteira_aportes")
        .update(payload)
        .eq("id", value: id.uuidString)
        .execute()
    } else {
      _ = try await client
        .from("crypto_carteira_aportes")
        .insert(payload)
        .execute()
    }
  }

  func deleteAporte(id: UUID) async throws {
    _ = try await client
      .from("crypto_carteira_aportes")
      .delete()
      .eq("id", value: id.uuidString)
      .execute()
  }

  func fetchOperations(limit: Int = 200) async throws -> [OperationRow] {
    let internalUser = try await currentInternalUser()

    let rows: [CryptoOperacaoDTO] = try await client
      .from("crypto_operacoes")
      .select("id,moeda_id,nome,simbolo,tipo,quantidade,preco_unitario,valor_total,taxa,exchange,notas,data_operacao")
      .eq("usuario_id", value: internalUser.id.uuidString)
      .order("data_operacao", ascending: false)
      .limit(limit)
      .execute()
      .value

    let iso = ISO8601DateFormatter()
    let fallback = DateFormatter()
    fallback.dateFormat = "yyyy-MM-dd"
    fallback.locale = Locale(identifier: "en_US_POSIX")
    fallback.timeZone = TimeZone(secondsFromGMT: 0)

    return rows.map { row in
      let parsedDate = iso.date(from: row.data_operacao) ?? fallback.date(from: row.data_operacao) ?? Date()
      return OperationRow(
        id: row.id,
        moedaId: row.moeda_id,
        nome: row.nome,
        simbolo: row.simbolo,
        tipo: row.tipo,
        quantidade: row.quantidade,
        precoUnitario: row.preco_unitario,
        valorTotal: row.valor_total,
        taxa: row.taxa,
        exchange: row.exchange,
        notas: row.notas,
        dataOperacao: parsedDate
      )
    }
  }

  func createOperation(input: OperationUpsertInput) async throws {
    let internalUser = try await currentInternalUser()
    let payload = input.toInsertPayload(usuarioId: internalUser.id)
    _ = try await client
      .from("crypto_operacoes")
      .insert(payload)
      .execute()
  }

  func updateOperation(id: UUID, input: OperationUpsertInput) async throws {
    let internalUser = try await currentInternalUser()
    let payload = input.toUpdatePayload(usuarioId: internalUser.id)
    _ = try await client
      .from("crypto_operacoes")
      .update(payload)
      .eq("id", value: id.uuidString)
      .eq("usuario_id", value: internalUser.id.uuidString)
      .execute()
  }

  func deleteOperation(id: UUID) async throws {
    let internalUser = try await currentInternalUser()
    _ = try await client
      .from("crypto_operacoes")
      .delete()
      .eq("id", value: id.uuidString)
      .eq("usuario_id", value: internalUser.id.uuidString)
      .execute()
  }

  func fetchDashboardSummary() async throws -> DashboardSummary {
    let wallet = try await fetchWalletSummaryAndHistory(months: 12)
    let ops = try await fetchOperations(limit: 500)
    return DashboardSummary(
      patrimonio: wallet.0.patrimonioTotal,
      aporte: wallet.0.aporteTotal,
      resultado: wallet.0.resultadoTotal,
      resultadoPct: wallet.0.resultadoPercentual,
      totalOperacoes: ops.count
    )
  }

  func fetchAdminUsers(limit: Int = 200) async throws -> [AdminUserRow] {
    let current = try await currentInternalUser()
    let rows: [AdminUserDTO]

    if !current.is_master, let empresaId = current.empresa_id {
      rows = try await client
        .from("usuarios")
        .select("id,auth_id,email,nome,is_master,ativo,criado_em,empresa_id,empresas(nome)")
        .eq("empresa_id", value: empresaId.uuidString)
        .order("criado_em", ascending: false)
        .limit(limit)
        .execute()
        .value
    } else {
      rows = try await client
        .from("usuarios")
        .select("id,auth_id,email,nome,is_master,ativo,criado_em,empresa_id,empresas(nome)")
        .order("criado_em", ascending: false)
        .limit(limit)
        .execute()
        .value
    }

    let links: [UsuarioGrupoDTO]
    if !rows.isEmpty {
      let ids = rows.map { $0.id.uuidString }.joined(separator: ",")
      links = (try? await client
        .from("usuarios_grupos")
        .select("usuario_id,grupo_id")
        .filter("usuario_id", operator: "in", value: "(\(ids))")
        .execute()
        .value) ?? []
    } else {
      links = []
    }
    let firstGroupByUser = Dictionary(uniqueKeysWithValues: links.map { ($0.usuario_id, $0.grupo_id) })

    let groupIds = Array(Set(links.map { $0.grupo_id }))
    let grupos: [GrupoNomeDTO]
    if !groupIds.isEmpty {
      let ids = groupIds.map { $0.uuidString }.joined(separator: ",")
      grupos = (try? await client
        .from("grupos")
        .select("id,nome")
        .filter("id", operator: "in", value: "(\(ids))")
        .execute()
        .value) ?? []
    } else {
      grupos = []
    }
    let groupNameById = Dictionary(uniqueKeysWithValues: grupos.map { ($0.id, $0.nome) })

    let iso = ISO8601DateFormatter()
    return rows.map { row in
      let gid = firstGroupByUser[row.id]
      return AdminUserRow(
        id: row.id,
        authId: row.auth_id,
        email: row.email ?? "-",
        nome: row.nome,
        empresaId: row.empresa_id,
        empresaNome: row.empresas?.nome,
        grupoId: gid,
        grupoNome: gid.flatMap { groupNameById[$0] },
        role: (row.is_master ?? false) ? "MASTER" : "USER",
        ativo: row.ativo,
        createdAt: row.criado_em.flatMap { iso.date(from: $0) },
        ultimoLoginAt: nil
      )
    }
  }

  func fetchEmpresas(limit: Int = 200) async throws -> [EmpresaRow] {
    let current = try await currentInternalUser()
    let rows: [EmpresaDTO]

    if current.is_master {
      rows = try await client
        .from("empresas")
        .select("id,nome,cnpj,telefone,email_contato,endereco_rua,endereco_numero,endereco_complemento,endereco_bairro,endereco_cidade,endereco_estado,endereco_cep,ativo,criado_em,atualizado_em")
        .order("nome", ascending: true)
        .limit(limit)
        .execute()
        .value
    } else if let empresaId = current.empresa_id {
      rows = try await client
        .from("empresas")
        .select("id,nome,cnpj,telefone,email_contato,endereco_rua,endereco_numero,endereco_complemento,endereco_bairro,endereco_cidade,endereco_estado,endereco_cep,ativo,criado_em,atualizado_em")
        .eq("id", value: empresaId.uuidString)
        .order("nome", ascending: true)
        .limit(1)
        .execute()
        .value
    } else {
      rows = []
    }

    let iso = ISO8601DateFormatter()
    return rows.map { item in
      EmpresaRow(
        id: item.id,
        nome: item.nome,
        cnpj: item.cnpj,
        telefone: item.telefone,
        emailContato: item.email_contato,
        enderecoRua: item.endereco_rua,
        enderecoNumero: item.endereco_numero,
        enderecoComplemento: item.endereco_complemento,
        enderecoBairro: item.endereco_bairro,
        enderecoCidade: item.endereco_cidade,
        enderecoEstado: item.endereco_estado,
        enderecoCep: item.endereco_cep,
        ativo: item.ativo,
        criadoEm: item.criado_em.flatMap { iso.date(from: $0) },
        atualizadoEm: item.atualizado_em.flatMap { iso.date(from: $0) }
      )
    }
  }

  func createEmpresa(input: EmpresaUpsertInput) async throws {
    try await ensureMasterAccess()
    struct Payload: Encodable {
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
      let ativo: Bool
    }
    let payload = Payload(
      nome: input.nome.trimmingCharacters(in: .whitespacesAndNewlines),
      cnpj: input.cnpj?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      telefone: input.telefone?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      email_contato: input.emailContato?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_rua: input.enderecoRua?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_numero: input.enderecoNumero?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_complemento: input.enderecoComplemento?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_bairro: input.enderecoBairro?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_cidade: input.enderecoCidade?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_estado: input.enderecoEstado?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_cep: input.enderecoCep?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      ativo: input.ativo
    )
    _ = try await client.from("empresas").insert(payload).execute()
  }

  func updateEmpresa(id: UUID, input: EmpresaUpsertInput) async throws {
    try await ensureMasterAccess()
    struct Payload: Encodable {
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
      let ativo: Bool
    }
    let payload = Payload(
      nome: input.nome.trimmingCharacters(in: .whitespacesAndNewlines),
      cnpj: input.cnpj?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      telefone: input.telefone?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      email_contato: input.emailContato?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_rua: input.enderecoRua?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_numero: input.enderecoNumero?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_complemento: input.enderecoComplemento?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_bairro: input.enderecoBairro?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_cidade: input.enderecoCidade?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_estado: input.enderecoEstado?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      endereco_cep: input.enderecoCep?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      ativo: input.ativo
    )
    _ = try await client
      .from("empresas")
      .update(payload)
      .eq("id", value: id.uuidString)
      .execute()
  }

  func deleteEmpresa(id: UUID) async throws {
    try await ensureMasterAccess()
    _ = try await client
      .from("empresas")
      .delete()
      .eq("id", value: id.uuidString)
      .execute()
  }

  func fetchGrupos(limit: Int = 300) async throws -> [GrupoRow] {
    let current = try await currentInternalUser()
    let rows: [GrupoDTO]

    if current.is_master {
      rows = try await client
        .from("grupos")
        .select("id,nome,descricao,is_master,empresa_id,telas_permitidas,empresas(nome)")
        .order("nome", ascending: true)
        .limit(limit)
        .execute()
        .value
    } else if let empresaId = current.empresa_id {
      rows = try await client
        .from("grupos")
        .select("id,nome,descricao,is_master,empresa_id,telas_permitidas,empresas(nome)")
        .eq("empresa_id", value: empresaId.uuidString)
        .order("nome", ascending: true)
        .limit(limit)
        .execute()
        .value
    } else {
      rows = []
    }

    return rows.map { item in
      GrupoRow(
        id: item.id,
        nome: item.nome,
        descricao: item.descricao,
        isMaster: item.is_master ?? false,
        empresaId: item.empresa_id,
        empresaNome: item.empresas?.nome,
        telasPermitidas: item.telas_permitidas ?? []
      )
    }
  }

  func createAdminUser(input: AdminCreateUserInput) async throws {
    try await ensureMasterAccess()
    let response = try await client.auth.signUp(
      email: input.email.trimmingCharacters(in: .whitespacesAndNewlines),
      password: input.password
    )
    let authUser = response.user

    struct UsuarioPayload: Encodable {
      let auth_id: String
      let nome: String
      let email: String
      let empresa_id: String
      let is_master: Bool
      let ativo: Bool
    }
    let payload = UsuarioPayload(
      auth_id: authUser.id.uuidString,
      nome: input.nome.trimmingCharacters(in: .whitespacesAndNewlines),
      email: input.email.trimmingCharacters(in: .whitespacesAndNewlines),
      empresa_id: input.empresaId.uuidString,
      is_master: false,
      ativo: true
    )

    let inserted: [AdminUserDTO] = try await client
      .from("usuarios")
      .insert(payload)
      .select("id,email,nome,is_master,ativo,criado_em,empresa_id")
      .limit(1)
      .execute()
      .value

    if let gid = input.grupoId, let created = inserted.first {
      struct LinkPayload: Encodable {
        let usuario_id: String
        let grupo_id: String
      }
      _ = try await client
        .from("usuarios_grupos")
        .insert(LinkPayload(usuario_id: created.id.uuidString, grupo_id: gid.uuidString))
        .execute()
    }
  }

  func updateAdminUser(input: AdminUpdateUserInput) async throws {
    try await ensureMasterAccess()
    struct UsuarioPayload: Encodable {
      let nome: String
      let email: String
      let empresa_id: String
      let is_master: Bool
      let ativo: Bool
    }
    let payload = UsuarioPayload(
      nome: input.nome.trimmingCharacters(in: .whitespacesAndNewlines),
      email: input.email.trimmingCharacters(in: .whitespacesAndNewlines),
      empresa_id: input.empresaId.uuidString,
      is_master: input.isMaster,
      ativo: input.ativo
    )
    _ = try await client
      .from("usuarios")
      .update(payload)
      .eq("id", value: input.userId.uuidString)
      .execute()

    _ = try await client
      .from("usuarios_grupos")
      .delete()
      .eq("usuario_id", value: input.userId.uuidString)
      .execute()

    if let gid = input.grupoId {
      struct LinkPayload: Encodable {
        let usuario_id: String
        let grupo_id: String
      }
      _ = try await client
        .from("usuarios_grupos")
        .insert(LinkPayload(usuario_id: input.userId.uuidString, grupo_id: gid.uuidString))
        .execute()
    }
  }

  func deleteAdminUser(userId: UUID) async throws {
    try await ensureMasterAccess()
    _ = try await client
      .from("usuarios")
      .delete()
      .eq("id", value: userId.uuidString)
      .execute()
  }

  func createGrupo(
    nome: String,
    descricao: String?,
    isMaster: Bool,
    empresaId: UUID?,
    telasPermitidas: [String]
  ) async throws {
    try await ensureMasterAccess()
    struct Payload: Encodable {
      let nome: String
      let descricao: String?
      let is_master: Bool
      let empresa_id: String?
      let telas_permitidas: [String]
    }
    let payload = Payload(
      nome: nome.trimmingCharacters(in: .whitespacesAndNewlines),
      descricao: descricao?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      is_master: isMaster,
      empresa_id: isMaster ? nil : empresaId?.uuidString,
      telas_permitidas: isMaster ? [] : telasPermitidas
    )
    _ = try await client.from("grupos").insert(payload).execute()
  }

  func updateGrupo(
    id: UUID,
    nome: String,
    descricao: String?,
    isMaster: Bool,
    empresaId: UUID?,
    telasPermitidas: [String]
  ) async throws {
    try await ensureMasterAccess()
    struct Payload: Encodable {
      let nome: String
      let descricao: String?
      let is_master: Bool
      let empresa_id: String?
      let telas_permitidas: [String]
    }
    let payload = Payload(
      nome: nome.trimmingCharacters(in: .whitespacesAndNewlines),
      descricao: descricao?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      is_master: isMaster,
      empresa_id: isMaster ? nil : empresaId?.uuidString,
      telas_permitidas: isMaster ? [] : telasPermitidas
    )
    _ = try await client
      .from("grupos")
      .update(payload)
      .eq("id", value: id.uuidString)
      .execute()
  }

  func deleteGrupo(id: UUID) async throws {
    try await ensureMasterAccess()
    _ = try await client
      .from("grupos")
      .delete()
      .eq("id", value: id.uuidString)
      .execute()
  }

  func fetchMarketTickers(ids: [String] = [
    "bitcoin",
    "ethereum",
    "tether",
    "binancecoin",
    "solana",
    "usd-coin",
    "ripple",
    "staked-ether",
    "dogecoin",
    "cardano",
  ]) async throws -> [MarketTicker] {
    let normalized = Array(Set(ids.map { $0.lowercased() })).sorted()
    if normalized.isEmpty { return [] }

    let freshCached = cachedTickers(for: normalized, allowStale: false)
    if freshCached.count == normalized.count {
      return freshCached
    }

    var lastError: Error?
    let idsJoined = normalized.joined(separator: ",")
    let perPage = max(20, min(250, normalized.count))
    let urlString = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=\(idsJoined)&order=market_cap_desc&per_page=\(perPage)&page=1&sparkline=false"

    if let url = URL(string: urlString) {
      for attempt in 1 ... 3 {
        do {
          var request = URLRequest(url: url)
          request.timeoutInterval = 20
          request.setValue("application/json", forHTTPHeaderField: "Accept")
          let (data, response) = try await URLSession.shared.data(for: request)
          guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
          }

          let decoded = try JSONDecoder().decode([CoinGeckoTickerDTO].self, from: data)
          let iso = ISO8601DateFormatter()
          let mapped = decoded.map { item in
            MarketTicker(
              id: item.id.lowercased(),
              symbol: item.symbol.uppercased(),
              name: item.name,
              price: item.current_price,
              change24hPct: item.price_change_percentage_24h ?? 0,
              marketCap: item.market_cap ?? 0,
              high24h: item.high_24h ?? item.current_price,
              low24h: item.low_24h ?? item.current_price,
              imageURL: item.image,
              updatedAt: item.last_updated.flatMap { iso.date(from: $0) } ?? Date()
            )
          }

          if !mapped.isEmpty {
            mergeMarketTickerCache(mapped)
            let merged = cachedTickers(for: normalized, allowStale: true)
            if !merged.isEmpty {
              return merged
            }
          }
        } catch {
          lastError = error
          if attempt < 3 {
            let waitNs = UInt64(Double(attempt) * 0.6 * 1_000_000_000)
            try? await Task.sleep(nanoseconds: waitNs)
          }
        }
      }
    } else {
      lastError = URLError(.badURL)
    }

    let simplePrices = await fetchSimplePrices(ids: normalized)
    if !simplePrices.isEmpty {
      let now = Date()
      let fallbackTickers = normalized.compactMap { id -> MarketTicker? in
        guard let price = simplePrices[id] else { return nil }
        let cached = marketTickerCache[id]
        let meta = fallbackCoinMeta(for: id)
        return MarketTicker(
          id: id,
          symbol: cached?.symbol ?? meta.symbol,
          name: cached?.name ?? meta.name,
          price: price,
          change24hPct: cached?.change24hPct ?? 0,
          marketCap: cached?.marketCap ?? 0,
          high24h: cached?.high24h ?? price,
          low24h: cached?.low24h ?? price,
          imageURL: cached?.imageURL,
          updatedAt: now
        )
      }
      if !fallbackTickers.isEmpty {
        mergeMarketTickerCache(fallbackTickers)
        return cachedTickers(for: normalized, allowStale: true)
      }
    }

    let stale = cachedTickers(for: normalized, allowStale: true)
    if !stale.isEmpty {
      return stale
    }

    throw lastError ?? URLError(.cannotLoadFromNetwork)
  }

  func searchCoins(query: String, limit: Int = 10) async throws -> [CoinSearchRow] {
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return [] }

    struct SearchCoinDTO: Decodable {
      let id: String
      let symbol: String
      let name: String
      let thumb: String?
      let large: String?
    }
    struct SearchResponseDTO: Decodable {
      let coins: [SearchCoinDTO]
    }

    let escaped = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
    guard let searchURL = URL(string: "https://api.coingecko.com/api/v3/search?query=\(escaped)") else {
      throw URLError(.badURL)
    }

    var searchRequest = URLRequest(url: searchURL)
    searchRequest.timeoutInterval = 20
    searchRequest.setValue("application/json", forHTTPHeaderField: "Accept")

    let (searchData, searchResponse) = try await URLSession.shared.data(for: searchRequest)
    guard let searchHTTP = searchResponse as? HTTPURLResponse, (200 ... 299).contains(searchHTTP.statusCode) else {
      throw URLError(.badServerResponse)
    }

    let searchDecoded = try JSONDecoder().decode(SearchResponseDTO.self, from: searchData)
    let topCoins = Array(searchDecoded.coins.prefix(max(1, limit)))
    if topCoins.isEmpty { return [] }

    let ids = topCoins.map(\.id).joined(separator: ",")
    var priceById: [String: Double] = [:]
    if let priceURL = URL(string: "https://api.coingecko.com/api/v3/simple/price?ids=\(ids)&vs_currencies=usd") {
      var priceRequest = URLRequest(url: priceURL)
      priceRequest.timeoutInterval = 20
      priceRequest.setValue("application/json", forHTTPHeaderField: "Accept")
      if let (priceData, priceResponse) = try? await URLSession.shared.data(for: priceRequest),
         let priceHTTP = priceResponse as? HTTPURLResponse,
         (200 ... 299).contains(priceHTTP.statusCode),
         let json = try? JSONSerialization.jsonObject(with: priceData) as? [String: [String: Any]] {
        for (coinId, fields) in json {
          if let usd = fields["usd"] as? Double {
            priceById[coinId] = usd
          } else if let usdInt = fields["usd"] as? Int {
            priceById[coinId] = Double(usdInt)
          }
        }
      }
    }

    return topCoins.map { coin in
      CoinSearchRow(
        id: coin.id,
        symbol: coin.symbol.uppercased(),
        name: coin.name,
        imageURL: coin.thumb ?? coin.large,
        currentPrice: priceById[coin.id]
      )
    }
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}
