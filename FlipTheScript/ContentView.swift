import SwiftUI
import CoreData

struct ContentView: View {
    @State private var selectedProduction: Production?
    @State private var selectedScene: ScriptScene?

    var body: some View {
        LicenseGate {
            VStack(spacing: 0) {
                NavigationSplitView {
                    ProductionListView(
                        selectedProduction: $selectedProduction,
                        selectedScene: $selectedScene
                    )
                } content: {
                    if let production = selectedProduction {
                        SceneListView(
                            production: production,
                            selectedScene: $selectedScene
                        )
                    } else {
                        ContentUnavailableView(
                            "No Production Selected",
                            systemImage: "film",
                            description: Text("Create or select a production from the sidebar.")
                        )
                    }
                } detail: {
                    if let scene = selectedScene {
                        SceneSplitView(scene: scene)
                    } else {
                        ContentUnavailableView(
                            "No Scene Selected",
                            systemImage: "doc.text",
                            description: Text("Select a scene to begin the breakdown.")
                        )
                    }
                }
                .navigationSplitViewStyle(.balanced)

                TrialBanner()
            }
        }
    }
}

// MARK: - Split detail: PDF left, breakdown right

struct SceneSplitView: View {
    let scene: ScriptScene

    var body: some View {
        #if os(macOS)
        HSplitView {
            // Left — script PDF scrolled to this scene's page
            if let pdfData = scene.script?.pdfData {
                PDFKitView(data: pdfData, page: Int(scene.pageStart))
                    .frame(minWidth: 300)
            }

            // Right — breakdown form
            SceneBreakdownView(scene: scene)
                .frame(minWidth: 320)
        }
        #else
        SceneBreakdownView(scene: scene)
        #endif
    }
}
