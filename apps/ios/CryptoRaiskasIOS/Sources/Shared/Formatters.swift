import Foundation

enum AppFormatters {
  static let currency: NumberFormatter = {
    let f = NumberFormatter()
    f.numberStyle = .currency
    f.currencyCode = "USD"
    f.maximumFractionDigits = 2
    return f
  }()

  static let compactNumber: NumberFormatter = {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.maximumFractionDigits = 2
    return f
  }()

  static let dateDayMonth: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "dd/MM/yyyy"
    return f
  }()

  static let dateMonthYear: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "MM/yy"
    return f
  }()

  static func currency(_ value: Double) -> String {
    currency.string(from: NSNumber(value: value)) ?? "$0.00"
  }

  static func signedCurrency(_ value: Double) -> String {
    let absValue = currency(abs(value))
    return value >= 0 ? "+\(absValue)" : "-\(absValue)"
  }

  static func number(_ value: Double, max: Int = 6) -> String {
    compactNumber.maximumFractionDigits = max
    return compactNumber.string(from: NSNumber(value: value)) ?? "0"
  }

  static func percent(_ value: Double) -> String {
    String(format: "%.2f%%", value)
  }
}
