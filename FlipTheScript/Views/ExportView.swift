import SwiftUI
import UniformTypeIdentifiers
#if os(macOS)
import AppKit
#endif

struct ExportView: View {
    let script: Script
    @Environment(\.dismiss) private var dismiss
    @StateObject private var settings = ExportSettings.shared

    @State private var isGeneratingPDF  = false
    @State private var isGeneratingCSV  = false
    @State private var isGeneratingXLSX = false
    @State private var showingPreview   = false

    @State private var errorMessage: String?
    @State private var showingError = false
    @State private var successMessage: String?

    // iOS-only: fileExporter state
    #if os(iOS)
    @State private var showingPDFExporter = false
    @State private var showingCSVExporter = false
    @State private var pdfData = Data()
    @State private var csvData = Data()
    #endif

    var body: some View {
        NavigationStack {
            List {
                // MARK: Format settings
                Section("Format") {
                    // Page size
                    Picker("Page Size", selection: $settings.pageSize) {
                        ForEach(ExportSettings.PageSize.allCases) {
                            Text($0.rawValue).tag($0)
                        }
                    }

                    // Font size
                    Picker("Font Size", selection: $settings.bodyFontSize) {
                        ForEach(ExportSettings.FontSize.allCases) {
                            Text($0.rawValue).tag($0)
                        }
                    }

                    // Accent colour
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Header Colour")
                            .font(.body)
                        HStack(spacing: 10) {
                            ForEach(ExportSettings.accentPresets, id: \.hex) { preset in
                                Button {
                                    settings.accentHex = preset.hex
                                } label: {
                                    Circle()
                                        .fill(Color(cgColor: settings.cgColor(fromHex: preset.hex)!))
                                        .frame(width: 28, height: 28)
                                        .overlay(
                                            Circle().stroke(Color.white, lineWidth: settings.accentHex == preset.hex ? 2.5 : 0)
                                        )
                                        .overlay(
                                            Circle().stroke(Color.black.opacity(0.15), lineWidth: 0.5)
                                        )
                                        .shadow(color: .black.opacity(settings.accentHex == preset.hex ? 0.3 : 0), radius: 3)
                                }
                                .buttonStyle(.plain)
                                .help(preset.name)
                            }
                        }
                    }
                    .padding(.vertical, 4)

                    // Logo
                    #if os(macOS)
                    HStack {
                        Text("Company Logo")
                        Spacer()
                        if settings.logoData != nil {
                            Button("Remove", role: .destructive) {
                                settings.logoData = nil
                            }
                            .font(.caption)
                            .foregroundStyle(.red)
                        }
                        Button(settings.logoData == nil ? "Choose Image…" : "Replace…") {
                            pickLogo()
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                    if let logoData = settings.logoData,
                       let nsImage = NSImage(data: logoData) {
                        HStack {
                            Image(nsImage: nsImage)
                                .resizable()
                                .scaledToFit()
                                .frame(height: 36)
                                .opacity(0.85)
                            Spacer()
                        }
                    }
                    #endif
                }

                // Category visibility
                Section("Include Categories") {
                    ForEach(ElementCategory.allCases) { cat in
                        Toggle(isOn: Binding(
                            get: { !settings.hiddenCategories.contains(cat.rawValue) },
                            set: { include in
                                if include {
                                    settings.hiddenCategories.remove(cat.rawValue)
                                } else {
                                    settings.hiddenCategories.insert(cat.rawValue)
                                }
                            }
                        )) {
                            Label(cat.rawValue, systemImage: cat.icon)
                                .foregroundStyle(settings.hiddenCategories.contains(cat.rawValue) ? .secondary : cat.color)
                        }
                    }
                }

                Section {
                    exportRow(
                        title: "Breakdown PDF",
                        subtitle: "One page per scene — synopsis and elements",
                        icon: "doc.richtext",
                        iconColor: .red,
                        isGenerating: isGeneratingPDF,
                        action: generatePDF
                    )

                    exportRow(
                        title: "Styled Spreadsheet (.xlsx)",
                        subtitle: "House style applied — opens directly in Excel",
                        icon: "tablecells.fill",
                        iconColor: .green,
                        isGenerating: isGeneratingXLSX,
                        action: generateXLSX
                    )

                    exportRow(
                        title: "Raw CSV",
                        subtitle: "Plain data — no formatting",
                        icon: "tablecells",
                        iconColor: .secondary,
                        isGenerating: isGeneratingCSV,
                        action: generateCSV
                    )

                    Button(action: { showingPreview = true }) {
                        HStack(spacing: 14) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(settings.accentSwiftUIColor.opacity(0.12))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "eye.fill")
                                    .font(.system(size: 18))
                                    .foregroundStyle(settings.accentSwiftUIColor)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Preview spreadsheet").font(.body).foregroundStyle(.primary)
                                Text("See what your XLSX export will look like")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                } header: {
                    Text("\(script.version) — \(script.filename)")
                } footer: {
                    Text("\(script.totalCount) scenes · \(script.completedCount) with breakdowns")
                }
                .sheet(isPresented: $showingPreview) {
                    BreakdownSpreadsheetView(script: script)
                }

                if let msg = successMessage {
                    Section {
                        Label(msg, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .font(.subheadline)
                    }
                }
            }
            .navigationTitle("Export")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        #if os(iOS)
        .fileExporter(
            isPresented: $showingPDFExporter,
            document: ExportItem(data: pdfData),
            contentType: .pdf,
            defaultFilename: filename(ext: "pdf")
        ) { result in
            switch result {
            case .success: successMessage = "PDF saved successfully"
            case .failure(let e): showError(e.localizedDescription)
            }
        }
        .fileExporter(
            isPresented: $showingCSVExporter,
            document: ExportItem(data: csvData),
            contentType: .commaSeparatedText,
            defaultFilename: filename(ext: "csv")
        ) { result in
            switch result {
            case .success: successMessage = "CSV saved successfully"
            case .failure(let e): showError(e.localizedDescription)
            }
        }
        #endif
        .alert("Export Failed", isPresented: $showingError) {
            Button("OK") { }
        } message: {
            Text(errorMessage ?? "Unknown error")
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 280)
        #endif
    }

    // MARK: - Row builder

    @ViewBuilder
    private func exportRow(
        title: String,
        subtitle: String,
        icon: String,
        iconColor: Color,
        isGenerating: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(iconColor.opacity(0.12))
                        .frame(width: 40, height: 40)
                    if isGenerating {
                        ProgressView().scaleEffect(0.7)
                    } else {
                        Image(systemName: icon)
                            .font(.system(size: 18))
                            .foregroundStyle(iconColor)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.body).foregroundStyle(.primary)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if !isGenerating {
                    Image(systemName: "arrow.down.to.line")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isGenerating)
    }

    // MARK: - Actions

    private func generatePDF() {
        guard !isGeneratingPDF else { return }
        successMessage = nil
        isGeneratingPDF = true

        Task { @MainActor in
            let data = ExportService.buildBreakdownPDF(script: script)
            isGeneratingPDF = false

            if data.isEmpty {
                showError("PDF generation failed — no data produced.")
            } else {
                #if os(macOS)
                saveWithPanel(data: data, contentType: .pdf, ext: "pdf")
                #else
                pdfData = data
                showingPDFExporter = true
                #endif
            }
        }
    }

    private func generateXLSX() {
        guard !isGeneratingXLSX else { return }
        successMessage = nil
        isGeneratingXLSX = true

        Task { @MainActor in
            let data = ExportService.buildBreakdownXLSX(script: script, settings: settings)
            isGeneratingXLSX = false

            if data.isEmpty {
                showError("XLSX generation failed.")
            } else {
                #if os(macOS)
                saveWithPanel(data: data, contentType: .init(filenameExtension: "xlsx")!, ext: "xlsx")
                #endif
            }
        }
    }

    private func generateCSV() {
        guard !isGeneratingCSV else { return }
        successMessage = nil
        isGeneratingCSV = true

        Task { @MainActor in
            let csv = ExportService.buildBreakdownCSV(script: script)
            isGeneratingCSV = false

            if csv.isEmpty {
                showError("CSV generation failed.")
            } else {
                #if os(macOS)
                saveWithPanel(data: Data(csv.utf8), contentType: .commaSeparatedText, ext: "csv")
                #else
                csvData = Data(csv.utf8)
                showingCSVExporter = true
                #endif
            }
        }
    }

    #if os(macOS)
    private func saveWithPanel(data: Data, contentType: UTType, ext: String) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [contentType]
        panel.nameFieldStringValue = filename(ext: ext)
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                try data.write(to: url)
                DispatchQueue.main.async { successMessage = "\(ext.uppercased()) saved successfully" }
            } catch {
                DispatchQueue.main.async { showError(error.localizedDescription) }
            }
        }
    }
    #endif

    #if os(macOS)
    private func pickLogo() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.png, .jpeg, .tiff]
        panel.allowsMultipleSelection = false
        panel.message = "Choose a logo image (PNG recommended)"
        panel.begin { response in
            guard response == .OK, let url = panel.url,
                  let data = try? Data(contentsOf: url) else { return }
            DispatchQueue.main.async { settings.logoData = data }
        }
    }
    #endif

    private func showError(_ msg: String) {
        errorMessage = msg
        showingError = true
    }

    private func filename(ext: String) -> String {
        let safe = script.filename.replacingOccurrences(of: "/", with: "-")
        return "\(safe) — \(script.version) Breakdown.\(ext)"
    }
}

// MARK: - FileDocument (iOS only)

#if os(iOS)
struct ExportItem: FileDocument {
    static var readableContentTypes: [UTType] { [.pdf, .commaSeparatedText, .data] }
    var data: Data

    init(data: Data) { self.data = data }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
#endif
