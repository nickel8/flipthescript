import SwiftUI
import Sparkle

@main
struct FlipTheScriptApp: App {

    private let updaterController: SPUStandardUpdaterController

    init() {
        updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
    }

    var body: some SwiftUI.Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, PersistenceController.shared.viewContext)
                #if os(macOS)
                .frame(minWidth: 1000, minHeight: 660)
                #endif
        }
        .commands {
            CommandGroup(after: .appInfo) {
                CheckForUpdatesView(updater: updaterController.updater)
            }
        }
        .commands {
            AppCommands(updaterController: updaterController)
        }

        #if os(macOS)
        Window("Share Feedback", id: "feedback") {
            FeedbackView()
        }
        .defaultSize(width: 480, height: 560)
        .restorationBehavior(.disabled)

        Window("License", id: "license") {
            LicenseView()
        }
        .defaultSize(width: 440, height: 320)
        .restorationBehavior(.disabled)
        #endif
    }
}

// MARK: - Commands

struct AppCommands: Commands {
    let updaterController: SPUStandardUpdaterController
    @Environment(\.openWindow) private var openWindow

    var body: some Commands {
        CommandGroup(replacing: .help) {
            Button("Share Feedback…") {
                #if os(macOS)
                openWindow(id: "feedback")
                #endif
            }
            .keyboardShortcut("/", modifiers: [.command, .shift])

            Divider()

            Button("Manage License…") {
                openWindow(id: "license")
            }
        }
    }
}
