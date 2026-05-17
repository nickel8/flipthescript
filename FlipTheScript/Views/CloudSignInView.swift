import SwiftUI

/// Sign-in / sign-up sheet for the FlipTheScript Cloud account.
struct CloudSignInView: View {

    @ObservedObject private var auth = CloudAuthManager.shared
    var onSignedIn: () -> Void = {}

    @State private var email    = ""
    @State private var password = ""
    @State private var isSignUp = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {

            // Header
            VStack(spacing: 8) {
                Image(systemName: "cloud.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(.blue)
                Text(isSignUp ? "Create cloud account" : "Sign in to cloud")
                    .font(.title2.weight(.bold))
                Text("Publish your breakdown so the team can view it on any device.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 32)
            .padding(.horizontal, 32)
            .padding(.bottom, 24)

            Divider()

            // Form
            VStack(spacing: 16) {
                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled()

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(isSignUp ? .newPassword : .password)

                if let err = auth.authError {
                    Text(err)
                        .font(.callout)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task {
                        if isSignUp {
                            await auth.signUp(email: email, password: password)
                        } else {
                            await auth.signIn(email: email, password: password)
                        }
                        if auth.isSignedIn {
                            onSignedIn()
                            dismiss()
                        }
                    }
                } label: {
                    Group {
                        if auth.isLoading {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Text(isSignUp ? "Create account" : "Sign in")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(email.isEmpty || password.isEmpty || auth.isLoading)

                Button(isSignUp ? "Already have an account? Sign in" : "No account? Create one") {
                    isSignUp.toggle()
                    auth.authError = nil
                }
                .buttonStyle(.plain)
                .font(.callout)
                .foregroundStyle(.secondary)
            }
            .padding(32)
        }
        .frame(width: 380)
        .fixedSize()
    }
}
