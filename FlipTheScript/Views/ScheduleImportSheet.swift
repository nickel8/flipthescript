import SwiftUI
import Combine

struct ScheduleImportSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.managedObjectContext) private var context

    let entries: [ShootEntry]
    let script: Script

    // Pre-compute matches once
    private var matches: [(entry: ShootEntry, scene: ScriptScene?)] {
        entries.map { entry in
            let scene = script.scenes.first { $0.sceneNumber == entry.sceneNumber }
            return (entry, scene)
        }
    }

    private var matchedCount: Int  { matches.filter { $0.scene != nil }.count }
    private var missedCount: Int   { matches.filter { $0.scene == nil }.count }

    var body: some View {
        VStack(spacing: 0) {
            // ── Header ────────────────────────────────────────────────────────
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Schedule Preview")
                        .font(.headline)
                    Text("\(matchedCount) of \(entries.count) scenes matched")
                        .font(.caption)
                        .foregroundStyle(missedCount > 0 ? .orange : .secondary)
                }
                Spacer()
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Apply") { applySchedule(); dismiss() }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
                    .disabled(matchedCount == 0)
            }
            .padding()

            Divider()

            // ── Match list ────────────────────────────────────────────────────
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(matches.enumerated()), id: \.offset) { _, pair in
                        HStack(spacing: 12) {
                            // Shoot order badge
                            Text("\(pair.entry.shootOrder)")
                                .font(.caption.weight(.bold).monospacedDigit())
                                .foregroundStyle(.white)
                                .frame(width: 26, height: 26)
                                .background(pair.scene != nil ? Color.accentColor : Color.orange)
                                .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 6) {
                                    Text("Sc. \(pair.entry.sceneNumber)")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                    if let scene = pair.scene {
                                        Text(scene.slugLine)
                                            .font(.subheadline)
                                            .lineLimit(1)
                                    } else {
                                        Text("Scene \(pair.entry.sceneNumber) — not found in script")
                                            .font(.subheadline)
                                            .foregroundStyle(.orange)
                                    }
                                }
                                Text(pair.entry.shootDayLabel)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 9)
                        .contentShape(Rectangle())

                        Divider().padding(.leading, 54)
                    }

                    // Scenes in the script with no schedule entry
                    let unscheduled = script.sortedScenes.filter { scene in
                        !entries.contains { $0.sceneNumber == scene.sceneNumber }
                    }
                    if !unscheduled.isEmpty {
                        HStack {
                            Text("NOT IN SCHEDULE (\(unscheduled.count) scenes)")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color(.separatorColor).opacity(0.2))

                        ForEach(unscheduled, id: \.objectID) { scene in
                            HStack(spacing: 12) {
                                Image(systemName: "minus.circle")
                                    .foregroundStyle(Color.secondary.opacity(0.4))
                                    .frame(width: 26, height: 26)
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text("Sc. \(scene.sceneNumber)")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                        Text(scene.slugLine)
                                            .font(.subheadline)
                                            .lineLimit(1)
                                    }
                                    Text("No shoot day assigned")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 9)
                            Divider().padding(.leading, 54)
                        }
                    }
                }
            }
        }
        .frame(minWidth: 480, minHeight: 500)
    }

    private func applySchedule() {
        for pair in matches {
            guard let scene = pair.scene else { continue }
            scene.objectWillChange.send()
            scene.shootDay   = Int32(pair.entry.shootDay)
            scene.shootOrder = Int32(pair.entry.shootOrder)
        }
        PersistenceController.shared.save()
    }
}
