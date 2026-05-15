import Foundation
import CoreData
import SwiftUI

// MARK: - Revision Colors (standard screenplay paper colours)

enum RevisionColor: String, CaseIterable, Identifiable {
    case white     = "White"
    case blue      = "Blue"
    case pink      = "Pink"
    case yellow    = "Yellow"
    case green     = "Green"
    case goldenrod = "Goldenrod"
    case buff      = "Buff"
    case salmon    = "Salmon"
    case cherry    = "Cherry"

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .white:     return Color(red: 0.97, green: 0.97, blue: 0.95)
        case .blue:      return Color(red: 0.72, green: 0.84, blue: 0.93)
        case .pink:      return Color(red: 0.97, green: 0.71, blue: 0.78)
        case .yellow:    return Color(red: 0.99, green: 0.96, blue: 0.47)
        case .green:     return Color(red: 0.66, green: 0.87, blue: 0.66)
        case .goldenrod: return Color(red: 0.88, green: 0.74, blue: 0.25)
        case .buff:      return Color(red: 0.96, green: 0.88, blue: 0.63)
        case .salmon:    return Color(red: 0.98, green: 0.65, blue: 0.54)
        case .cherry:    return Color(red: 0.90, green: 0.33, blue: 0.44)
        }
    }

    var hex: String {
        switch self {
        case .white:     return "#F7F7F2"
        case .blue:      return "#B8D7ED"
        case .pink:      return "#F8B5C7"
        case .yellow:    return "#FCF577"
        case .green:     return "#A8DEA8"
        case .goldenrod: return "#E0BC40"
        case .buff:      return "#F5E0A0"
        case .salmon:    return "#FAA68A"
        case .cherry:    return "#E65470"
        }
    }
}

@objc(Script)
public class Script: ObservableManagedObject {

    @NSManaged public var version:    String
    @NSManaged public var filename:   String
    @NSManaged public var importedAt: Date
    @NSManaged public var pdfData:    Data?
    @NSManaged public var isParsing:  Bool
    @NSManaged public var colorHex:   String?
    @NSManaged public var episode:    Episode?

    /// Convenience — traverse up to the owning production.
    var production: Production? { episode?.production }

    @NSManaged private var _scenes: NSSet?

    // MARK: - Typed array

    var scenes: [ScriptScene] {
        Array((_scenes as? Set<ScriptScene>) ?? [])
    }

    // MARK: - Mutation helper

    func addScene(_ scene: ScriptScene) {
        mutableSetValue(forKey: "_scenes").add(scene)
        scene.script = self
    }

    // MARK: - Computed properties

    var sortedScenes: [ScriptScene] {
        scenes.sorted {
            SceneNumberSorter.value($0.sceneNumber) < SceneNumberSorter.value($1.sceneNumber)
        }
    }

    var completedCount: Int  { scenes.filter(\.isComplete).count }
    var totalCount: Int      { scenes.count }

    var completionPercentage: Double {
        guard totalCount > 0 else { return 0 }
        return Double(completedCount) / Double(totalCount)
    }

    var revisionColor: Color {
        guard let hex = colorHex,
              let match = RevisionColor.allCases.first(where: { $0.hex == hex })
        else { return RevisionColor.white.color }
        return match.color
    }

    // MARK: - Factory

    @discardableResult
    static func create(version: String, filename: String, pdfData: Data, in context: NSManagedObjectContext) -> Script {
        let s = Script(context: context)
        s.version    = version
        s.filename   = filename
        s.pdfData    = pdfData
        s.importedAt = Date()
        s.isParsing  = true
        return s
    }

    static func fetchRequest() -> NSFetchRequest<Script> {
        NSFetchRequest<Script>(entityName: "Script")
    }
}

// MARK: - Scene number sorter

enum SceneNumberSorter {
    static func value(_ s: String) -> Double {
        let digits  = s.prefix(while: { $0.isNumber || $0 == "." })
        let letters = s.drop(while: { $0.isNumber || $0 == "." })
        let base    = Double(digits) ?? 0
        let suffix  = letters.first.map { Double($0.asciiValue ?? 0) / 1000 } ?? 0
        return base + suffix
    }
}
