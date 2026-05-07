import SwiftUI

// MARK: - License Gate
// Shown as a full-screen sheet when the trial has expired and no license is activated.

struct LicenseGate<Content: View>: View {
    @StateObject private var license = LicenseManager.shared
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .sheet(isPresented: Binding(
                get: { license.state == .expired },
                set: { _ in }
            )) {
                LicenseView()
                    .interactiveDismissDisabled(true)
            }
    }
}

// MARK: - License View

struct LicenseView: View {
    @StateObject private var license = LicenseManager.shared
    @State private var key = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            if license.state == .activated {
                activatedBody
            } else {
                expiredBody
            }
        }
        .frame(width: 440)
        .onAppear { focused = true }
    }

    // MARK: Activated

    private var activatedBody: some View {
        VStack(spacing: 24) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 48))
                .foregroundStyle(.green)

            VStack(spacing: 8) {
                Text("License Active")
                    .font(.title2.weight(.bold))
                Text("FlipTheScript is fully activated. Thank you for your support.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            if let savedKey = license.licenseKey {
                Text(savedKey)
                    .font(.system(.callout, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color(.windowBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(.separatorColor), lineWidth: 0.5))
            }
        }
        .padding(40)
        .frame(maxWidth: .infinity)
    }

    // MARK: Expired / entry form

    private var expiredBody: some View {
        Group {
            VStack(alignment: .leading, spacing: 12) {
                Text("FlipTheScript")
                    .font(.system(.title3, design: .monospaced, weight: .bold))
                    .tracking(2)

                Text("Your free trial has ended.")
                    .font(.title2.weight(.bold))

                Text("Enter your license key below to keep going, or grab one at flip-the-script.app.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(32)
            .background(Color(.windowBackgroundColor))

            Divider()

            VStack(alignment: .leading, spacing: 16) {
                Text("License key")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                TextField("FLIP-XXXX-XXXX-XXXX", text: $key)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                    .autocorrectionDisabled()
                    .focused($focused)
                    .onSubmit { Task { await license.activate(key: key) } }

                if let error = license.activationError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                HStack {
                    Button("Buy a License →") {
                        NSWorkspace.shared.open(URL(string: "https://www.flip-the-script.app/#pricing")!)
                    }
                    .buttonStyle(.plain)
                    .font(.callout)
                    .foregroundStyle(.blue)

                    Spacer()

                    Button("Activate") {
                        Task { await license.activate(key: key) }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(key.trimmingCharacters(in: .whitespaces).isEmpty || license.isValidating)
                    .overlay {
                        if license.isValidating {
                            ProgressView()
                                .scaleEffect(0.7)
                                .tint(.white)
                        }
                    }
                }
            }
            .padding(32)
        }
    }
}

// MARK: - Trial Banner
// Shown at the bottom of the app during the trial period.

struct TrialBanner: View {
    @StateObject private var license = LicenseManager.shared
    @State private var showingActivation = false

    var body: some View {
        if license.state == .trial {
            HStack(spacing: 10) {
                Image(systemName: "clock")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
                Text("\(license.trialDaysRemaining) day\(license.trialDaysRemaining == 1 ? "" : "s") left in your free trial.")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Activate License") {
                    showingActivation = true
                }
                .font(.caption.weight(.semibold))
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color.orange.opacity(0.08))
            .overlay(alignment: .top) { Divider() }
            .sheet(isPresented: $showingActivation) {
                LicenseView()
            }
        }
    }
}
