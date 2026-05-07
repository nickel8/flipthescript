import Foundation
import CoreData

struct DiffSummary {
    let unchanged: Int
    let modified:  Int
    let added:     Int
    let deleted:   Int

    var hasChanges: Bool { modified > 0 || added > 0 || deleted > 0 }

    var description: String {
        var parts: [String] = []
        if unchanged > 0 { parts.append("\(unchanged) unchanged") }
        if modified  > 0 { parts.append("\(modified) revised") }
        if added     > 0 { parts.append("\(added) new") }
        if deleted   > 0 { parts.append("\(deleted) removed") }
        return parts.joined(separator: " · ")
    }
}

enum ScriptDiffer {

    @MainActor
    static func diff(
        newScenes: [ScriptScene],
        against previousScript: Script,
        context: NSManagedObjectContext
    ) -> DiffSummary {
        let oldScenes  = Dictionary(
            uniqueKeysWithValues: previousScript.scenes.map { ($0.sceneNumber, $0) }
        )
        let newNumbers = Set(newScenes.map(\.sceneNumber))

        var unchanged = 0, modified = 0, added = 0, deleted = 0

        for newScene in newScenes {
            if let oldScene = oldScenes[newScene.sceneNumber] {
                let textChanged = normalise(oldScene.rawText) != normalise(newScene.rawText)
                newScene.revisionStatus = textChanged ? .modified : .unchanged
                if textChanged { modified += 1 } else { unchanged += 1 }
                copyBreakdown(from: oldScene, to: newScene, context: context)
            } else {
                newScene.revisionStatus = .added
                added += 1
            }
        }

        for oldNumber in oldScenes.keys where !newNumbers.contains(oldNumber) {
            deleted += 1
        }

        return DiffSummary(unchanged: unchanged, modified: modified, added: added, deleted: deleted)
    }

    private static func copyBreakdown(from old: ScriptScene, to new: ScriptScene, context: NSManagedObjectContext) {
        guard let oldSheet = old.breakdownSheet else { return }
        let newSheet       = BreakdownSheet(context: context)
        newSheet.synopsis  = oldSheet.synopsis
        newSheet.isReviewed = new.revisionStatus == .unchanged

        for oldSE in oldSheet.sceneElements {
            guard let element = oldSE.element else { continue }
            let newSE  = SceneElement.create(element: element, breakdownSheet: newSheet, in: context)
            newSE.notes = oldSE.notes
            newSheet.addSceneElement(newSE)
        }

        new.breakdownSheet = newSheet
    }

    private static func normalise(_ text: String) -> String {
        text.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "*", with: "") }
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
    }
}
