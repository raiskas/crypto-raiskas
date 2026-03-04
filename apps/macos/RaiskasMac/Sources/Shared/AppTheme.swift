import AppKit
import SwiftUI

enum AppTheme {
  static let pageBackground = Color(red: 0.02, green: 0.04, blue: 0.10)
  static let sidebarBackground = Color(red: 0.03, green: 0.06, blue: 0.12)
  static let headerBackground = Color(red: 0.05, green: 0.08, blue: 0.14)
  static let cardBackground = Color(red: 0.08, green: 0.11, blue: 0.16)
  static let cardBackgroundSoft = Color(red: 0.10, green: 0.14, blue: 0.20)
  static let border = Color.white.opacity(0.10)
  static let subtleText = Color.white.opacity(0.68)
  static let strongText = Color.white.opacity(0.95)
  static let primaryAccent = Color(red: 0.17, green: 0.51, blue: 1.00)
}

struct SectionTitle: View {
  let title: String
  let subtitle: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(.system(size: 30, weight: .bold))
        .foregroundStyle(AppTheme.strongText)
      Text(subtitle)
        .foregroundStyle(AppTheme.subtleText)
        .font(.system(size: 14, weight: .regular))
    }
  }
}

struct StatCard: View {
  let title: String
  let value: String
  let color: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title)
        .font(.caption)
        .foregroundStyle(AppTheme.subtleText)
      Text(value)
        .font(.system(size: 34, weight: .bold))
        .foregroundStyle(color)
        .lineLimit(2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(14)
    .frame(minHeight: 118, alignment: .leading)
    .background(AppTheme.cardBackgroundSoft)
    .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppTheme.border, lineWidth: 1.0))
    .clipShape(RoundedRectangle(cornerRadius: 12))
  }
}

struct AppCard<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    content
      .padding(16)
      .background(AppTheme.cardBackground)
      .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppTheme.border, lineWidth: 1.0))
      .clipShape(RoundedRectangle(cornerRadius: 12))
  }
}

struct AppModalContainer<Content: View>: View {
  let title: String
  let subtitle: String?
  let width: CGFloat
  let minHeight: CGFloat?
  @ViewBuilder let content: Content

  init(
    title: String,
    subtitle: String? = nil,
    width: CGFloat = 760,
    minHeight: CGFloat? = nil,
    @ViewBuilder content: () -> Content
  ) {
    self.title = title
    self.subtitle = subtitle
    self.width = width
    self.minHeight = minHeight
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      VStack(alignment: .leading, spacing: 4) {
        Text(title)
          .font(.title2.bold())
          .foregroundStyle(AppTheme.strongText)
        if let subtitle, !subtitle.isEmpty {
          Text(subtitle)
            .font(.subheadline)
            .foregroundStyle(AppTheme.subtleText)
        }
      }

      content
    }
    .padding(20)
    .frame(width: width, alignment: .topLeading)
    .frame(minHeight: minHeight, alignment: .topLeading)
    .background(AppTheme.pageBackground)
    .overlay(
      RoundedRectangle(cornerRadius: 24)
        .stroke(AppTheme.border, lineWidth: 1)
    )
    .clipShape(RoundedRectangle(cornerRadius: 24))
    .shadow(color: .black.opacity(0.45), radius: 26, x: 0, y: 14)
    .padding(14)
  }
}

@MainActor
final class AppWindowPresenter {
  static let shared = AppWindowPresenter()

  private var controllers: [String: NSWindowController] = [:]
  private var delegates: [String: WindowDelegate] = [:]

  private final class WindowDelegate: NSObject, NSWindowDelegate {
    let onClose: (() -> Void)?
    let didClose: () -> Void

    init(onClose: (() -> Void)?, didClose: @escaping () -> Void) {
      self.onClose = onClose
      self.didClose = didClose
    }

    func windowWillClose(_ notification: Notification) {
      onClose?()
      didClose()
    }
  }

  func present<Content: View>(
    id: String,
    title: String,
    size: CGSize,
    resizable: Bool = true,
    onClose: (() -> Void)? = nil,
    @ViewBuilder content: () -> Content
  ) {
    dismiss(id: id)

    let hosting = NSHostingController(rootView: content())
    let window = NSWindow(contentViewController: hosting)
    var mask: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .fullSizeContentView]
    if resizable {
      mask.insert(.resizable)
    }
    window.styleMask = mask
    window.title = title
    window.setContentSize(NSSize(width: size.width, height: size.height))
    window.center()
    window.isReleasedWhenClosed = false
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.backgroundColor = .black

    let delegate = WindowDelegate(onClose: onClose) { [weak self] in
      self?.controllers[id] = nil
      self?.delegates[id] = nil
    }
    window.delegate = delegate

    let controller = NSWindowController(window: window)
    controllers[id] = controller
    delegates[id] = delegate

    controller.showWindow(nil)
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func dismiss(id: String) {
    if let controller = controllers[id], let window = controller.window {
      window.close()
    }
    controllers[id] = nil
    delegates[id] = nil
  }
}

struct AppConfirmDialogWindow: View {
  let title: String
  let message: String
  let confirmLabel: String
  let confirmRole: ButtonRole?
  let onCancel: () -> Void
  let onConfirm: () -> Void

  var body: some View {
    AppModalContainer(title: title, subtitle: nil, width: 460) {
      Text(message)
        .font(.subheadline)
        .foregroundStyle(AppTheme.strongText.opacity(0.9))
        .frame(maxWidth: .infinity, alignment: .leading)

      HStack {
        Spacer()
        Button("Cancelar", action: onCancel)
          .buttonStyle(.bordered)
        Button(confirmLabel, role: confirmRole, action: onConfirm)
          .buttonStyle(.borderedProminent)
      }
    }
  }
}
