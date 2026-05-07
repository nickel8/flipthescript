import Foundation
import CoreData

// MARK: - Revision Status

enum RevisionStatus: String, Codable {
    case unchanged = "Unchanged"
    case modified  = "Modified"
    case added     = "Added"
}

// MARK: - ScriptScene

@objc(ScriptScene)
public class ScriptScene: ObservableManagedObject {

    @NSManaged public var sceneNumber:    String
    @NSManaged public var slugLine:       String
    @NSManaged public var intExt:         String
    @NSManaged public var location:       String
    @NSManaged public var timeOfDay:      String
    @NSManaged public var pageStart:      Int32
    @NSManaged public var rawText:        String
    @NSManaged private var revisionStatusRaw: String
    @NSManaged public var script:         Script?
    @NSManaged public var breakdownSheet: BreakdownSheet?

    // MARK: - Enum wrapper

    var revisionStatus: RevisionStatus {
        get { RevisionStatus(rawValue: revisionStatusRaw) ?? .unchanged }
        set { revisionStatusRaw = newValue.rawValue }
    }

    // MARK: - Computed properties

    var isComplete: Bool {
        guard let sheet = breakdownSheet else { return false }
        return !sheet.synopsis.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var displayTitle: String { "\(intExt). \(location)" }

    // MARK: - Factory

    @discardableResult
    static func create(
        sceneNumber: String,
        slugLine: String,
        intExt: String,
        location: String,
        timeOfDay: String,
        pageStart: Int,
        rawText: String,
        in context: NSManagedObjectContext
    ) -> ScriptScene {
        let s = ScriptScene(context: context)
        s.sceneNumber   = sceneNumber
        s.slugLine      = slugLine
        s.intExt        = intExt
        s.location      = location
        s.timeOfDay     = timeOfDay
        s.pageStart     = Int32(pageStart)
        s.rawText       = rawText
        s.revisionStatus = .unchanged
        return s
    }

    static func fetchRequest() -> NSFetchRequest<ScriptScene> {
        NSFetchRequest<ScriptScene>(entityName: "ScriptScene")
    }
}
