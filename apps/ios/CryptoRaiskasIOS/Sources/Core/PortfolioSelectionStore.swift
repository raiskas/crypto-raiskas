import Foundation

enum PortfolioSelectionStore {
  private static let key = "crypto.selectedPortfolioId"

  static var selectedPortfolioId: UUID? {
    get {
      guard let raw = UserDefaults.standard.string(forKey: key) else { return nil }
      return UUID(uuidString: raw)
    }
    set {
      if let newValue {
        UserDefaults.standard.set(newValue.uuidString, forKey: key)
      } else {
        UserDefaults.standard.removeObject(forKey: key)
      }
    }
  }
}
