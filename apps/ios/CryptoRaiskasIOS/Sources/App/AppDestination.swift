import Foundation

enum AppDestination: String, CaseIterable, Identifiable {
  case home
  case crypto
  case carteira
  case admin

  var id: String { rawValue }

  var title: String {
    switch self {
    case .home: return AppContract.homeLabel
    case .crypto: return AppContract.cryptoLabel
    case .carteira: return AppContract.carteiraLabel
    case .admin: return AppContract.adminMenuTitle
    }
  }

  var icon: String {
    switch self {
    case .home: return "house"
    case .crypto: return "bitcoinsign.circle"
    case .carteira: return "chart.line.uptrend.xyaxis"
    case .admin: return "person.3"
    }
  }
}
