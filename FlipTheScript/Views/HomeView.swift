import SwiftUI

struct HomeView: View {
    var selectedProduction: Production?   // kept for nil check / header
    var selectedEpisode: Episode?
    var onNewScript: () -> Void
    var onNewAmendments: () -> Void
    var onViewBreakdown: () -> Void
    var onChangeProduction: () -> Void
    var onChangeEpisode: () -> Void = {}
    var onImportSchedule: () -> Void = {}
    var onEpisodesEnabled: (Episode) -> Void = { _ in }

    @State private var showingTodo = false

    private var hasScript: Bool {
        if let ep = selectedEpisode { return ep.latestScript != nil }
        return selectedProduction?.latestScript != nil
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 36) {

                // ── Header ────────────────────────────────────────────────────
                VStack(alignment: .leading, spacing: 6) {
                    Text("Flip the Script")
                        .font(.largeTitle.weight(.bold))
                    if let name = selectedProduction?.name {
                        HStack(spacing: 8) {
                            Text(name)
                                .font(.title2)
                                .foregroundStyle(.secondary)
                            if let ep = selectedEpisode {
                                Text("·")
                                    .foregroundStyle(.tertiary)
                                Text(ep.name)
                                    .font(.title2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if selectedProduction == nil {
                    // ── No production yet ─────────────────────────────────────
                    VStack(spacing: 16) {
                        Image(systemName: "film")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("No production selected")
                            .font(.title3.weight(.medium))
                        Text("Create a production to get started.")
                            .foregroundStyle(.secondary)
                        Button(action: onChangeProduction) {
                            Label("Create production", systemImage: "plus")
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)

                } else {
                    // ── Production tiles ──────────────────────────────────────
                    LazyVGrid(
                        columns: [GridItem(.flexible()), GridItem(.flexible())],
                        spacing: 14
                    ) {
                        HomeTile(
                            icon: "arrow.down.doc.fill",
                            title: "New script",
                            subtitle: hasScript ? "Use New amendments to update" : "Import a new draft PDF",
                            color: .blue,
                            isEnabled: !hasScript,
                            disabledHint: "A script already exists — use New amendments",
                            action: onNewScript
                        )
                        HomeTile(
                            icon: "highlighter",
                            title: "New amendments",
                            // "Pink pages" — revised script pages printed on coloured paper
                            subtitle: "Upload revised pages to see what changed",
                            color: Color(red: 0.9, green: 0.2, blue: 0.4),
                            isEnabled: hasScript,
                            disabledHint: "Import a script first",
                            action: onNewAmendments
                        )
                        HomeTile(
                            icon: "list.bullet.clipboard.fill",
                            title: "View breakdown",
                            subtitle: "Jump to the first scene that needs work",
                            color: .orange,
                            isEnabled: hasScript,
                            disabledHint: "Import a script first",
                            action: onViewBreakdown
                        )
                        if let production = selectedProduction {
                            EpisodesTile(
                                production: production,
                                selectedEpisode: selectedEpisode,
                                onChangeEpisode: onChangeEpisode
                            )
                        }
                        HomeTile(
                            icon: "calendar.badge.clock",
                            title: "Import schedule",
                            subtitle: "Map shoot days to scenes",
                            color: .teal,
                            isEnabled: hasScript,
                            disabledHint: "Import a script first",
                            action: onImportSchedule
                        )
                        HomeTile(
                            icon: "checkmark.circle.fill",
                            title: "To do list",
                            subtitle: {
                                let items = selectedProduction?.todoItems ?? []
                                let done = items.filter(\.isDone).count
                                return items.isEmpty ? "Nothing to do" : "\(done)/\(items.count) done"
                            }(),
                            color: .green,
                            isEnabled: true,
                            action: { showingTodo = true }
                        )
                        HomeTile(
                            icon: "arrow.triangle.2.circlepath",
                            title: "Change production",
                            subtitle: "Switch to a different project",
                            color: .secondary,
                            isEnabled: true,
                            action: onChangeProduction
                        )
                    }

                    // ── Production settings ───────────────────────────────────
                    if let production = selectedProduction {
                        Divider()
                        HasEpisodesToggle(production: production, onEpisodesEnabled: onEpisodesEnabled)
                            .padding(.top, 4)
                    }
                }
            }
            .padding(40)
            .frame(maxWidth: 760)
            .sheet(isPresented: $showingTodo) {
                if let production = selectedProduction {
                    TodoSheet(production: production)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Production-reactive sub-views

private struct EpisodesTile: View {
    @ObservedObject var production: Production
    let selectedEpisode: Episode?
    let onChangeEpisode: () -> Void

    var body: some View {
        if production.hasEpisodes {
            HomeTile(
                icon: "film.stack",
                title: selectedEpisode?.name ?? "Episodes",
                subtitle: selectedEpisode != nil
                    ? "Tap to switch episode"
                    : "\(production.episodes.filter { !$0.isDefault }.count) episode(s)",
                color: .purple,
                isEnabled: true,
                action: onChangeEpisode
            )
        }
    }
}

private struct HasEpisodesToggle: View {
    @ObservedObject var production: Production
    @Environment(\.managedObjectContext) private var context
    var onEpisodesEnabled: (Episode) -> Void = { _ in }

    var body: some View {
        Toggle("This production has episodes", isOn: Binding(
            get: { production.hasEpisodes },
            set: { newValue in
                production.hasEpisodes = newValue
                if newValue { migrateExistingScriptsIfNeeded() }
                PersistenceController.shared.save()
            }
        ))
    }

    /// If scripts were imported before episodes were enabled, move them into a
    /// new Episode 1 so they remain accessible via the episode picker.
    private func migrateExistingScriptsIfNeeded() {
        guard let defaultEp = production.defaultEpisode,
              !defaultEp.scripts.isEmpty else { return }
        let ep1 = Episode.create(name: "Episode 1", number: 1, in: context)
        production.addEpisode(ep1)
        for script in defaultEp.scripts {
            ep1.addScript(script)
        }
        onEpisodesEnabled(ep1)
    }
}

// MARK: - Tile

struct HomeTile: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    let isEnabled: Bool
    var disabledHint: String? = nil
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                Image(systemName: icon)
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(isEnabled ? color : Color.secondary.opacity(0.4))
                    .padding(.bottom, 16)

                Text(title)
                    .font(.headline)
                    .foregroundStyle(isEnabled ? .primary : .secondary)
                    .padding(.bottom, 4)

                Text(isEnabled ? subtitle : (disabledHint ?? subtitle))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 148, alignment: .leading)
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(nsColor: .windowBackgroundColor))
                    .shadow(
                        color: .black.opacity(isHovered && isEnabled ? 0.09 : 0.04),
                        radius: isHovered && isEnabled ? 10 : 4,
                        y: 2
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        isHovered && isEnabled
                            ? Color.accentColor.opacity(0.45)
                            : Color(nsColor: .separatorColor),
                        lineWidth: isHovered && isEnabled ? 1.5 : 0.5
                    )
            )
            .opacity(isEnabled ? 1.0 : 0.45)
            .scaleEffect(isHovered && isEnabled ? 1.015 : 1.0)
            .animation(.easeOut(duration: 0.12), value: isHovered)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onHover { isHovered = $0 }
    }
}
