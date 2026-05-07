import SwiftUI

struct FeedbackView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var effortScore: Int? = nil
    @State private var suggestions: String = ""
    @State private var happyToChat: Bool = false
    @State private var submitted = false

    private let effortLabels = ["Very hard", "Hard", "Neutral", "Easy", "Very easy"]

    var body: some View {
        VStack(spacing: 0) {
            if submitted {
                thanksView
            } else {
                formView
            }
        }
        #if os(macOS)
        .frame(width: 480)
        #endif
    }

    // MARK: - Form

    private var formView: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Header
            VStack(alignment: .leading, spacing: 6) {
                Text("Share feedback")
                    .font(.title2.weight(.bold))
                Text("Takes 30 seconds. Helps us build something better.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(24)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {

                    // Q1 — effort score
                    VStack(alignment: .leading, spacing: 12) {
                        Text("How easy was it to complete your task?")
                            .font(.headline)

                        HStack(spacing: 8) {
                            ForEach(1...5, id: \.self) { score in
                                Button {
                                    effortScore = score
                                } label: {
                                    VStack(spacing: 4) {
                                        Text(effortEmoji(score))
                                            .font(.title2)
                                        Text("\(score)")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .background(
                                        effortScore == score
                                            ? Color.accentColor.opacity(0.12)
                                            : Color(.windowBackgroundColor)
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(
                                                effortScore == score
                                                    ? Color.accentColor
                                                    : Color(.separatorColor),
                                                lineWidth: effortScore == score ? 1.5 : 0.5
                                            )
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if let score = effortScore {
                            Text(effortLabels[score - 1])
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .transition(.opacity)
                        }
                    }

                    // Q2 — open text
                    VStack(alignment: .leading, spacing: 10) {
                        Text("How could we make things better — for you or others?")
                            .font(.headline)

                        ZStack(alignment: .topLeading) {
                            TextEditor(text: $suggestions)
                                .font(.body)
                                .frame(minHeight: 100, maxHeight: 180)
                                .scrollContentBackground(.hidden)
                                .padding(10)
                                .background(Color(.textBackgroundColor).opacity(0.5))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color(.separatorColor), lineWidth: 0.5)
                                )

                            if suggestions.isEmpty {
                                Text("Anything — workflow, missing features, things that confused you…")
                                    .font(.body)
                                    .foregroundStyle(.tertiary)
                                    .padding(16)
                                    .allowsHitTesting(false)
                            }
                        }
                    }

                    // Q3 — chat toggle
                    VStack(alignment: .leading, spacing: 6) {
                        Toggle(isOn: $happyToChat) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("I'm happy to talk through my ideas")
                                    .font(.headline)
                                Text("We'll reach out by email — no spam, no obligation.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .toggleStyle(.switch)
                    }
                }
                .padding(24)
            }

            Divider()

            // Actions
            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Send Feedback") {
                    sendFeedback()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(effortScore == nil && suggestions.isEmpty)
                .buttonStyle(.borderedProminent)
            }
            .padding(20)
        }
    }

    // MARK: - Thanks

    private var thanksView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.green)
            Text("Thanks for the feedback")
                .font(.title3.weight(.semibold))
            Text("It genuinely helps.")
                .foregroundStyle(.secondary)
            Button("Done") { dismiss() }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
        }
        .padding(48)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Submit

    private func sendFeedback() {
        var body = ""
        if let score = effortScore {
            body += "Effort score: \(score)/5 (\(effortLabels[score - 1]))\n\n"
        }
        if !suggestions.isEmpty {
            body += "Suggestions:\n\(suggestions)\n\n"
        }
        body += "Happy to chat: \(happyToChat ? "Yes" : "No")"

        let subject = "FlipTheScript Feedback"
        let encodedSubject = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? subject
        let encodedBody = body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? body
        let mailtoString = "mailto:hello@flipthescript.app?subject=\(encodedSubject)&body=\(encodedBody)"

        if let url = URL(string: mailtoString) {
            #if os(macOS)
            NSWorkspace.shared.open(url)
            #else
            UIApplication.shared.open(url)
            #endif
        }

        withAnimation { submitted = true }
    }

    private func effortEmoji(_ score: Int) -> String {
        ["😩", "😕", "😐", "🙂", "😊"][score - 1]
    }
}
