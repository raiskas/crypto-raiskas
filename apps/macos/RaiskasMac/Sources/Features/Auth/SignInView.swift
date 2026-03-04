import SwiftUI

struct SignInView: View {
  @EnvironmentObject var appState: AppState

  @State private var email = ""
  @State private var password = ""
  @State private var submitting = false

  private var canSubmit: Bool {
    !submitting
      && !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !password.isEmpty
  }

  var body: some View {
    HStack(spacing: 0) {
      VStack {
        if let logo = NSImage(named: "logo-sem-fundo") {
          Image(nsImage: logo)
            .resizable()
            .scaledToFit()
            .frame(width: 340)
        } else {
          Text(AppContract.appName)
            .font(.system(size: 34, weight: .bold))
            .foregroundStyle(AppTheme.strongText)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color.white.opacity(0.03))

      VStack {
        AppCard {
          VStack(spacing: 14) {
            Text("Entrar")
              .font(.system(size: 28, weight: .bold))
              .foregroundStyle(AppTheme.strongText)

            Text("Entre com seu email e senha para acessar o sistema")
              .foregroundStyle(AppTheme.subtleText)
              .multilineTextAlignment(.center)
              .font(.subheadline)

            VStack(alignment: .leading, spacing: 12) {
              Text("Email")
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
              TextField("seu@email.com", text: $email)
                .textFieldStyle(.roundedBorder)

              Text("Senha")
                .font(.caption)
                .foregroundStyle(AppTheme.subtleText)
              SecureField("••••••••", text: $password)
                .textFieldStyle(.roundedBorder)
            }
            .frame(width: 360)

            if let error = appState.authError {
              Text(error)
                .foregroundStyle(.red)
                .font(.caption)
                .frame(width: 360, alignment: .leading)
            }

            Button(submitting ? "Entrando..." : "Entrar") {
              submit()
            }
            .buttonStyle(.borderedProminent)
            .frame(width: 360)
            .disabled(!canSubmit)
            .keyboardShortcut(.defaultAction)

            Text("Não tem uma conta? Cadastre-se")
              .font(.caption)
              .foregroundStyle(AppTheme.subtleText)
          }
          .padding(.vertical, 8)
        }
        .frame(width: 500)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .background(AppTheme.pageBackground)
    .frame(minWidth: 1120, minHeight: 720)
    .onSubmit {
      submit()
    }
  }

  private func submit() {
    guard canSubmit else { return }
    Task {
      submitting = true
      defer { submitting = false }
      await appState.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
    }
  }
}
