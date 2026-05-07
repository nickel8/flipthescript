import SwiftUI
import CoreData

struct ElementPickerView: View {
    @Environment(\.managedObjectContext) private var context

    @ObservedObject var production: Production
    @ObservedObject var breakdownSheet: BreakdownSheet
    var initialCategory: ElementCategory
    var onDone: () -> Void = {}

    @State private var selectedCategory: ElementCategory
    @State private var searchText = ""
    @State private var newElementName = ""
    @State private var showingNewField = false
    @State private var renamingElement: Element? = nil
    @State private var renameText = ""
    @FocusState private var newFieldFocused: Bool
    @FocusState private var renameFieldFocused: Bool

    init(production: Production, breakdownSheet: BreakdownSheet, initialCategory: ElementCategory, onDone: @escaping () -> Void = {}) {
        _production = ObservedObject(wrappedValue: production)
        _breakdownSheet = ObservedObject(wrappedValue: breakdownSheet)
        self.initialCategory = initialCategory
        self.onDone = onDone
        _selectedCategory = State(initialValue: initialCategory)
    }

    private var alreadyAdded: Set<NSManagedObjectID> {
        Set(breakdownSheet.sceneElements.compactMap { $0.element?.objectID })
    }

    private var filteredElements: [Element] {
        production.elements
            .filter { $0.category == selectedCategory }
            .filter { searchText.isEmpty || $0.name.localizedCaseInsensitiveContains(searchText) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        VStack(spacing: 0) {
                // Category selector
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(ElementCategory.allCases) { cat in
                            CategoryTab(
                                category: cat,
                                isSelected: selectedCategory == cat
                            ) {
                                selectedCategory = cat
                                showingNewField = false
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }
                .background(.bar)

                // Search field (inline — avoids NSToolbar duplicate-identifier crash
                // that occurs with .searchable inside a popover on macOS)
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search \(selectedCategory.rawValue.lowercased())…", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.textBackgroundColor).opacity(0.6))

                Divider()

                List {
                    ForEach(filteredElements) { element in
                        let added = alreadyAdded.contains(element.objectID)
                        if renamingElement?.objectID == element.objectID {
                            // Inline rename field
                            HStack {
                                TextField("Name", text: $renameText)
                                    .focused($renameFieldFocused)
                                    .onSubmit { commitRename() }
                                Button("Save") { commitRename() }
                                    .buttonStyle(.borderedProminent)
                                    .tint(selectedCategory.color)
                                    .controlSize(.small)
                                Button("Cancel") { renamingElement = nil }
                                    .buttonStyle(.plain)
                                    .foregroundStyle(.secondary)
                                    .controlSize(.small)
                            }
                        } else {
                            Button {
                                toggle(element: element)
                            } label: {
                                HStack {
                                    Text(element.name)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    if added {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(selectedCategory.color)
                                            .font(.body.weight(.semibold))
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button("Rename") {
                                    renamingElement = element
                                    renameText = element.name
                                    renameFieldFocused = true
                                }
                                Divider()
                                Button("Delete from Production", role: .destructive) {
                                    deleteElement(element)
                                }
                            }
                        }
                    }

                    // New element inline creation
                    if showingNewField {
                        HStack {
                            TextField("New \(selectedCategory.rawValue.lowercased()) name…", text: $newElementName)
                                .focused($newFieldFocused)
                                .onSubmit { createAndAdd() }
                            if !newElementName.isEmpty {
                                Button("Add", action: createAndAdd)
                                    .buttonStyle(.borderedProminent)
                                    .tint(selectedCategory.color)
                                    .controlSize(.small)
                            }
                        }
                    } else {
                        Button {
                            showingNewField = true
                            newFieldFocused = true
                        } label: {
                            Label(
                                "New \(selectedCategory.rawValue)…",
                                systemImage: "plus.circle.fill"
                            )
                            .foregroundStyle(selectedCategory.color)
                        }
                        .buttonStyle(.plain)
                    }
                }
        }
    }

    func commitPendingAndDone() {
        if showingNewField && !newElementName.isEmpty {
            createAndAdd()
        }
        onDone()
    }

    private func toggle(element: Element) {
        if alreadyAdded.contains(element.objectID) {
            if let se = breakdownSheet.sceneElements.first(where: { $0.element?.objectID == element.objectID }) {
                breakdownSheet.removeSceneElement(se)
                context.delete(se)
            }
        } else {
            let se = SceneElement.create(element: element, breakdownSheet: breakdownSheet, in: context)
            breakdownSheet.addSceneElement(se)
        }
        PersistenceController.shared.save()
    }

    private func commitRename() {
        guard let element = renamingElement else { return }
        let trimmed = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { renamingElement = nil; return }
        element.name = trimmed
        PersistenceController.shared.save()
        renamingElement = nil
    }

    private func deleteElement(_ element: Element) {
        // Remove from all scene elements first
        for se in element.sceneElements {
            se.breakdownSheet?.removeSceneElement(se)
            context.delete(se)
        }
        production.removeElement(element)
        context.delete(element)
        PersistenceController.shared.save()
    }

    private func createAndAdd() {
        let name = newElementName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }

        let element = Element.create(name: name, category: selectedCategory, in: context)
        production.addElement(element)

        let se = SceneElement.create(element: element, breakdownSheet: breakdownSheet, in: context)
        breakdownSheet.addSceneElement(se)

        newElementName = ""
        showingNewField = false
        PersistenceController.shared.save()
    }
}

// MARK: - Category Tab

struct CategoryTab: View {
    let category: ElementCategory
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: category.icon)
                    .font(.caption.weight(.semibold))
                Text(category.rawValue)
                    .font(.caption.weight(.semibold))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? category.color : category.color.opacity(0.1))
            .foregroundStyle(isSelected ? .white : category.color)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
