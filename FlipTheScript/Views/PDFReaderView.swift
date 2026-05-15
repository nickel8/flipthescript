import SwiftUI
import PDFKit

// Full-screen reader (still used from the "Read Script" toolbar button)
struct PDFReaderView: View {
    let script: Script
    var searchText: String = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            PDFKitView(data: script.pdfData ?? Data(), page: 1, searchText: searchText)
                .navigationTitle("\(script.version) — \(script.filename)")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
        #if os(macOS)
        .frame(minWidth: 600, minHeight: 700)
        #endif
    }
}

// MARK: - PDFKit wrapper (page-aware)

#if os(macOS)
struct PDFKitView: NSViewRepresentable {
    let data: Data
    let page: Int
    var searchText: String = ""

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator {
        var lastPage: Int = -1
        var lastSearch: String = ""
    }

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.document = PDFDocument(data: data)
        scroll(to: page, in: view)
        context.coordinator.lastPage = page
        context.coordinator.lastSearch = searchText
        if !searchText.isEmpty {
            DispatchQueue.main.async { highlight(searchText, in: view) }
        }
        return view
    }

    func updateNSView(_ view: PDFView, context: Context) {
        if context.coordinator.lastPage != page {
            scroll(to: page, in: view)
            context.coordinator.lastPage = page
        }
        if context.coordinator.lastSearch != searchText {
            highlight(searchText, in: view)
            context.coordinator.lastSearch = searchText
        }
    }

    private func scroll(to pageNumber: Int, in view: PDFView) {
        guard let doc = view.document,
              let pdfPage = doc.page(at: max(0, pageNumber - 1)) else { return }
        view.go(to: pdfPage)
    }

    private func highlight(_ query: String, in view: PDFView) {
        guard !query.isEmpty, let doc = view.document else {
            view.highlightedSelections = nil
            return
        }
        let selections = doc.findString(query, withOptions: .caseInsensitive)
        view.highlightedSelections = selections
        // Scroll to first match
        if let first = selections.first, let page = first.pages.first {
            view.go(to: first.bounds(for: page), on: page)
        }
    }
}
#else
struct PDFKitView: UIViewRepresentable {
    let data: Data
    let page: Int
    var searchText: String = ""

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator {
        var lastPage: Int = -1
        var lastSearch: String = ""
    }

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.document = PDFDocument(data: data)
        scroll(to: page, in: view)
        context.coordinator.lastPage = page
        context.coordinator.lastSearch = searchText
        if !searchText.isEmpty {
            DispatchQueue.main.async { highlight(searchText, in: view) }
        }
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {
        if context.coordinator.lastPage != page {
            scroll(to: page, in: view)
            context.coordinator.lastPage = page
        }
        if context.coordinator.lastSearch != searchText {
            highlight(searchText, in: view)
            context.coordinator.lastSearch = searchText
        }
    }

    private func scroll(to pageNumber: Int, in view: PDFView) {
        guard let doc = view.document,
              let pdfPage = doc.page(at: max(0, pageNumber - 1)) else { return }
        view.go(to: pdfPage)
    }

    private func highlight(_ query: String, in view: PDFView) {
        guard !query.isEmpty, let doc = view.document else {
            view.highlightedSelections = nil
            return
        }
        let selections = doc.findString(query, withOptions: .caseInsensitive)
        view.highlightedSelections = selections
        if let first = selections.first, let page = first.pages.first {
            view.go(to: first.bounds(for: page), on: page)
        }
    }
}
#endif
