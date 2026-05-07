import Foundation
import CoreData

// MARK: - ChangeType (unchanged)

enum ChangeType: String, Codable, CaseIterable {
    case newDraft       = "New Draft"
    case scenesRevised  = "Scenes Revised"
    case breakdownSaved = "Breakdown Saved"
    case teamUpdate     = "Team Update"
    case note           = "Note"

    var systemImage: String {
        switch self {
        case .newDraft:       return "doc.badge.plus"
        case .scenesRevised:  return "asterisk"
        case .breakdownSaved: return "checkmark.circle"
        case .teamUpdate:     return "person.2"
        case .note:           return "text.bubble"
        }
    }

    var isHighPriority: Bool {
        self == .newDraft || self == .scenesRevised
    }
}

// MARK: - ChangeEntry

@objc(ChangeEntry)
public class ChangeEntry: ObservableManagedObject {

    @NSManaged public var summary:               String
    @NSManaged public var authorName:            String
    @NSManaged public var createdAt:             Date
    @NSManaged public var emailDispatched:       Bool
    @NSManaged public var production:            Production?
    @NSManaged private var typeRaw:              String
    /// Comma-separated scene numbers e.g. "1,2A,4"
    @NSManaged private var affectedSceneNumbersRaw: String

    // MARK: - Enum wrapper

    var type: ChangeType {
        get { ChangeType(rawValue: typeRaw) ?? .note }
        set { typeRaw = newValue.rawValue }
    }

    // MARK: - Scene numbers

    var affectedSceneNumbers: [String] {
        get {
            affectedSceneNumbersRaw.isEmpty
                ? []
                : affectedSceneNumbersRaw.components(separatedBy: ",")
        }
        set {
            affectedSceneNumbersRaw = newValue.joined(separator: ",")
        }
    }

    var affectedScenesDescription: String {
        guard !affectedSceneNumbers.isEmpty else { return "All scenes" }
        let sorted = affectedSceneNumbers.sorted {
            SceneNumberSorter.value($0) < SceneNumberSorter.value($1)
        }
        if sorted.count <= 4 {
            return "Scenes \(sorted.joined(separator: ", "))"
        }
        return "Scenes \(sorted.prefix(3).joined(separator: ", ")) + \(sorted.count - 3) more"
    }

    // MARK: - Factory

    @discardableResult
    static func create(
        type: ChangeType,
        summary: String,
        affectedSceneNumbers: [String] = [],
        authorName: String,
        in context: NSManagedObjectContext
    ) -> ChangeEntry {
        let e = ChangeEntry(context: context)
        e.type                 = type
        e.summary              = summary
        e.affectedSceneNumbers = affectedSceneNumbers
        e.authorName           = authorName
        e.createdAt            = Date()
        e.emailDispatched      = false
        return e
    }

    static func fetchRequest() -> NSFetchRequest<ChangeEntry> {
        NSFetchRequest<ChangeEntry>(entityName: "ChangeEntry")
    }
}
