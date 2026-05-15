import SwiftUI
import CoreData

struct EpisodesSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.managedObjectContext) private var context

    @ObservedObject var production: Production
    @Binding var selectedEpisode: Episode?

    @State private var episodePendingDelete: Episode? = nil

    var namedEpisodes: [Episode] {
        production.episodes
            .filter { !$0.isDefault }
            .sorted { $0.number < $1.number }
    }

    var body: some View {
        VStack(spacing: 0) {
            // ── Header ────────────────────────────────────────────────────────
            HStack {
                Text("Episodes")
                    .font(.headline)
                Spacer()
                Button("Done") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
            .padding()

            Divider()

            // ── Episode list ──────────────────────────────────────────────────
            if namedEpisodes.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "film.stack")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No episodes yet")
                        .font(.headline)
                    Text("Add episodes below.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(namedEpisodes, id: \.objectID) { episode in
                            EpisodeRow(
                                episode: episode,
                                isSelected: selectedEpisode?.objectID == episode.objectID
                            ) {
                                selectedEpisode = episode
                                dismiss()
                            } onDelete: {
                                episodePendingDelete = episode
                            }
                            Divider().padding(.leading, 16)
                        }
                    }
                }
            }

            Divider()

            // ── Add actions ───────────────────────────────────────────────────
            HStack(spacing: 12) {
                Button(action: { addEpisodes(count: 1) }) {
                    Label("Add Episode", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)

                Button(action: { addEpisodes(count: 5) }) {
                    Label("Add 5 Episodes", systemImage: "plus.square.on.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
            }
            .padding()
        }
        .frame(minWidth: 380, minHeight: 420)
        .alert(item: $episodePendingDelete) { episode in
            let sceneCount = episode.scripts.flatMap { $0.scenes }.count
            if sceneCount > 0 {
                return Alert(
                    title: Text("Delete \(episode.name)?"),
                    message: Text("This episode has \(sceneCount) scene\(sceneCount == 1 ? "" : "s") and all associated data will be permanently deleted."),
                    primaryButton: .destructive(Text("Delete")) { deleteEpisode(episode) },
                    secondaryButton: .cancel()
                )
            } else {
                return Alert(
                    title: Text("Delete \(episode.name)?"),
                    message: Text("This episode has no script. It will be permanently deleted."),
                    primaryButton: .destructive(Text("Delete")) { deleteEpisode(episode) },
                    secondaryButton: .cancel()
                )
            }
        }
    }

    private func deleteEpisode(_ episode: Episode) {
        if selectedEpisode?.objectID == episode.objectID {
            selectedEpisode = namedEpisodes.first(where: { $0.objectID != episode.objectID })
        }
        context.delete(episode)
        PersistenceController.shared.save()
    }

    private func addEpisodes(count: Int) {
        let nextNumber = (namedEpisodes.last?.number ?? 0) + 1
        for i in 0..<count {
            let n = nextNumber + Int32(i)
            let ep = Episode.create(name: "Episode \(n)", number: n, in: context)
            production.addEpisode(ep)
        }
        PersistenceController.shared.save()
    }
}

// MARK: - Row

private struct EpisodeRow: View {
    let episode: Episode
    let isSelected: Bool
    let onTap: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(episode.name)
                            .font(.headline)
                            .foregroundStyle(Color.primary)
                        if let script = episode.latestScript {
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

            Button(action: onDelete) {
                Image(systemName: "trash")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.secondary)
            }
            .buttonStyle(.plain)
            .padding(.trailing, 16)
            .help("Delete episode")
        }
    }
}
