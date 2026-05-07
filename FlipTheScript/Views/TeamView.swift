import SwiftUI
import CoreData

struct TeamView: View {
    @Environment(\.managedObjectContext) private var context
    @ObservedObject var production: Production
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTab: TeamTab = .activity
    @State private var showingAddMember = false
    @State private var memberToEdit: TeamMember?

    enum TeamTab { case members, activity }

    var body: some View {
        #if os(macOS)
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Team")
                    .font(.headline)
                Spacer()
                Button("Done") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 12)

            Picker("Tab", selection: $selectedTab) {
                Text("Members").tag(TeamTab.members)
                Text("Activity").tag(TeamTab.activity)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.bottom, 12)

            Divider()

            Group {
                if selectedTab == .members {
                    membersTab
                } else {
                    activityTab
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: 540, height: 480)
        #else
        NavigationStack {
            Group {
                if selectedTab == .members {
                    membersTab
                } else {
                    activityTab
                }
            }
            .navigationTitle("Team")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .principal) {
                    Picker("Tab", selection: $selectedTab) {
                        Text("Members").tag(TeamTab.members)
                        Text("Activity").tag(TeamTab.activity)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 200)
                }
            }
        }
        #endif
    }

    // MARK: - Members Tab

    private var membersTab: some View {
        VStack(spacing: 0) {
            if production.team.isEmpty {
                ContentUnavailableView(
                    "No Team Members",
                    systemImage: "person.2",
                    description: Text("Add people to share breakdowns and send notifications.")
                )
            } else {
                List {
                    ForEach(production.team.sorted(by: { $0.addedAt < $1.addedAt })) { member in
                        MemberRow(member: member)
                            .contentShape(Rectangle())
                            .onTapGesture { memberToEdit = member }
                            .contextMenu {
                                Button("Edit") { memberToEdit = member }
                                Divider()
                                Button("Remove", role: .destructive) {
                                    production.removeTeamMember(member)
                                    context.delete(member)
                                    PersistenceController.shared.save()
                                }
                            }
                    }
                }
                #if os(macOS)
                .listStyle(.inset)
                #endif
            }

            Divider()

            HStack {
                Spacer()
                Button {
                    showingAddMember = true
                } label: {
                    Label("Add Member", systemImage: "person.badge.plus")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)
            }
            .padding(16)
        }
        .sheet(isPresented: $showingAddMember) {
            AddMemberSheet { name, email, role, department, notifyByPush, notifyByEmail in
                let member = TeamMember.create(
                    name: name, email: email, role: role, department: department,
                    notifyByPush: notifyByPush, notifyByEmail: notifyByEmail,
                    in: context
                )
                production.addTeamMember(member)

                let ownerName = production.team.first(where: { $0.role == .owner })?.name ?? "You"
                let entry = ChangeEntry.create(
                    type: .teamUpdate,
                    summary: "\(member.name) added as \(member.role.rawValue) (\(member.department.rawValue))",
                    authorName: ownerName,
                    in: context
                )
                production.addChangeEntry(entry)
                PersistenceController.shared.save()
            }
        }
        .sheet(item: $memberToEdit) { member in
            EditMemberSheet(member: member) {
                let ownerName = production.team.first(where: { $0.role == .owner })?.name ?? "You"
                let entry = ChangeEntry.create(
                    type: .teamUpdate,
                    summary: "\(member.name)'s role updated to \(member.role.rawValue)",
                    authorName: ownerName,
                    in: context
                )
                production.addChangeEntry(entry)
                PersistenceController.shared.save()
            }
        }
    }

    // MARK: - Activity Tab

    private var activityTab: some View {
        Group {
            if production.sortedChangeLog.isEmpty {
                ContentUnavailableView(
                    "No Activity Yet",
                    systemImage: "clock",
                    description: Text("Script imports and team changes will appear here.")
                )
            } else {
                List(production.sortedChangeLog) { entry in
                    ActivityRow(entry: entry)
                }
                #if os(macOS)
                .listStyle(.inset)
                #endif
            }
        }
    }
}

// MARK: - Member Row

struct MemberRow: View {
    let member: TeamMember

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color.accentColor.opacity(0.15))
                Text(member.initials)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
            }
            .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(member.name)
                        .font(.body)
                    if member.role == .owner {
                        Image(systemName: "crown.fill")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
                }
                Text("\(member.department.rawValue) · \(member.role.rawValue)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Notification badges
            HStack(spacing: 6) {
                if member.notifyByPush {
                    Image(systemName: "bell.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if member.notifyByEmail {
                    Image(systemName: "envelope.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 3)
    }
}

// MARK: - Activity Row

struct ActivityRow: View {
    let entry: ChangeEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: entry.type.systemImage)
                .font(.system(size: 14))
                .foregroundStyle(iconColor)
                .frame(width: 24, height: 24)
                .background(iconColor.opacity(0.12))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(entry.summary)
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 6) {
                    Text(entry.authorName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("·")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Text(entry.createdAt.formatted(.relative(presentation: .named)))
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }

                if !entry.affectedSceneNumbers.isEmpty {
                    Text(entry.affectedScenesDescription)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 3)
    }

    private var iconColor: Color {
        switch entry.type {
        case .newDraft:       return .blue
        case .scenesRevised:  return .orange
        case .breakdownSaved: return .green
        case .teamUpdate:     return .purple
        case .note:           return .secondary
        }
    }
}

// MARK: - Add Member Sheet

struct AddMemberSheet: View {
    let onAdd: (String, String, TeamRole, Department, Bool, Bool) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var email = ""
    @State private var role: TeamRole = .viewer
    @State private var department: Department = .props
    @State private var notifyByPush = true
    @State private var notifyByEmail = false

    var body: some View {
        memberForm(title: "Add Team Member", actionLabel: "Add") {
            onAdd(name, email, role, department, notifyByPush, notifyByEmail)
            dismiss()
        }
    }

    @ViewBuilder
    private func memberForm(title: String, actionLabel: String, onCommit: @escaping () -> Void) -> some View {
        #if os(macOS)
        VStack(spacing: 20) {
            Text(title).font(.headline)

            Form {
                TextField("Name", text: $name)
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                Picker("Role", selection: $role) {
                    ForEach(TeamRole.allCases) { r in
                        Label(r.rawValue, systemImage: r.systemImage).tag(r)
                    }
                }
                Picker("Department", selection: $department) {
                    ForEach(Department.allCases) { d in
                        Text(d.rawValue).tag(d)
                    }
                }
                Toggle("Notify by push", isOn: $notifyByPush)
                Toggle("Notify by email", isOn: $notifyByEmail)
            }
            .formStyle(.grouped)

            HStack {
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Spacer()
                Button(actionLabel, action: onCommit)
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(24)
        .frame(width: 380)
        #else
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Name", text: $name)
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                }
                Section {
                    Picker("Role", selection: $role) {
                        ForEach(TeamRole.allCases) { r in
                            Label(r.rawValue, systemImage: r.systemImage).tag(r)
                        }
                    }
                    Picker("Department", selection: $department) {
                        ForEach(Department.allCases) { d in
                            Text(d.rawValue).tag(d)
                        }
                    }
                }
                Section("Notifications") {
                    Toggle("Push notification", isOn: $notifyByPush)
                    Toggle("Email notification", isOn: $notifyByEmail)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(actionLabel, action: onCommit)
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        #endif
    }
}

// MARK: - Edit Member Sheet

struct EditMemberSheet: View {
    @ObservedObject var member: TeamMember
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        #if os(macOS)
        VStack(spacing: 20) {
            Text("Edit Member").font(.headline)

            Form {
                TextField("Name", text: $member.name)
                TextField("Email", text: $member.email)
                    .textContentType(.emailAddress)
                Picker("Role", selection: $member.role) {
                    ForEach(TeamRole.allCases) { r in
                        Label(r.rawValue, systemImage: r.systemImage).tag(r)
                    }
                }
                Picker("Department", selection: $member.department) {
                    ForEach(Department.allCases) { d in
                        Text(d.rawValue).tag(d)
                    }
                }
                Toggle("Notify by push", isOn: $member.notifyByPush)
                Toggle("Notify by email", isOn: $member.notifyByEmail)
            }
            .formStyle(.grouped)

            HStack {
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Spacer()
                Button("Save") {
                    onSave()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(member.name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(24)
        .frame(width: 380)
        #else
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Name", text: $member.name)
                    TextField("Email", text: $member.email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                }
                Section {
                    Picker("Role", selection: $member.role) {
                        ForEach(TeamRole.allCases) { r in
                            Label(r.rawValue, systemImage: r.systemImage).tag(r)
                        }
                    }
                    Picker("Department", selection: $member.department) {
                        ForEach(Department.allCases) { d in
                            Text(d.rawValue).tag(d)
                        }
                    }
                }
                Section("Notifications") {
                    Toggle("Push notification", isOn: $member.notifyByPush)
                    Toggle("Email notification", isOn: $member.notifyByEmail)
                }
            }
            .navigationTitle("Edit Member")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(); dismiss() }
                        .disabled(member.name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        #endif
    }
}
