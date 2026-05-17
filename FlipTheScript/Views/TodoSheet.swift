import SwiftUI

struct TodoSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.managedObjectContext) private var context

    @ObservedObject var production: Production

    @State private var newTitle = ""
    @FocusState private var fieldFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // ── Header ────────────────────────────────────────────────────────
            HStack {
                Text("To do")
                    .font(.headline)
                Spacer()
                Button("Done") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
            .padding()

            Divider()

            // ── List ──────────────────────────────────────────────────────────
            if production.todoItems.isEmpty && newTitle.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("Nothing to do yet")
                        .font(.headline)
                    Text("Add a task below.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(production.todoItems, id: \.objectID) { item in
                            TodoRow(item: item)
                                .environment(\.managedObjectContext, context)
                            Divider().padding(.leading, 40)
                        }
                        .onDelete { indexSet in
                            for i in indexSet {
                                let item = production.todoItems[i]
                                TodoSyncService.shared.delete(item, context: context)
                            }
                        }
                    }
                }
            }

            Divider()

            // ── Add task ──────────────────────────────────────────────────────
            HStack(spacing: 10) {
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(Color.accentColor)
                    .font(.title3)
                TextField("New task…", text: $newTitle)
                    .focused($fieldFocused)
                    .onSubmit { addItem() }
                if !newTitle.isEmpty {
                    Button("Add", action: addItem)
                        .keyboardShortcut(.defaultAction)
                }
            }
            .padding()
        }
        .frame(minWidth: 360, minHeight: 400)
        .task { TodoSyncService.shared.pull(production: production, context: context) }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            TodoSyncService.shared.pull(production: production, context: context)
        }
    }

    private func addItem() {
        let trimmed = newTitle.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        let item = TodoItem.create(title: trimmed, in: context)
        production.addTodoItem(item)
        PersistenceController.shared.save()
        TodoSyncService.shared.push(item)
        newTitle = ""
        fieldFocused = true
    }
}

// MARK: - Row

private struct TodoRow: View {
    @Environment(\.managedObjectContext) private var context
    @ObservedObject var item: TodoItem

    var body: some View {
        Button {
            item.isDone.toggle()
            PersistenceController.shared.save()
            TodoSyncService.shared.toggle(item)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(item.isDone ? Color.accentColor : Color.secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .foregroundStyle(item.isDone ? Color.secondary : Color.primary)
                        .strikethrough(item.isDone)
                    if let scene = item.scene {
                        Text("Sc. \(scene.sceneNumber) · \(scene.location)")
                            .font(.caption)
                            .foregroundStyle(Color.secondary.opacity(0.7))
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: item.isDone)
    }
}
