import SwiftUI

struct ChangeProductionSheet: View {
    @Environment(\.dismiss) private var dismiss

    let productions: [Production]
    @Binding var selectedProduction: Production?
    var onNewProduction: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // ── Header ────────────────────────────────────────────────────────
            HStack {
                Text("Switch Production")
                    .font(.headline)
                Spacer()
                Button("Done") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
            .padding()

            Divider()

            // ── Production list ───────────────────────────────────────────────
            if productions.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "film")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No productions yet")
                        .font(.headline)
                    Text("Create your first production below.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(productions, id: \.objectID) { production in
                            ProductionPickerRow(
                                production: production,
                                isSelected: selectedProduction?.objectID == production.objectID
                            ) {
                                selectedProduction = production
                                dismiss()
                            }
                            Divider().padding(.leading, 16)
                        }
                    }
                }
            }

            Divider()

            // ── New production ────────────────────────────────────────────────
            Button(action: onNewProduction) {
                Label("New production", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .padding()
        }
        .frame(minWidth: 380, minHeight: 420)
    }
}

// MARK: - Row

private struct ProductionPickerRow: View {
    let production: Production
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(production.name)
                        .font(.headline)
                        .foregroundStyle(Color.primary)
                    if let script = production.latestScript {
                        Text(script.version)
                            .font(.caption)
                            .foregroundStyle(Color.secondary)
                    } else {
                        Text("No script imported")
                            .font(.caption)
                            .foregroundStyle(Color.secondary.opacity(0.6))
                    }
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.accentColor)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
