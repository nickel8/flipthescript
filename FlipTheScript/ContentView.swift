import SwiftUI
import CoreData
import UniformTypeIdentifiers

struct ContentView: View {
    @Environment(\.managedObjectContext) private var context
    @FetchRequest(
        sortDescriptors: [NSSortDescriptor(key: "createdAt", ascending: false)],
        animation: .default
    ) private var productions: FetchedResults<Production>

    @State private var selectedProduction: Production?
    @State private var selectedEpisode: Episode?
    @State private var selectedScene: ScriptScene?
    @State private var searchText = ""
    @State private var activeSearch = ""   // committed on Enter only

    // Sidebar visibility — show all columns by default
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    // Home tile actions
    @State private var showingChangeProduction = false
    @State private var showingChangeEpisode = false
    @State private var showingNewProduction = false
    @State private var newProductionName = ""
    @State private var homeImportTrigger = false
    @State private var showingScheduleImport = false
    @State private var parsedScheduleEntries: [ShootEntry] = []
    @State private var schedulePreviewScript: Script? = nil

    // Persist the active production across launches
    @AppStorage("activeProductionURI") private var activeProductionURI = ""

    var body: some View {
        LicenseGate {
            VStack(spacing: 0) {
                NavigationSplitView(columnVisibility: $columnVisibility) {
                    ProductionListView(
                        selectedProduction: $selectedProduction,
                        selectedScene: $selectedScene,
                        homeImportTrigger: $homeImportTrigger
                    )
                } content: {
                    if let production = selectedProduction {
                        SceneListView(
                            production: production,
                            episode: selectedEpisode,
                            selectedScene: $selectedScene,
                            searchText: $searchText,
                            activeSearch: $activeSearch
                        )
                        // Force view recreation when production changes so macOS's
                        // NavigationSplitView title-tracking state is fully torn down
                        // before the new production appears, preventing KVO write-back
                        // that renames the old production to the new production's name.
                        .id(production.objectID)
                    } else {
                        ContentUnavailableView(
                            "No Production Selected",
                            systemImage: "film",
                            description: Text("Create or select a production from the sidebar.")
                        )
                    }
                } detail: {
                    if let scene = selectedScene {
                        SceneSplitView(scene: scene, searchText: activeSearch, onHome: { selectedScene = nil })
                    } else {
                        HomeView(
                            selectedProduction: selectedProduction,
                            selectedEpisode: selectedEpisode,
                            onNewScript: {
                                homeImportTrigger = true
                            },
                            onNewAmendments: {
                                homeImportTrigger = true
                            },
                            onViewBreakdown: {
                                let script = selectedEpisode?.latestScript
                                    ?? selectedProduction?.latestScript
                                if let script {
                                    selectedScene = script.sortedScenes.first(where: { !$0.isComplete })
                                        ?? script.sortedScenes.first
                                }
                            },
                            onChangeProduction: {
                                showingChangeProduction = true
                            },
                            onChangeEpisode: {
                                showingChangeEpisode = true
                            },
                            onImportSchedule: {
                                showingScheduleImport = true
                            },
                            onEpisodesEnabled: { episode in
                                selectedEpisode = episode
                            }
                        )
                    }
                }
                .navigationSplitViewStyle(.balanced)
                .toolbar {
                    if selectedScene != nil {
                        ToolbarItem(placement: .navigation) {
                            Button { selectedScene = nil } label: {
                                Label("Dashboard", systemImage: "house")
                            }
                            .help("Back to dashboard")
                        }
                    }
                }
                .sheet(isPresented: $showingChangeProduction) {
                    ChangeProductionSheet(
                        productions: Array(productions),
                        selectedProduction: $selectedProduction,
                        onNewProduction: {
                            showingChangeProduction = false
                            showingNewProduction = true
                        }
                    )
                }
                .sheet(isPresented: $showingChangeEpisode) {
                    if let production = selectedProduction {
                        EpisodesSheet(production: production, selectedEpisode: $selectedEpisode)
                    }
                }
                .sheet(isPresented: $showingNewProduction) {
                    NewProductionSheet(name: $newProductionName) {
                        let previous = selectedProduction
                        let previousName = selectedProduction?.name
                        let p = Production.create(name: newProductionName, in: context)
                        PersistenceController.shared.save()
                        selectedProduction = p
                        newProductionName = ""
                        showingNewProduction = false
                        // macOS NavigationSplitView writes the new window title back via KVO
                        // to the previously-selected production's `name`. Detect and revert.
                        DispatchQueue.main.async {
                            if let prod = previous, let name = previousName, prod.name != name {
                                prod.name = name
                            }
                        }
                    } onCancel: {
                        newProductionName = ""
                        showingNewProduction = false
                    }
                }
                .fileImporter(
                    isPresented: $showingScheduleImport,
                    allowedContentTypes: [.pdf],
                    allowsMultipleSelection: false
                ) { result in
                    guard case .success(let urls) = result,
                          let url = urls.first,
                          url.startAccessingSecurityScopedResource() else { return }
                    defer { url.stopAccessingSecurityScopedResource() }
                    guard let data = try? Data(contentsOf: url) else { return }
                    let entries = ScheduleParser.parse(pdfData: data)
                    guard !entries.isEmpty else { return }
                    parsedScheduleEntries = entries
                    schedulePreviewScript = selectedEpisode?.latestScript ?? selectedProduction?.latestScript
                }
                .sheet(item: $schedulePreviewScript) { script in
                    ScheduleImportSheet(entries: parsedScheduleEntries, script: script)
                        .onDisappear { parsedScheduleEntries = [] }
                }

                TrialBanner()
            }
        }
        .onAppear { restoreActiveProduction() }
        .onChange(of: selectedProduction) { _, production in
            selectedScene = nil
            selectedEpisode = nil
            activeProductionURI = production?.objectID.uriRepresentation().absoluteString ?? ""
            if let p = production, p.hasEpisodes {
                selectedEpisode = p.episodes
                    .filter { !$0.isDefault }
                    .sorted { $0.number < $1.number }
                    .first
            }
        }
    }

    // ── Active production persistence ─────────────────────────────────────────

    private func restoreActiveProduction() {
        guard selectedProduction == nil else { return }

        if !activeProductionURI.isEmpty,
           let uri = URL(string: activeProductionURI),
           let id = context.persistentStoreCoordinator?.managedObjectID(forURIRepresentation: uri),
           let production = try? context.existingObject(with: id) as? Production {
            selectedProduction = production
        } else {
            // First launch or URI stale — pick the most recently created production
            selectedProduction = productions.first
        }
        if let p = selectedProduction, p.hasEpisodes {
            selectedEpisode = p.episodes
                .filter { !$0.isDefault }
                .sorted { $0.number < $1.number }
                .first
        }
    }
}

// MARK: - Split detail: PDF left, breakdown right

struct SceneSplitView: View {
    let scene: ScriptScene
    var searchText: String = ""
    var onHome: () -> Void = {}

    var body: some View {
        #if os(macOS)
        HSplitView {
            if let pdfData = scene.script?.pdfData {
                PDFKitView(data: pdfData, page: Int(scene.pageStart), searchText: searchText)
                    .frame(minWidth: 300)
            }
            SceneBreakdownView(scene: scene)
                .frame(minWidth: 320)
        }
        #else
        SceneBreakdownView(scene: scene)
        #endif
    }
}
