import SwiftUI
import UIKit

struct SignInView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @EnvironmentObject var appState: AppState

  @State private var email = ""
  @State private var password = ""
  @State private var submitting = false

  private var canSubmit: Bool {
    !submitting
  }

  var body: some View {
    GeometryReader { proxy in
      ZStack(alignment: .topLeading) {
        AppTheme.pageBackground.ignoresSafeArea()

        ScrollView(showsIndicators: false) {
          VStack(spacing: 16) {
            logoView
              .padding(.top, max(12, proxy.safeAreaInsets.top))

            AppCard {
              VStack(spacing: 14) {
                Text("Entrar")
                  .font(horizontalSizeClass == .compact ? .title.bold() : .largeTitle.bold())
                  .foregroundStyle(AppTheme.strongText)

                Text("Entre com seu email e senha para acessar o sistema")
                  .font(.callout)
                  .foregroundStyle(AppTheme.subtleText)
                  .multilineTextAlignment(.center)

                VStack(alignment: .leading, spacing: 10) {
                  Text("Email")
                    .font(.caption)
                    .foregroundStyle(AppTheme.subtleText)
                  TextField("seu@email.com", text: $email)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .keyboardType(.emailAddress)
                    .submitLabel(.next)
                    .padding(10)
                    .background(Color.white.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                  Text("Senha")
                    .font(.caption)
                    .foregroundStyle(AppTheme.subtleText)
                  SecureField("••••••••", text: $password)
                    .submitLabel(.go)
                    .padding(10)
                    .background(Color.white.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                if let error = appState.authError {
                  Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                  submit()
                } label: {
                  HStack {
                    Spacer(minLength: 0)
                    Text(submitting ? "Entrando..." : "Entrar")
                    Spacer(minLength: 0)
                  }
                  .frame(maxWidth: .infinity, minHeight: 44)
                  .background(canSubmit ? AppTheme.primaryAccent : Color.gray.opacity(0.4))
                  .foregroundStyle(.white)
                  .clipShape(RoundedRectangle(cornerRadius: 8))
                  .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!canSubmit)

                Text("Não tem uma conta? Cadastre-se")
                  .font(.caption)
                  .foregroundStyle(AppTheme.subtleText)
              }
            }
            .frame(maxWidth: 520)
          }
          .padding(.horizontal, 16)
          .padding(.bottom, max(16, proxy.safeAreaInsets.bottom + 8))
          .frame(minWidth: proxy.size.width, minHeight: proxy.size.height, alignment: .top)
        }
      }
      .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .onSubmit { submit() }
  }

  private func submit() {
    guard canSubmit else { return }
    let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedEmail.isEmpty, !password.isEmpty else {
      appState.authError = "Preencha email e senha para entrar."
      return
    }
    Task {
      submitting = true
      defer { submitting = false }
      appState.authError = nil
      await appState.signIn(email: normalizedEmail, password: password)
    }
  }

  @ViewBuilder
  private var logoView: some View {
    if let uiImage = UIImage(named: "logo-sem-fundo") {
      Image(uiImage: uiImage)
        .resizable()
        .scaledToFit()
        .frame(width: horizontalSizeClass == .compact ? 90 : 120)
        .accessibilityHidden(true)
    } else {
      EmptyView()
    }
  }
}
