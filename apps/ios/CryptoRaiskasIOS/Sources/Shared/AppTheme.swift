import SwiftUI

enum AppTheme {
  static let pageBackground = Color(red: 8/255, green: 24/255, blue: 58/255)
  static let cardBackground = Color(red: 25/255, green: 35/255, blue: 54/255)
  static let border = Color.white.opacity(0.12)
  static let strongText = Color.white
  static let subtleText = Color.white.opacity(0.72)
  static let primaryAccent = Color(red: 29/255, green: 120/255, blue: 255/255)
}

enum AppLayout {
  static let pageSpacing: CGFloat = 12
  static let sectionSpacing: CGFloat = 10
  static let cardSpacing: CGFloat = 8
  static let tabBarSafeInsetCompact: CGFloat = 72
  static let tabBarSafeInsetRegular: CGFloat = 60
  static let pageHorizontalCompact: CGFloat = 8
  static let pageHorizontalRegular: CGFloat = 12
}

struct AppCard<Content: View>: View {
  let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    content
      .padding(12)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(AppTheme.cardBackground)
      .overlay(
        RoundedRectangle(cornerRadius: 12)
          .stroke(AppTheme.border, lineWidth: 1)
      )
      .clipShape(RoundedRectangle(cornerRadius: 12))
  }
}

struct PageHeaderView<Trailing: View>: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  let title: String
  let subtitle: String
  @ViewBuilder let trailing: () -> Trailing

  init(title: String, subtitle: String, @ViewBuilder trailing: @escaping () -> Trailing) {
    self.title = title
    self.subtitle = subtitle
    self.trailing = trailing
  }

  var body: some View {
    Group {
      if horizontalSizeClass == .compact {
        VStack(alignment: .leading, spacing: 10) {
          VStack(alignment: .leading, spacing: 4) {
            Text(title)
              .font(.title3.bold())
              .foregroundStyle(AppTheme.strongText)
              .lineLimit(2)
              .minimumScaleFactor(0.85)
            if !subtitle.isEmpty {
              Text(subtitle)
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
                .fixedSize(horizontal: false, vertical: true)
            }
          }
          trailing()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      } else {
        HStack(alignment: .top, spacing: 12) {
          VStack(alignment: .leading, spacing: 4) {
            Text(title)
              .font(.largeTitle.bold())
              .foregroundStyle(AppTheme.strongText)
            if !subtitle.isEmpty {
              Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(AppTheme.subtleText)
            }
          }
          Spacer()
          trailing()
        }
      }
    }
  }
}

struct SectionTitle: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  let title: String
  let subtitle: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(horizontalSizeClass == .compact ? .title3.bold() : .largeTitle.bold())
        .foregroundStyle(AppTheme.strongText)
        .lineLimit(horizontalSizeClass == .compact ? 2 : 1)
        .minimumScaleFactor(0.85)
      if !subtitle.isEmpty {
        Text(subtitle)
          .font(horizontalSizeClass == .compact ? .caption : .subheadline)
          .foregroundStyle(AppTheme.subtleText)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
  }
}

struct TabBarSafeAreaInset: ViewModifier {
  func body(content: Content) -> some View {
    content
  }
}

extension View {
  func tabBarSafeAreaInset() -> some View {
    modifier(TabBarSafeAreaInset())
  }
}
