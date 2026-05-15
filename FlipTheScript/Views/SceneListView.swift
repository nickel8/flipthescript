import SwiftUI
import CoreData
import Combine
import PDFKit

struct SceneListView: View {
    @Environment(\.managedObjectContext) private var context
    @ObservedObject var production: Production
    var episode: Episode?
    @Binding var selectedScene: ScriptScene?
    @Binding var searchText: String
    @Binding var activeSearch: String

    @State private var activeScript: Script?
    @State private var showingPDFReader = false
    @State private var showingExport = false
    @State private var showingTeam = false
    @State private var showingEditDraft = false
    @State private var showingShare = false
    @StateObject private var license = LicenseManager.shared
    @State private var filterRevised = false
    @State private var sortByShootOrder = false
    // Local copy of the production name — prevents macOS NavigationSplitView from writing
    // back through KVO to production.name when the selected production changes.
    @State private var columnTitle: String = ""

    private var effectiveEpisode: Episode? { episode ?? production.defaultEpisode }
    private var effectiveLatestScript: Script? { effectiveEpisode?.latestScript }
    private var effectiveScripts: [Script] { effectiveEpisode?.scripts ?? production.scripts }

    var body: some View {
        Group {
            if let script = activeScript ?? effectiveLatestScript {
                scriptView(script)
            } else {
                ContentUnavailableView(
                    "No Script",
                    systemImage: "arrow.down.doc",
                    description: Text("Right-click the production in the sidebar to import a PDF script.")
                )
            }
        }
        .navigationTitle(columnTitle)
        #if os(macOS)
        .navigationSubtitle(episode?.name ?? "")
        .renameAction { }
        #endif
        .onAppear {
            if activeScript == nil { activeScript = effectiveLatestScript }
            columnTitle = production.name
        }
        .onChange(of: production) { _, newProduction in
            columnTitle = newProduction.name
            activeScript = nil
            selectedScene = nil
        }
        .onChange(of: episode) { _, _ in
            activeScript = nil
            selectedScene = nil
        }
    }

    @ViewBuilder
    private func scriptView(_ script: Script) -> some View {
        ScriptContentView(
            script: script,
            production: production,
            allScripts: effectiveScripts,
            selectedScene: $selectedScene,
            activeScript: $activeScript,
            showingPDFReader: $showingPDFReader,
            showingExport: $showingExport,
            showingTeam: $showingTeam,
            showingEditDraft: $showingEditDraft,
            showingShare: $showingShare,
            filterRevised: $filterRevised,
            sortByShootOrder: $sortByShootOrder,
            searchText: $searchText,
            activeSearch: $activeSearch
        )
        .environment(\.managedObjectContext, context)
    }

}

// MARK: - Script Content View (needs @ObservedObject on Script to react to isParsing)

private struct ScriptContentView: View {
    @ObservedObject var script: Script
    @ObservedObject var production: Production
    let allScripts: [Script]
    @Binding var selectedScene: ScriptScene?
    @Binding var activeScript: Script?
    @Binding var showingPDFReader: Bool
    @Binding var showingExport: Bool
    @Binding var showingTeam: Bool
    @Binding var showingEditDraft: Bool
    @Binding var showingShare: Bool
    @Binding var filterRevised: Bool
    @Binding var sortByShootOrder: Bool
    @Binding var searchText: String
    @Binding var activeSearch: String

    @Environment(\.managedObjectContext) private var context
    @StateObject private var license = LicenseManager.shared
    @State private var showingDiagnostics = false
    @State private var showingManualSelector = false
    /// Pages (1-based) where the current search query was found via native PDF search.
    @State private var pdfMatchPages: Set<Int> = []

    var body: some View {
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
                    if allScripts.count > 1 {
                        Picker("Version", selection: Binding(
                            get: { activeScript ?? script },
                            set: { activeScript = $0; selectedScene = nil }
                        )) {
                            ForEach(allScripts.sorted(by: { $0.importedAt > $1.importedAt })) { s in
                                HStack(spacing: 5) {
                                    Circle()
                                        .fill(s.revisionColor)
                                        .frame(width: 9, height: 9)
                                        .overlay(Circle().stroke(Color.secondary.opacity(0.3), lineWidth: 0.5))
                                    Text(s.version)
                                        .foregroundStyle(Color.black.opacity(0.75))
                                }
                                .tag(s)
                            }
                        }
                        .labelsHidden()
                        .fixedSize()
                    } else {
                        Text(script.version)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Color.black.opacity(0.75))
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

                    let hasSchedule = script.scenes.contains(where: { $0.shootOrder > 0 })
                    if hasSchedule {
                        Toggle(isOn: $sortByShootOrder) {
                            Label(sortByShootOrder ? "Story order" : "Shoot order", systemImage: "calendar")
                        }
                        .toggleStyle(.button)
                        .controlSize(.small)
                        .tint(.teal)
                    }
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

                if script.sortedScenes.isEmpty {
                    // No scenes at all — show parser help
                    noScenesView
                } else if filteredScenes.isEmpty {
                    // Scenes exist but search/filter returned nothing
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 32))
                            .foregroundStyle(.secondary)
                        Text("No scenes match \"\(searchText)\"")
                            .font(.headline)
                        Text("Try a different keyword.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(filteredScenes, selection: $selectedScene) { scene in
                        SceneRow(scene: scene, searchHint: matchHint(scene, query: searchText))
                            .tag(scene)
                    }
                    .id(filteredScenes.map(\.objectID))
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
                PDFReaderView(script: script, searchText: activeSearch)
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
            .sheet(isPresented: $showingDiagnostics) {
                DiagnosticsSheet(pdfData: script.pdfData)
            }
            .sheet(isPresented: $showingManualSelector) {
                ManualSceneSelectorSheet(pdfData: script.pdfData) { selected in
                    applyManualScenes(selected)
                }
            }
            .searchable(text: $searchText, prompt: "Search scenes… (press Return)")
            .onSubmit(of: .search) {
                activeSearch = searchText
                searchPDF(query: searchText)
            }
            .onChange(of: searchText) { _, query in
                if query.isEmpty { activeSearch = ""; pdfMatchPages = [] }
            }
        }
    }

    private func searchPDF(query: String) {
        guard !query.isEmpty, let pdfData = script.pdfData else {
            pdfMatchPages = []
            return
        }
        Task.detached(priority: .userInitiated) {
            guard let doc = PDFDocument(data: pdfData) else { return }
            let selections = doc.findString(query, withOptions: .caseInsensitive)
            var pages = Set<Int>()
            for sel in selections {
                for page in sel.pages {
                    pages.insert(doc.index(for: page) + 1)
                }
            }
            await MainActor.run { pdfMatchPages = pages }
        }
    }

    private var filteredScenes: [ScriptScene] {
        var scenes: [ScriptScene]
        if sortByShootOrder {
            // Scheduled scenes first (day → order), unscheduled at the end in story order
            let scheduled   = script.sortedScenes.filter { $0.shootOrder > 0 }
                .sorted { Int($0.shootOrder) < Int($1.shootOrder) }
            let unscheduled = script.sortedScenes.filter { $0.shootOrder == 0 }
            scenes = scheduled + unscheduled
        } else {
            scenes = script.sortedScenes
        }
        if filterRevised { scenes = scenes.filter { $0.revisionStatus != .unchanged } }
        if !activeSearch.isEmpty {
            scenes = scenes.filter { sceneMatches($0, query: activeSearch) }
        }
        return scenes
    }

    private func sceneMatches(_ scene: ScriptScene, query: String) -> Bool {
        if scene.location.localizedCaseInsensitiveContains(query)    { return true }
        if scene.sceneNumber.localizedCaseInsensitiveContains(query) { return true }
        if scene.slugLine.localizedCaseInsensitiveContains(query)    { return true }
        if scene.rawText.localizedCaseInsensitiveContains(query)     { return true }
        if pdfPageMatches(scene)                                      { return true }
        if let sheet = scene.breakdownSheet {
            if sheet.synopsis.localizedCaseInsensitiveContains(query) { return true }
            if sheet.notes.localizedCaseInsensitiveContains(query)    { return true }
            if sheet.sceneElements.contains(where: {
                $0.element?.name.localizedCaseInsensitiveContains(query) == true
            }) { return true }
        }
        if scene.todoItems.contains(where: {
            $0.title.localizedCaseInsensitiveContains(query)
        }) { return true }
        return false
    }

    /// Returns true if any PDF match page falls within this scene's page range.
    private func pdfPageMatches(_ scene: ScriptScene) -> Bool {
        guard !pdfMatchPages.isEmpty else { return false }
        let sorted = script.sortedScenes
        guard let idx = sorted.firstIndex(of: scene) else { return false }
        let start = Int(scene.pageStart)
        let end   = idx + 1 < sorted.count ? Int(sorted[idx + 1].pageStart) - 1 : Int.max
        return pdfMatchPages.contains(where: { $0 >= start && $0 <= end })
    }

    private func matchHint(_ scene: ScriptScene, query: String) -> String? {
        guard !query.isEmpty else { return nil }
        if let range = scene.rawText.range(of: query, options: .caseInsensitive) {
            return textSnippet(from: scene.rawText, around: range)
        }
        if pdfPageMatches(scene) { return "Found in script — p.\(scene.pageStart)" }
        if let sheet = scene.breakdownSheet {
            if let range = sheet.synopsis.range(of: query, options: .caseInsensitive) {
                return "Synopsis: \(textSnippet(from: sheet.synopsis, around: range))"
            }
            if let range = sheet.notes.range(of: query, options: .caseInsensitive) {
                return "Notes: \(textSnippet(from: sheet.notes, around: range))"
            }
            if let el = sheet.sceneElements.first(where: {
                $0.element?.name.localizedCaseInsensitiveContains(query) == true
            }) { return "Element: \(el.element?.name ?? "")" }
        }
        if let todo = scene.todoItems.first(where: {
            $0.title.localizedCaseInsensitiveContains(query)
        }) { return "To-do: \(todo.title)" }
        return nil
    }

    /// Extracts ~80 characters of context around a match range.
    private func textSnippet(from text: String, around range: Range<String.Index>) -> String {
        let radius = 40
        let lo = text.index(range.lowerBound, offsetBy: -radius, limitedBy: text.startIndex) ?? text.startIndex
        let hi = text.index(range.upperBound,  offsetBy:  radius, limitedBy: text.endIndex)  ?? text.endIndex
        var snippet = String(text[lo..<hi])
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespaces)
        if lo > text.startIndex { snippet = "…" + snippet }
        if hi < text.endIndex   { snippet += "…" }
        return snippet
    }

    @ViewBuilder
    private var noScenesView: some View {
        VStack(spacing: 14) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("No scenes found")
                .font(.headline)
            Text("The parser couldn't automatically detect scene headings in this PDF.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if script.pdfData != nil {
                Button("Pick Scenes Manually…") {
                    showingManualSelector = true
                }
                .buttonStyle(.borderedProminent)

                Button("Re-parse Automatically") {
                    reParse()
                }
                .buttonStyle(.bordered)

                Button("Diagnose PDF…") {
                    showingDiagnostics = true
                }
                .buttonStyle(.plain)
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func applyManualScenes(_ entries: [(line: String, page: Int)]) {
        for scene in script.scenes { context.delete(scene) }
        for (i, entry) in entries.enumerated() {
            let parsed = ScriptParser.parseAnyLine(entry.line, fallbackNumber: i + 1, page: entry.page)
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

        // Carry breakdown data forward from the previous draft
        let previousScript = allScripts
            .filter { $0.objectID != script.objectID }
            .max(by: { $0.importedAt < $1.importedAt })
        if let prev = previousScript {
            ScriptDiffer.diff(newScenes: script.scenes, against: prev, context: context)
        }

        selectedScene = nil
        PersistenceController.shared.save()
    }

    private func reParse() {
        guard let pdfData = script.pdfData else { return }
        for scene in script.scenes { context.delete(scene) }
        script.isParsing = true
        selectedScene = nil
        PersistenceController.shared.save()

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

}

// MARK: - Manual Scene Selector Sheet

private struct ManualSceneSelectorSheet: View {
    let pdfData: Data?
    let onConfirm: ([(line: String, page: Int)]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var allLines: [(line: String, page: Int)] = []
    @State private var selected: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Pick Scene Headings")
                        .font(.headline)
                    Text("Tap each line that is a scene heading. Selected lines become your scene list.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Use \(selected.count) Scene\(selected.count == 1 ? "" : "s")") {
                    let entries = selected.sorted().map { allLines[$0] }
                    onConfirm(entries)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .disabled(selected.isEmpty)
                .keyboardShortcut(.defaultAction)
            }
            .padding()

            Divider()

            if allLines.isEmpty {
                ProgressView("Reading PDF…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(allLines.enumerated()), id: \.offset) { idx, entry in
                            let isSelected = selected.contains(idx)
                            HStack(spacing: 10) {
                                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                                    .font(.system(size: 16))
                                    .frame(width: 20)

                                VStack(alignment: .leading, spacing: 1) {
                                    Text(entry.line)
                                        .font(.system(.body, design: .monospaced))
                                        .foregroundStyle(isSelected ? Color.primary : Color.primary.opacity(0.75))
                                    Text("p.\(entry.page)")
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 6)
                            .background(isSelected ? Color.accentColor.opacity(0.1) : Color.clear)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if isSelected { selected.remove(idx) } else { selected.insert(idx) }
                            }

                            Divider().padding(.leading, 44)
                        }
                    }
                }
            }
        }
        .frame(minWidth: 600, minHeight: 500)
        .onAppear { loadLines() }
    }

    private func loadLines() {
        guard let data = pdfData, let doc = PDFDocument(data: data) else { return }
        var result: [(line: String, page: Int)] = []
        for i in 0..<doc.pageCount {
            guard let page = doc.page(at: i), let text = page.string else { continue }
            for line in text.components(separatedBy: .newlines) {
                let t = line.trimmingCharacters(in: .whitespaces)
                guard !t.isEmpty, t.count > 2 else { continue }
                result.append((line: t, page: i + 1))
            }
        }
        allLines = result
    }
}

// MARK: - Diagnostics Sheet

private struct DiagnosticsSheet: View {
    let pdfData: Data?
    @Environment(\.dismiss) private var dismiss
    @State private var lines: [String] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("PDF Text Diagnostics")
                    .font(.headline)
                Spacer()
                Button("Done") { dismiss() }
            }
            .padding()

            Divider()

            Text("First 80 non-empty lines from this PDF. Lines containing INT/EXT are highlighted.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
                .padding(.vertical, 8)

            if lines.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                            let up = line.uppercased()
                            let isSlug = up.contains("INT") || up.contains("EXT")
                            Text(line)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(isSlug ? Color.blue : Color.primary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding()
                }
            }
        }
        .frame(minWidth: 560, minHeight: 420)
        .onAppear { loadLines() }
    }

    private func loadLines() {
        guard let data = pdfData, let document = PDFDocument(data: data) else {
            lines = ["⚠️ No PDF data — the file may not have been saved to disk correctly."]
            return
        }
        var result: [String] = ["PDF pages: \(document.pageCount)", ""]
        var count = 0
        outer: for i in 0..<min(document.pageCount, 10) {
            guard let page = document.page(at: i), let text = page.string else { continue }
            result.append("─── Page \(i + 1) ───")
            for line in text.components(separatedBy: .newlines) {
                let t = line.trimmingCharacters(in: .whitespaces)
                guard !t.isEmpty else { continue }
                result.append(t)
                count += 1
                if count >= 80 { break outer }
            }
        }
        lines = result
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
    var searchHint: String? = nil

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
                    if scene.shootDay > 0 {
                        Text("Day \(scene.shootDay) · #\(scene.shootOrder)")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.teal)
                    }
                    Text(scene.timeOfDay)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("p.\(scene.pageStart)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    if let hint = searchHint {
                        Text(hint)
                            .font(.caption)
                            .foregroundStyle(.purple)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    } else if let sheet = scene.breakdownSheet, !sheet.sceneElements.isEmpty {
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
