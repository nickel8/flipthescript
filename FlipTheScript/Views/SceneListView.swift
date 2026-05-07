import SwiftUI
import CoreData
import Combine

struct SceneListView: View {
    @Environment(\.managedObjectContext) private var context
    @ObservedObject var production: Production
    @Binding var selectedScene: ScriptScene?

    @State private var activeScript: Script?
    @State private var showingPDFReader = false
    @State private var showingExport = false
    @State private var showingTeam = false
    @State private var showingEditDraft = false
    @State private var showingShare = false
    @StateObject private var license = LicenseManager.shared
    @State private var filterRevised = false
    @State private var searchText = ""

    var body: some View {
        Group {
            if let script = activeScript ?? production.latestScript {
                scriptView(script)
            } else {
                ContentUnavailableView(
                    "No Script",
                    systemImage: "arrow.down.doc",
                    description: Text("Right-click the production in the sidebar to import a PDF script.")
                )
            }
        }
        .navigationTitle(production.name)
        .onAppear {
            if activeScript == nil { activeScript = production.latestScript }
        }
    }

    @ViewBuilder
    private func scriptView(_ script: Script) -> some View {
        let scenes = filteredScenes(script)

        if script.isParsing {
            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.2)
                Text("Parsing script…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Identifying scenes from the PDF")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
        VStack(spacing: 0) {
            // Top bar — version + completion only
            HStack(spacing: 8) {
                if production.scripts.count > 1 {
                    Picker("Version", selection: Binding(
                        get: { activeScript ?? script },
                        set: { activeScript = $0; selectedScene = nil }
                    )) {
                        ForEach(production.scripts.sorted(by: { $0.importedAt > $1.importedAt })) { s in
                            HStack(spacing: 5) {
                                Circle()
                                    .fill(s.revisionColor)
                                    .frame(width: 9, height: 9)
                                    .overlay(Circle().stroke(Color.secondary.opacity(0.3), lineWidth: 0.5))
                                Text(s.version)
                            }
                            .tag(s)
                        }
                    }
                    .labelsHidden()
                    .fixedSize()
                } else {
                    Text(script.version)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(script.revisionColor)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color.black.opacity(0.08), lineWidth: 0.5))
                }

                Button {
                    showingEditDraft = true
                } label: {
                    Image(systemName: "pencil")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Edit Draft")

                Spacer()

                let pct = Int(script.completionPercentage * 100)
                Text("\(pct)% complete")
                    .font(.caption)
                    .foregroundStyle(pct == 100 ? .green : .secondary)

                if script.scenes.contains(where: { $0.revisionStatus != .unchanged }) {
                    Toggle(isOn: $filterRevised) {
                        Label("Revised only", systemImage: "asterisk")
                    }
                    .toggleStyle(.button)
                    .controlSize(.small)
                    .tint(.orange)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.bar)

            Divider()

            if scenes.isEmpty && !script.isParsing {
                VStack(spacing: 14) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("No scenes found")
                        .font(.headline)
                    Text("The parser couldn't detect any scenes in this PDF. Try re-parsing.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    Button("Re-parse Script") {
                        reParse(script: script)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(scenes, selection: $selectedScene) { scene in
                    SceneRow(scene: scene)
                        .tag(scene)
                }
                .searchable(text: $searchText, prompt: "Search scenes…")
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button { showingShare = true } label: {
                    Label("Share Breakdown", systemImage: "person.crop.circle.badge.plus")
                }
                .disabled(license.state == .trial)
                .help(license.state == .trial ? "Sharing requires a full licence" : "Share Breakdown")

                Button { showingExport = true } label: {
                    Label("Export", systemImage: "square.and.arrow.up")
                }
                .disabled(license.state == .trial)
                .help(license.state == .trial ? "Export requires a full licence" : "Export")
            }

            ToolbarItemGroup(placement: .secondaryAction) {
                Button { showingPDFReader = true } label: {
                    Label("Read Script", systemImage: "doc.text.magnifyingglass")
                }
                .help("Read Script")

                Button { showingTeam = true } label: {
                    Label("Activity", systemImage: "clock")
                }
                .help("Activity log")
            }
        }
        .sheet(isPresented: $showingPDFReader) {
            PDFReaderView(script: script)
        }
        .sheet(isPresented: $showingExport) {
            ExportView(script: script)
        }
        .sheet(isPresented: $showingTeam) {
            TeamView(production: production)
                .environment(\.managedObjectContext, context)
        }
        .sheet(isPresented: $showingEditDraft) {
            EditDraftSheet(script: script)
                .environment(\.managedObjectContext, context)
        }
        .sheet(isPresented: $showingShare) {
            ShareView(script: script)
        }
        } // end else
    }

    private func reParse(script: Script) {
        guard let pdfData = script.pdfData else { return }
        for scene in script.scenes { context.delete(scene) }
        script.isParsing = true
        selectedScene = nil

        Task {
            let parsedScenes = ScriptParser.parse(pdfData: pdfData)
            await MainActor.run {
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
                script.isParsing = false
                PersistenceController.shared.save()
            }
        }
    }

    private func filteredScenes(_ script: Script) -> [ScriptScene] {
        var scenes = script.sortedScenes
        if filterRevised {
            scenes = scenes.filter { $0.revisionStatus != .unchanged }
        }
        if !searchText.isEmpty {
            scenes = scenes.filter {
                $0.location.localizedCaseInsensitiveContains(searchText) ||
                $0.sceneNumber.contains(searchText) ||
                $0.slugLine.localizedCaseInsensitiveContains(searchText)
            }
        }
        return scenes
    }
}

// MARK: - Edit Draft Sheet

struct EditDraftSheet: View {
    @ObservedObject var script: Script
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var selectedColor: RevisionColor = .white

    var body: some View {
        #if os(macOS)
        VStack(alignment: .leading, spacing: 20) {
            Text("Edit Draft").font(.headline)

            VStack(alignment: .leading, spacing: 6) {
                Text("Name").font(.caption).foregroundStyle(.secondary)
                TextField("e.g. Pink Amends", text: $name)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Revision colour").font(.caption).foregroundStyle(.secondary)
                LazyVGrid(columns: Array(repeating: GridItem(.fixed(36), spacing: 8), count: 9), spacing: 8) {
                    ForEach(RevisionColor.allCases) { rc in
                        Button {
                            selectedColor = rc
                        } label: {
                            Circle()
                                .fill(rc.color)
                                .frame(width: 28, height: 28)
                                .overlay(Circle().stroke(Color.secondary.opacity(0.3), lineWidth: 0.5))
                                .overlay {
                                    if selectedColor == rc {
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundStyle(rc == .white || rc == .yellow || rc == .buff ? .black : .white)
                                    }
                                }
                        }
                        .buttonStyle(.plain)
                        .help(rc.rawValue)
                    }
                }
            }

            HStack {
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Spacer()
                Button("Save") { save() }.keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(24)
        .frame(width: 380)
        .onAppear { load() }
        #else
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("e.g. Pink Amends", text: $name)
                }
                Section("Revision colour") {
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(44), spacing: 8), count: 5), spacing: 8) {
                        ForEach(RevisionColor.allCases) { rc in
                            Button { selectedColor = rc } label: {
                                Circle().fill(rc.color).frame(width: 36, height: 36)
                                    .overlay(Circle().stroke(Color.secondary.opacity(0.3), lineWidth: 0.5))
                                    .overlay {
                                        if selectedColor == rc {
                                            Image(systemName: "checkmark")
                                                .font(.system(size: 14, weight: .bold))
                                                .foregroundStyle(rc == .white || rc == .yellow || rc == .buff ? .black : .white)
                                        }
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Edit Draft")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { load() }
        }
        #endif
    }

    private func load() {
        name = script.version
        selectedColor = RevisionColor.allCases.first { $0.hex == script.colorHex } ?? .white
    }

    private func save() {
        script.version  = name.trimmingCharacters(in: .whitespaces)
        script.colorHex = selectedColor.hex
        PersistenceController.shared.save()
        script.production?.objectWillChange.send()
        dismiss()
    }
}

// MARK: - Scene Row

struct SceneRow: View {
    let scene: ScriptScene

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: scene.isComplete ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(scene.isComplete ? .green : Color(.tertiaryLabelColor))
                .font(.system(size: 16))

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(scene.sceneNumber)
                        .font(.caption.weight(.bold).monospacedDigit())
                        .foregroundStyle(.secondary)
                    Text(scene.displayTitle)
                        .font(.body)
                        .lineLimit(1)
                }
                HStack(spacing: 6) {
                    Text(scene.timeOfDay)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("p.\(scene.pageStart)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    if let sheet = scene.breakdownSheet, !sheet.sceneElements.isEmpty {
                        Text("· \(sheet.sceneElements.count) elements")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            if scene.revisionStatus != .unchanged {
                Text(scene.revisionStatus == .added ? "NEW" : "REV")
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(scene.revisionStatus == .added
                        ? Color.green.opacity(0.15)
                        : Color.orange.opacity(0.15))
                    .foregroundStyle(scene.revisionStatus == .added ? .green : .orange)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
        .padding(.vertical, 3)
    }
}
