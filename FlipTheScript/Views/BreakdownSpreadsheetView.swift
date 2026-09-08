import SwiftUI

/// Full-screen spreadsheet preview — shows exactly what the XLSX export will look like.
/// Opened from the Export sheet. Updates reactively when the user fills in breakdowns.
struct BreakdownSpreadsheetView: View {
    @ObservedObject var script: Script
    @StateObject private var settings = ExportSettings.shared
    @Environment(\.dismiss) private var dismiss

    private var scenes: [ScriptScene] { script.sortedScenes }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            spreadsheet
        }
        .frame(minWidth: 900, minHeight: 540)
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Breakdown Preview")
                    .font(.headline)
                Text("\(script.filename) — \(script.version) · \(scenes.count) scenes")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("This is what your XLSX export will look like")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Done") { dismiss() }
                .keyboardShortcut(.defaultAction)
        }
        .padding()
    }

    // MARK: - Spreadsheet

    private var spreadsheet: some View {
        let headers = XLSXBuilder.allHeaders(settings: settings)
        let widths  = XLSXBuilder.allWidths(settings: settings)
        let accent  = settings.accentSwiftUIColor

        return ScrollView([.horizontal, .vertical]) {
            VStack(spacing: 0) {
                // Header row
                HStack(spacing: 0) {
                    ForEach(Array(headers.enumerated()), id: \.offset) { i, h in
                        headerCell(h, width: widths[i])
                        if i < headers.count - 1 { cellDivider }
                    }
                }
                .background(accent)

                Divider().background(accent)

                // Data rows
                LazyVStack(spacing: 0) {
                    ForEach(Array(scenes.enumerated()), id: \.element.objectID) { ri, scene in
                        SpreadsheetRow(
                            scene: scene,
                            settings: settings,
                            isAlt: ri % 2 != 0,
                            widths: widths
                        )
                        Divider().foregroundStyle(Color(nsColor: .separatorColor))
                    }
                }
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private func headerCell(_ text: String, width: Double) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .frame(width: width * 7.5, alignment: .leading)
            .padding(.horizontal, 6)
            .padding(.vertical, 7)
    }

    private var cellDivider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.2))
            .frame(width: 1)
    }
}

// MARK: - Row (separate view so each scene can be @ObservedObject)

private struct SpreadsheetRow: View {
    @ObservedObject var scene: ScriptScene
    @ObservedObject var settings: ExportSettings
    let isAlt: Bool
    let widths: [Double]

    var body: some View {
        let values  = XLSXBuilder.allValues(scene: scene, settings: settings)
        let headers = XLSXBuilder.allHeaders(settings: settings)

        HStack(spacing: 0) {
            ForEach(Array(values.enumerated()), id: \.offset) { i, v in
                dataCell(v, width: widths[i], colIndex: i, header: headers[i])
                Rectangle()
                    .fill(Color(nsColor: .separatorColor))
                    .frame(width: 1)
            }
        }
        .background(isAlt ? Color(red: 0.94, green: 0.95, blue: 0.95) : Color(nsColor: .controlBackgroundColor))
    }

    @ViewBuilder
    private func dataCell(_ text: String, width: Double, colIndex: Int, header: String) -> some View {
        let w = width * 7.5
        Group {
            if colIndex == 1 {           // I/E column — colour coded
                Text(text)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(intExtColor(text))
            } else if colIndex == 0 {   // Scene # — monospaced
                Text(text)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
            } else {
                Text(text)
                    .font(.caption)
                    .foregroundStyle(.primary)
                    .lineLimit(3)
            }
        }
        .frame(width: w, alignment: .leading)
        .padding(.horizontal, 6)
        .padding(.vertical, 5)
    }

    private func intExtColor(_ v: String) -> Color {
        switch v {
        case "EXT":     return .green
        case "INT/EXT": return .orange
        default:        return .blue
        }
    }
}
