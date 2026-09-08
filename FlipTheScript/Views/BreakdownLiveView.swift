import SwiftUI
import Combine

// MARK: - Session model

@MainActor
final class BreakdownLiveSession: ObservableObject {
    @Published var scenes: [ParsedScene] = []
    @Published var isComplete = false
    var scriptName = ""

    func reset(scriptName: String) {
        scenes = []
        isComplete = false
        self.scriptName = scriptName
    }
}

// MARK: - Live view

struct BreakdownLiveView: View {
    @ObservedObject var session: BreakdownLiveSession
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            columnHeaders
            Divider()
            sceneTable
        }
        .frame(minWidth: 660, minHeight: 500)
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(session.isComplete ? "Breakdown complete" : "Building breakdown…")
                    .font(.headline)
                Text(session.scriptName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if session.isComplete {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else {
                ProgressView()
                    .controlSize(.small)
            }
            Text("\(session.scenes.count) scene\(session.scenes.count == 1 ? "" : "s")")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(minWidth: 64, alignment: .trailing)
            Button("Done") { dismiss() }
                .keyboardShortcut(.defaultAction)
        }
        .padding()
    }

    // MARK: Column headers

    private var columnHeaders: some View {
        HStack(spacing: 0) {
            columnLabel("#",        width: 44)
            Divider().frame(height: 18)
            columnLabel("I/E",     width: 70)
            Divider().frame(height: 18)
            Text("Location")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 12)
            Divider().frame(height: 18)
            columnLabel("Time",    width: 90)
            Divider().frame(height: 18)
            columnLabel("Pg",      width: 46)
        }
        .padding(.vertical, 6)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private func columnLabel(_ text: String, width: CGFloat) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .frame(width: width, alignment: .center)
    }

    // MARK: Scene table

    private var sceneTable: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(session.scenes.enumerated()), id: \.offset) { index, scene in
                        SceneStreamRow(scene: scene)
                            .id(index)
                            .transition(.push(from: .bottom).combined(with: .opacity))
                        if index < session.scenes.count - 1 {
                            Divider().padding(.leading, 12)
                        }
                    }
                }
                .padding(.vertical, 2)
                .animation(.easeOut(duration: 0.18), value: session.scenes.count)
            }
            .onChange(of: session.scenes.count) { _, count in
                guard count > 0 else { return }
                withAnimation { proxy.scrollTo(count - 1, anchor: .bottom) }
            }
        }
    }
}

// MARK: - Row

private struct SceneStreamRow: View {
    let scene: ParsedScene

    var body: some View {
        HStack(spacing: 0) {
            Text(scene.sceneNumber)
                .font(.system(.caption, design: .monospaced).weight(.medium))
                .foregroundStyle(.secondary)
                .frame(width: 44, alignment: .center)

            Divider()

            Text(scene.intExt)
                .font(.caption.weight(.bold))
                .foregroundStyle(intExtColor)
                .frame(width: 70, alignment: .center)

            Divider()

            Text(scene.location)
                .font(.subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 12)
                .lineLimit(1)
                .truncationMode(.tail)

            Divider()

            Text(scene.timeOfDay == "UNSPECIFIED" ? "—" : scene.timeOfDay)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 90, alignment: .center)
                .lineLimit(1)

            Divider()

            Text("\(scene.pageStart)")
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.secondary)
                .frame(width: 46, alignment: .center)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }

    private var intExtColor: Color {
        switch scene.intExt {
        case "EXT":     return .green
        case "INT/EXT": return .orange
        default:        return .blue   // INT
        }
    }
}
