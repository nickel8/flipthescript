import SwiftUI

@main
struct FlipTheScriptApp: App {

    var body: some SwiftUI.Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, PersistenceController.shared.viewContext)
                #if os(macOS)
                .frame(minWidth: 1000, minHeight: 660)
                #endif
        }
        .commands {
            AppCommands()
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
