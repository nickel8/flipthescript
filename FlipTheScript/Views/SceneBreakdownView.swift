import SwiftUI
import CoreData

struct SceneBreakdownView: View {
    @Environment(\.managedObjectContext) private var context
    @ObservedObject var scene: ScriptScene

    private var sheet: BreakdownSheet {
        if let existing = scene.breakdownSheet { return existing }
        let new = BreakdownSheet(context: context)
        scene.breakdownSheet = new
        PersistenceController.shared.save()
        return new
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                sceneHeader
                Divider()
                BreakdownBody(sheet: sheet, scene: scene)
            }
        }
        .navigationTitle("Sc. \(scene.sceneNumber)")
        #if os(macOS)
        .navigationSubtitle(scene.slugLine)
        #endif
        .toolbar {
            if scene.revisionStatus == .modified {
                ToolbarItem(placement: .primaryAction) {
                    Button("Mark Reviewed") {
                        sheet.isReviewed = true
                        scene.revisionStatus = .unchanged
                        PersistenceController.shared.save()
                    }
                    .tint(.orange)
                }
            }
        }
    }

    // MARK: - Header

    private var sceneHeader: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text("Scene \(scene.sceneNumber)")
                        .font(.title2.weight(.bold))
                    revisionBadge
                }
                Text(scene.slugLine)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Page \(scene.pageStart)")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            Image(systemName: scene.isComplete ? "checkmark.circle.fill" : "circle")
                .font(.title2)
                .foregroundStyle(scene.isComplete ? .green : Color(.tertiaryLabelColor))
        }
        .padding(20)
    }

    @ViewBuilder
    private var revisionBadge: some View {
        switch scene.revisionStatus {
        case .modified:
            Label("Revised", systemImage: "asterisk")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.orange)
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background(Color.orange.opacity(0.12))
                .clipShape(Capsule())
        case .added:
            Label("New Scene", systemImage: "plus")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.green)
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background(Color.green.opacity(0.12))
                .clipShape(Capsule())
        case .unchanged:
            EmptyView()
        }
    }

}

// MARK: - Breakdown Body (observes the sheet so it re-renders when elements change)

private struct BreakdownBody: View {
    @ObservedObject var sheet: BreakdownSheet
    let scene: ScriptScene
    @Environment(\.managedObjectContext) private var context
    @State private var showingElementPicker = false
    @State private var pickerCategory: ElementCategory = .props

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            synopsisSection
            Divider()
            elementsSection
            Divider()
            notesSection
        }
        .popover(isPresented: $showingElementPicker) {
            if let production = scene.script?.production {
                ElementPickerView(
                    production: production,
                    breakdownSheet: sheet,
                    initialCategory: pickerCategory
                )
                .environment(\.managedObjectContext, context)
                .frame(minWidth: 400, minHeight: 500)
            }
        }
    }

    // MARK: - Synopsis

    private var synopsisSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Synopsis", systemImage: "text.alignleft")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            ZStack(alignment: .topLeading) {
                TextEditor(text: Binding(
                    get: { sheet.synopsis },
                    set: {
                        sheet.synopsis = $0
                        PersistenceController.shared.save()
                    }
                ))
                .font(.body)
                .frame(minHeight: 100)
                .scrollContentBackground(.hidden)
                .padding(10)
                .background(Color(.textBackgroundColor).opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.separatorColor), lineWidth: 0.5))

                if sheet.synopsis.isEmpty {
                    Text("Write a brief synopsis of what happens in this scene…")
                        .font(.body)
                        .foregroundStyle(.tertiary)
                        .padding(16)
                        .allowsHitTesting(false)
                }
            }
        }
        .padding(20)
    }

    // MARK: - Elements

    private var elementsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Label("Elements", systemImage: "tag")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Spacer()
                Menu {
                    ForEach(ElementCategory.allCases) { cat in
                        Button {
                            pickerCategory = cat
                            showingElementPicker = true
                        } label: {
                            Label(cat.rawValue, systemImage: cat.icon)
                        }
                    }
                } label: {
                    Label("Add Element", systemImage: "plus")
                        .font(.subheadline.weight(.medium))
                }
                .menuStyle(.borderlessButton)
            }

            if sheet.sceneElements.isEmpty {
                Text("No elements tagged yet. Use Add Element to tag props, set dressing, characters, and more.")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
                    .padding(.vertical, 8)
            } else {
                ForEach(sheet.categoriesInUse) { category in
                    categoryGroup(category)
                }
            }
        }
        .padding(20)
    }

    // MARK: - Notes

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Notes", systemImage: "note.text")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            ZStack(alignment: .topLeading) {
                TextEditor(text: Binding(
                    get: { sheet.notes },
                    set: {
                        sheet.notes = $0
                        PersistenceController.shared.save()
                    }
                ))
                .font(.body)
                .frame(minHeight: 80)
                .scrollContentBackground(.hidden)
                .padding(10)
                .background(Color(.textBackgroundColor).opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.separatorColor), lineWidth: 0.5))

                if sheet.notes.isEmpty {
                    Text("Brain dump, context notes, things to follow up…")
                        .font(.body)
                        .foregroundStyle(.tertiary)
                        .padding(16)
                        .allowsHitTesting(false)
                }
            }
        }
        .padding(20)
    }

    @ViewBuilder
    private func categoryGroup(_ category: ElementCategory) -> some View {
        let items = sheet.elements(for: category)
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: category.icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(category.color)
                    Text(category.rawValue)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(category.color)
                    Spacer()
                    Button {
                        pickerCategory = category
                        showingElementPicker = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
                FlowLayout(spacing: 6) {
                    ForEach(items) { sceneElement in
                        ElementChip(sceneElement: sceneElement) {
                            context.delete(sceneElement)
                            PersistenceController.shared.save()
                        }
                    }
                }
            }
            .padding(12)
            .background(category.color.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
}

// MARK: - Element Chip

struct ElementChip: View {
    let sceneElement: SceneElement
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(sceneElement.element?.name ?? "Unknown")
                .font(.subheadline)
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background((sceneElement.element?.category.color ?? .gray).opacity(0.15))
        .clipShape(Capsule())
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 { x = 0; y += rowH + spacing; rowH = 0 }
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
        return CGSize(width: width, height: y + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
    }
}
