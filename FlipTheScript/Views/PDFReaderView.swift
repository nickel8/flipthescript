import SwiftUI
import PDFKit

// Full-screen reader (still used from the "Read Script" toolbar button)
struct PDFReaderView: View {
    let script: Script
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            PDFKitView(data: script.pdfData ?? Data(), page: 1)
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

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator {
        var lastPage: Int = -1
    }

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.document = PDFDocument(data: data)
        scroll(to: page, in: view)
        context.coordinator.lastPage = page
        return view
    }

    func updateNSView(_ view: PDFView, context: Context) {
        guard context.coordinator.lastPage != page else { return }
        scroll(to: page, in: view)
        context.coordinator.lastPage = page
    }

    private func scroll(to pageNumber: Int, in view: PDFView) {
        guard let doc = view.document,
              let pdfPage = doc.page(at: max(0, pageNumber - 1)) else { return }
        view.go(to: pdfPage)
    }
}
#else
struct PDFKitView: UIViewRepresentable {
    let data: Data
    let page: Int

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator {
        var lastPage: Int = -1
    }

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.document = PDFDocument(data: data)
        scroll(to: page, in: view)
        context.coordinator.lastPage = page
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {
        guard context.coordinator.lastPage != page else { return }
        scroll(to: page, in: view)
        context.coordinator.lastPage = page
    }

    private func scroll(to pageNumber: Int, in view: PDFView) {
        guard let doc = view.document,
              let pdfPage = doc.page(at: max(0, pageNumber - 1)) else { return }
        view.go(to: pdfPage)
    }
}
#endif
