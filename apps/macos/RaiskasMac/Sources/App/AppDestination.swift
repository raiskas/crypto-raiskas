import Foundation
import SwiftUI

// BEGIN GENERATED CONTRACT (sync-cross-platform)
enum AppContract {
  static let appName = "Crypto Raiskas"
  static let adminMenuTitle = "Painel Administrativo"

  static let homeLabel = "Home"
  static let cryptoLabel = "Crypto"
  static let carteiraLabel = "Carteira"
  static let adminOverviewLabel = "Visão Geral"
  static let adminUsuariosLabel = "Usuários"
  static let adminEmpresasLabel = "Empresas"

  static let modalCryptoNewOperationLabel = "Crypto • Nova Operação"
  static let modalPortfolioAdminLabel = "Carteira • Administrar Carteira"
  static let modalAdminNewUserLabel = "Admin • Novo Usuário"
  static let modalAdminNewGroupLabel = "Admin • Novo Grupo"
  static let modalAdminNewEmpresaLabel = "Admin • Nova Empresa"
}
// END GENERATED CONTRACT (sync-cross-platform)

enum AppDestination: String, CaseIterable, Identifiable {
  case home
  case crypto
  case carteira
  case adminOverview
  case adminUsuarios
  case adminEmpresas

  var id: String { rawValue }

  var title: String {
    switch self {
    case .home: return AppContract.homeLabel
    case .crypto: return AppContract.cryptoLabel
    case .carteira: return AppContract.carteiraLabel
    case .adminOverview: return AppContract.adminOverviewLabel
    case .adminUsuarios: return AppContract.adminUsuariosLabel
    case .adminEmpresas: return AppContract.adminEmpresasLabel
    }
  }

  var icon: String {
    switch self {
    case .home: return "house"
    case .crypto: return "bitcoinsign.circle"
    case .carteira: return "chart.xyaxis.line"
    case .adminOverview: return "square.grid.2x2"
    case .adminUsuarios: return "person.3"
    case .adminEmpresas: return "building.2"
    }
  }
}
