import Foundation

enum AppConfig {
  private static var bundleConfig: [String: Any]? {
    guard let url = Bundle.main.url(forResource: "Config.local", withExtension: "plist"),
          let data = try? Data(contentsOf: url),
          let plist = try? PropertyListSerialization.propertyList(from: data, format: nil),
          let dict = plist as? [String: Any] else {
      return nil
    }
    return dict
  }

  private static func readValue(_ key: String) -> String? {
    if let value = bundleConfig?[key] as? String, !value.isEmpty {
      return value
    }
    if let value = ProcessInfo.processInfo.environment[key], !value.isEmpty {
      return value
    }
    return nil
  }

  private static func isPlaceholderURL(_ value: String) -> Bool {
    let normalized = value.lowercased()
    return normalized.contains("seu-projeto.supabase.co")
      || normalized.contains("seu-projeto")
      || normalized.contains("example")
  }

  private static func isPlaceholderAnonKey(_ value: String) -> Bool {
    let normalized = value.lowercased()
    return normalized.contains("sua_chave_anon_aqui")
      || normalized.contains("anon_key")
      || normalized == "your_anon_key"
  }

  static var supabaseURL: URL {
    guard let value = readValue("SUPABASE_URL"), !isPlaceholderURL(value), let url = URL(string: value) else {
      fatalError("Configuração ausente: SUPABASE_URL. Configure em Config.local.plist ou Environment Variables.")
    }
    return url
  }

  static var supabaseAnonKey: String {
    guard let value = readValue("SUPABASE_ANON_KEY"), !value.isEmpty, !isPlaceholderAnonKey(value) else {
      fatalError("Configuração ausente: SUPABASE_ANON_KEY. Configure em Config.local.plist ou Environment Variables.")
    }
    return value
  }
}
