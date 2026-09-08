import SwiftUI
import CoreData

struct ShareView: View {
    let script: Script
    @Environment(\.dismiss) private var dismiss
    @Environment(\.managedObjectContext) private var context

    // Admin access (co-editors)
    @State private var adminEmails: [String]
    @State private var newAdminEmail = ""

    // Team (read-only web viewers)
    @State private var adEmail = UserDefaults.standard.string(forKey: "share.adEmail") ?? ""
    @State private var teamEmails: [String]
    @State private var newTeamEmail = ""

    // Team members (roles/departments)
    @State private var showingAddMember = false
    @State private var memberToEdit: TeamMember?

    // Publishing
    @State private var isPublishing = false
    @State private var publishedURL: URL?
    @State private var errorMessage: String?

    init(script: Script) {
        self.script = script
        _adminEmails = State(initialValue: script.production?.adminEmails ?? [])
        _teamEmails  = State(initialValue: script.production?.shareEmails ?? [])
    }

    var body: some View {
        NavigationStack {
            if let url = publishedURL {
                successView(url: url)
            } else {
                formView
            }
        }
        #if os(macOS)
        .frame(minWidth: 480, minHeight: 460)
        #endif
    }

    // MARK: - Form

    private var formView: some View {
        List {

            // ── Admin access ──────────────────────────────────────────────
            Section {
                ForEach(adminEmails, id: \.self) { email in
                    HStack {
                        Image(systemName: "crown.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                        Text(email)
                        Spacer()
                        Button {
                            adminEmails.removeAll { $0 == email }
                        } label: {
                            Image(systemName: "minus.circle.fill").foregroundStyle(.red)
                        }
                        .buttonStyle(.plain)
                    }
                }

                HStack {
                    TextField("Add co-editor email…", text: $newAdminEmail)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        #if os(macOS)
                        .textFieldStyle(.roundedBorder)
                        #endif
                        .onSubmit { addAdmin() }
                    Button("Add", action: addAdmin)
                        .disabled(newAdminEmail.isEmpty)
                }
            } header: {
                Label("Admin access", systemImage: "crown")
            } footer: {
                Text("Admins can open, edit and amend this breakdown. Full sync between admins is coming soon.")
            }

            // ── Your email ────────────────────────────────────────────────
            Section {
                TextField("your@email.com", text: $adEmail)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled()
                    #if os(macOS)
                    .textFieldStyle(.roundedBorder)
                    #endif
            } header: {
                Text("Your email")
            } footer: {
                Text("Used so team members know who sent the breakdown link.")
            }

            // ── Team (read-only) ──────────────────────────────────────────
            Section {
                ForEach(teamEmails, id: \.self) { email in
                    HStack {
                        Image(systemName: "eye")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(email)
                        Spacer()
                        Button {
                            teamEmails.removeAll { $0 == email }
                        } label: {
                            Image(systemName: "minus.circle.fill").foregroundStyle(.red)
                        }
                        .buttonStyle(.plain)
                    }
                }

                HStack {
                    TextField("Add team member email…", text: $newTeamEmail)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        #if os(macOS)
                        .textFieldStyle(.roundedBorder)
                        #endif
                        .onSubmit { addTeam() }
                    Button("Add", action: addTeam)
                        .disabled(newTeamEmail.isEmpty)
                }
            } header: {
                Label("Team — read only", systemImage: "eye")
            } footer: {
                Text("Each person receives a personal access link by email to view the breakdown in their browser. Links expire after 7 days.")
            }

            // ── Error ─────────────────────────────────────────────────────
            if let err = errorMessage {
                Section {
                    Label(err, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }

            // ── Publish ───────────────────────────────────────────────────
            Section {
                Button(action: publish) {
                    HStack {
                        Spacer()
                        if isPublishing {
                            ProgressView().scaleEffect(0.8)
                            Text("Publishing…")
                        } else {
                            Image(systemName: "paperplane.fill")
                            Text(teamEmails.isEmpty ? "Publish breakdown" : "Publish & send links")
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(adEmail.isEmpty || isPublishing)
            } footer: {
                Text("No script text is shared — only scene synopses and tagged elements.")
            }

        }
        .navigationTitle("Share & Team")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .onChange(of: adminEmails) { _, newValue in
            script.production?.adminEmails = newValue
            PersistenceController.shared.save()
        }
        .onChange(of: teamEmails) { _, newValue in
            script.production?.shareEmails = newValue
            PersistenceController.shared.save()
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    // MARK: - Success

    private func successView(url: URL) -> some View {
        VStack(spacing: 24) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 52))
                .foregroundStyle(.green)

            VStack(spacing: 8) {
                Text("Breakdown published")
                    .font(.title2.weight(.bold))
                Text(teamEmails.isEmpty
                     ? "Your breakdown is live."
                     : "Access links sent to \(teamEmails.count) team member\(teamEmails.count == 1 ? "" : "s").")
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 12) {
                Button {
                    #if os(macOS)
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(url.absoluteString, forType: .string)
                    #endif
                } label: {
                    Label("Copy link", systemImage: "link")
                }
                .buttonStyle(.bordered)

                Button("Done") { dismiss() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }

    // MARK: - Actions

    private func addAdmin() {
        let trimmed = newAdminEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty, trimmed.contains("@"), !adminEmails.contains(trimmed) else { return }
        adminEmails.append(trimmed)
        newAdminEmail = ""
    }

    private func addTeam() {
        let trimmed = newTeamEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty, trimmed.contains("@"), !teamEmails.contains(trimmed) else { return }
        teamEmails.append(trimmed)
        newTeamEmail = ""
    }

    private func publish() {
        guard !isPublishing else { return }
        let trimmedEmail = adEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmedEmail.isEmpty else { return }
        addTeam() // auto-add any unsaved email in the field

        UserDefaults.standard.set(trimmedEmail, forKey: "share.adEmail")
        isPublishing = true
        errorMessage = nil

        // Build a lookup from email → department using the production's team list.
        // If a team email isn't in the team list, department defaults to "Other".
        let teamByEmail: [String: TeamMember] = Dictionary(
            uniqueKeysWithValues: (script.production?.team ?? []).map { ($0.email.lowercased(), $0) }
        )
        let colleagues: [[String: String]] = teamEmails.map { email in
            let dept = teamByEmail[email.lowercased()]?.department.rawValue ?? "Other"
            return ["email": email, "department": dept]
        }

        Task { @MainActor in
            do {
                let result = try await ShareService.publish(
                    script: script,
                    adEmail: trimmedEmail,
                    colleagues: colleagues
                )
                publishedURL = result.viewURL
            } catch {
                errorMessage = error.localizedDescription
            }
            isPublishing = false
        }
    }
}
