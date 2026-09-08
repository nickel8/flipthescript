import SwiftUI
import CoreData
import UniformTypeIdentifiers

struct ProductionListView: View {
    @Environment(\.managedObjectContext) private var context
    @FetchRequest(
        sortDescriptors: [NSSortDescriptor(key: "createdAt", ascending: false)],
        animation: .default
    ) private var productions: FetchedResults<Production>

    @Binding var selectedProduction: Production?
    @Binding var selectedScene: ScriptScene?
    @Binding var homeImportTrigger: Bool

    @State private var showingNewProduction = false
    @State private var newName = ""
    @State private var showingImport = false
    @State private var showingEpisodePicker = false
    @State private var importTarget: Production?
    @State private var importEpisode: Episode?
    @State private var importError: String?
    @State private var productionPendingDelete: Production?

    var body: some View {
        List(selection: $selectedProduction) {
            ForEach(productions) { production in
                ProductionRow(production: production)
                    .tag(production)
                    .contextMenu {
                        Button("Import Script…") {
                            triggerImport(for: production)
                        }
                        Divider()
                        Button("Delete Production…", role: .destructive) {
                            productionPendingDelete = production
                        }
                    }
            }
        }
        .navigationTitle("Productions")
        #if os(macOS)
        .navigationSplitViewColumnWidth(min: 180, ideal: 210)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingNewProduction = true } label: {
                    Label("New Production", systemImage: "plus")
                }
            }
        }
        .overlay {
            if productions.isEmpty {
                ContentUnavailableView(
                    "No Productions",
                    systemImage: "film",
                    description: Text("Click + to create your first production.")
                )
            }
        }
        .sheet(isPresented: $showingNewProduction) {
            NewProductionSheet(name: $newName) {
                let previous = selectedProduction
                let previousName = selectedProduction?.name
                let p = Production.create(name: newName, in: context)
                PersistenceController.shared.save()
                selectedProduction = p
                newName = ""
                showingNewProduction = false
                // macOS NavigationSplitView writes the new window title back via KVO
                // to the previously-selected production's `name`. Detect and revert.
                DispatchQueue.main.async {
                    if let prod = previous, let name = previousName, prod.name != name {
                        prod.name = name
                    }
                }
            } onCancel: {
                newName = ""
                showingNewProduction = false
            }
        }
        .fileImporter(
            isPresented: $showingImport,
            allowedContentTypes: [.pdf],
            allowsMultipleSelection: false
        ) { result in
            guard let production = importTarget else { return }
            let episode = importEpisode ?? production.defaultEpisode
            importEpisode = nil
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                importPDF(url: url, into: production, episode: episode)
            case .failure(let error):
                importError = error.localizedDescription
            }
        }
        .alert("Import Failed", isPresented: .constant(importError != nil)) {
            Button("OK") { importError = nil }
        } message: {
            Text(importError ?? "")
        }
        .sheet(item: $productionPendingDelete) { production in
            DeleteProductionSheet(production: production) {
                var next: Production? = nil
                var nextName: String? = nil
                if selectedProduction?.objectID == production.objectID {
                    next = productions.first(where: { $0.objectID != production.objectID })
                    nextName = next?.name
                    selectedProduction = next
                    selectedScene = nil
                }
                context.delete(production)
                PersistenceController.shared.save()
                productionPendingDelete = nil
                // Same KVO write-back hazard as production creation: macOS sees the
                // window title change and writes the old title back to the newly
                // selected production. Detect and revert.
                DispatchQueue.main.async {
                    if let prod = next, let name = nextName, prod.name != name {
                        prod.name = name
                    }
                }
            } onCancel: {
                productionPendingDelete = nil
            }
            .environment(\.managedObjectContext, context)
        }
        .onChange(of: homeImportTrigger) { _, triggered in
            guard triggered, let production = selectedProduction else { return }
            homeImportTrigger = false
            triggerImport(for: production)
        }
        .sheet(isPresented: $showingEpisodePicker) {
            if let production = importTarget {
                ImportEpisodePickerSheet(
                    production: production,
                    onSelect: { episode in
                        importEpisode = episode
                        showingEpisodePicker = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                            showingImport = true
                        }
                    },
                    onCancel: {
                        showingEpisodePicker = false
                        importTarget = nil
                    }
                )
            }
        }
    }

    private func triggerImport(for production: Production) {
        importTarget = production
        if production.hasEpisodes {
            showingEpisodePicker = true
        } else {
            showingImport = true
        }
    }

    private func importPDF(url: URL, into production: Production, episode: Episode?) {
        guard url.startAccessingSecurityScopedResource() else {
            importError = "Permission denied for this file."
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        guard let data = try? Data(contentsOf: url) else {
            importError = "Could not read file."
            return
        }
        guard ScriptParser.isTextBased(pdfData: data) else {
            importError = "This PDF appears to be scanned. Please use a text-based PDF."
            return
        }

        let targetEpisode = episode ?? production.defaultEpisode
        let filename = url.deletingPathExtension().lastPathComponent
        let version = "Draft \((targetEpisode?.scripts.count ?? 0) + 1)"
        let script = Script.create(version: version, filename: filename, pdfData: data, in: context)
        targetEpisode?.addScript(script)

        Task {
            let parsedScenes = ScriptParser.parse(pdfData: data)
            await MainActor.run {
                let previousScript = (targetEpisode?.scripts ?? [])
                    .filter { $0.objectID != script.objectID }
                    .max(by: { $0.importedAt < $1.importedAt })

                for parsed in parsedScenes {
                    let scene = ScriptScene.create(
                        sceneNumber: parsed.sceneNumber,
                        slugLine: parsed.slugLine,
                        intExt: parsed.intExt,
                        location: parsed.location,
                        timeOfDay: parsed.timeOfDay,
                        pageStart: parsed.pageStart,
                        rawText: parsed.rawText,
                        in: context
                    )
                    script.addScene(scene)
                }

                let diffSummary: DiffSummary?
                if let prev = previousScript {
                    diffSummary = ScriptDiffer.diff(
                        newScenes: script.scenes,
                        against: prev,
                        context: context
                    )
                } else {
                    diffSummary = nil
                }

                // Write ChangeEntry
                let ownerName = production.team.first(where: { $0.role == .owner })?.name ?? "You"
                let entry: ChangeEntry
                if let diff = diffSummary, diff.hasChanges {
                    var parts: [String] = []
                    if diff.modified > 0 { parts.append("\(diff.modified) revised") }
                    if diff.added > 0    { parts.append("\(diff.added) new") }
                    if diff.deleted > 0  { parts.append("\(diff.deleted) removed") }
                    let revised = script.scenes
                        .filter { $0.revisionStatus != .unchanged }
                        .map(\.sceneNumber)
                    entry = ChangeEntry.create(
                        type: .scenesRevised,
                        summary: "\(script.version) imported — \(parts.joined(separator: ", "))",
                        affectedSceneNumbers: revised,
                        authorName: ownerName,
                        in: context
                    )
                } else {
                    entry = ChangeEntry.create(
                        type: .newDraft,
                        summary: "\(script.version) imported — \(script.scenes.count) scenes",
                        authorName: ownerName,
                        in: context
                    )
                }
                production.addChangeEntry(entry)

                script.isParsing = false
                selectedScene = nil
                PersistenceController.shared.save()
            }
        }
    }
}

// MARK: - Episode picker (shown before file import for episode-based productions)

struct ImportEpisodePickerSheet: View {
    @Environment(\.dismiss) private var dismiss

    @ObservedObject var production: Production
    let onSelect: (Episode) -> Void
    let onCancel: () -> Void

    var namedEpisodes: [Episode] {
        production.episodes
            .filter { !$0.isDefault }
            .sorted { $0.number < $1.number }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Which episode?")
                    .font(.headline)
                Spacer()
                Button("Cancel", action: onCancel)
            }
            .padding()

            Divider()

            if namedEpisodes.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "film.stack")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No episodes configured")
                        .font(.headline)
                    Text("Add episodes from the Episodes tile first.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(namedEpisodes, id: \.objectID) { episode in
                            Button {
                                onSelect(episode)
                            } label: {
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(episode.name)
                                            .font(.headline)
                                            .foregroundStyle(Color.primary)
                                        if let script = episode.latestScript {
                                            Text(script.version)
                                                .font(.caption)
                                                .foregroundStyle(Color.secondary)
                                        } else {
                                            Text("No script imported")
                                                .font(.caption)
                                                .foregroundStyle(Color.secondary.opacity(0.6))
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                        .foregroundStyle(Color.secondary)
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            Divider().padding(.leading, 16)
                        }
                    }
                }
            }
        }
        .frame(minWidth: 340, minHeight: 380)
    }
}

// MARK: - Production Row

struct ProductionRow: View {
    let production: Production

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(production.name)
                .font(.headline)
            if let script = production.latestScript {
                HStack(spacing: 6) {
                    Text(script.version)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Color.black.opacity(0.75))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(script.revisionColor)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color.black.opacity(0.08), lineWidth: 0.5))
                    Text("\(script.completedCount)/\(script.totalCount)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("No script imported")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Delete Production Sheet

private struct DeleteProductionSheet: View {
    @ObservedObject var production: Production
    let onConfirm: () -> Void
    let onCancel: () -> Void

    @State private var confirmationText = ""
    @FocusState private var fieldFocused: Bool

    private var sceneCount: Int {
        production.scripts.flatMap { $0.scenes }.count
    }
    private var scriptCount: Int { production.scripts.count }
    private var todoCount: Int   { production.todoItems.count }

    private var nameMatches: Bool {
        confirmationText == production.name
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Header
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title)
                    .foregroundStyle(.red)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Delete \"\(production.name)\"?")
                        .font(.headline)
                    Text("This is permanent and cannot be undone.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(20)

            Divider()

            // What will be deleted
            VStack(alignment: .leading, spacing: 8) {
                Text("The following will be permanently deleted:")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                VStack(alignment: .leading, spacing: 6) {
                    deletionRow("doc.text", "\(scriptCount) script\(scriptCount == 1 ? "" : "s")")
                    deletionRow("film", "\(sceneCount) scene\(sceneCount == 1 ? "" : "s") and all breakdown data")
                    deletionRow("checkmark.circle", "\(todoCount) to-do item\(todoCount == 1 ? "" : "s")")
                    deletionRow("tag", "All elements, team members, and activity history")
                }
            }
            .padding(20)

            Divider()

            // Typed confirmation
            VStack(alignment: .leading, spacing: 8) {
                Text("Type the production name to confirm:")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                Text(production.name)
                    .font(.system(.body, design: .monospaced).weight(.medium))
                    .foregroundStyle(.primary)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.textBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(.separatorColor), lineWidth: 0.5))

                TextField("Type production name here…", text: $confirmationText)
                    .textFieldStyle(.roundedBorder)
                    .focused($fieldFocused)
                    .onSubmit { if nameMatches { onConfirm() } }
            }
            .padding(20)

            Divider()

            // Actions
            HStack {
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button(role: .destructive) {
                    onConfirm()
                } label: {
                    Label("Delete Production", systemImage: "trash")
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .disabled(!nameMatches)
                .keyboardShortcut(.defaultAction)
            }
            .padding(20)
        }
        .frame(width: 440)
        .onAppear { fieldFocused = true }
    }

    @ViewBuilder
    private func deletionRow(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(.red.opacity(0.7))
                .frame(width: 16)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.primary)
        }
    }
}

// MARK: - New Production Sheet

struct NewProductionSheet: View {
    @Binding var name: String
    let onCreate: () -> Void
    let onCancel: () -> Void
    @FocusState private var focused: Bool

    var body: some View {
        #if os(macOS)
        VStack(spacing: 20) {
            Text("New Production")
                .font(.headline)
            TextField("Production name", text: $name)
                .textFieldStyle(.roundedBorder)
                .focused($focused)
                .onSubmit { if !name.isEmpty { onCreate() } }
                .frame(minWidth: 280)
            HStack {
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Create", action: onCreate)
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(24)
        .onAppear { focused = true }
        #else
        NavigationStack {
            Form {
                TextField("Production name", text: $name)
                    .focused($focused)
            }
            .navigationTitle("New Production")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create", action: onCreate)
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { focused = true }
        }
        #endif
    }
}
