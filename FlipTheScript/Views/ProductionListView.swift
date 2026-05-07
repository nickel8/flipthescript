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

    @State private var showingNewProduction = false
    @State private var newName = ""
    @State private var showingImport = false
    @State private var importTarget: Production?
    @State private var importError: String?

    var body: some View {
        List(selection: $selectedProduction) {
            ForEach(productions) { production in
                ProductionRow(production: production)
                    .tag(production)
                    .contextMenu {
                        Button("Import Script…") {
                            importTarget = production
                            showingImport = true
                        }
                        Divider()
                        Button("Delete", role: .destructive) {
                            if selectedProduction?.objectID == production.objectID {
                                selectedProduction = nil
                                selectedScene = nil
                            }
                            context.delete(production)
                            PersistenceController.shared.save()
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
                let p = Production.create(name: newName, in: context)
                PersistenceController.shared.save()
                selectedProduction = p
                newName = ""
                showingNewProduction = false
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
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                importPDF(url: url, into: production)
            case .failure(let error):
                importError = error.localizedDescription
            }
        }
        .alert("Import Failed", isPresented: .constant(importError != nil)) {
            Button("OK") { importError = nil }
        } message: {
            Text(importError ?? "")
        }
    }

    private func importPDF(url: URL, into production: Production) {
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

        let filename = url.deletingPathExtension().lastPathComponent
        let version = "Draft \(production.scripts.count + 1)"
        let script = Script.create(version: version, filename: filename, pdfData: data, in: context)
        production.addScript(script)

        Task {
            let parsedScenes = ScriptParser.parse(pdfData: data)
            await MainActor.run {
                let previousScript = production.scripts
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
                        .foregroundStyle(.primary.opacity(0.8))
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
