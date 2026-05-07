import Foundation
import CoreData

@objc(Production)
public class Production: ObservableManagedObject {

    @NSManaged public var name: String
    @NSManaged public var createdAt: Date
    @NSManaged private var shareEmailsJSON: String?
    @NSManaged private var adminEmailsJSON: String?

    /// Read-only team members who receive magic links to the web viewer.
    var shareEmails: [String] {
        get {
            guard let json = shareEmailsJSON,
                  let emails = try? JSONDecoder().decode([String].self, from: Data(json.utf8))
            else { return [] }
            return emails
        }
        set {
            shareEmailsJSON = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? "[]"
        }
    }

    /// Co-editors with full Mac app access (job share / sync coming with CloudKit).
    var adminEmails: [String] {
        get {
            guard let json = adminEmailsJSON,
                  let emails = try? JSONDecoder().decode([String].self, from: Data(json.utf8))
            else { return [] }
            return emails
        }
        set {
            adminEmailsJSON = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? "[]"
        }
    }

    // Raw relationship storage (names must match the model relationship names)
    @NSManaged private var _scripts:    NSSet?
    @NSManaged private var _elements:   NSSet?
    @NSManaged private var _team:       NSSet?
    @NSManaged private var _changeLog:  NSSet?

    // MARK: - Typed arrays

    var scripts: [Script] {
        Array((_scripts as? Set<Script>) ?? [])
    }

    var elements: [Element] {
        Array((_elements as? Set<Element>) ?? [])
    }

    var team: [TeamMember] {
        Array((_team as? Set<TeamMember>) ?? [])
    }

    var changeLog: [ChangeEntry] {
        Array((_changeLog as? Set<ChangeEntry>) ?? [])
    }

    // MARK: - Mutation helpers

    func addScript(_ script: Script) {
        mutableSetValue(forKey: "_scripts").add(script)
        script.production = self
    }

    func addElement(_ element: Element) {
        mutableSetValue(forKey: "_elements").add(element)
        element.production = self
    }

    func removeElement(_ element: Element) {
        mutableSetValue(forKey: "_elements").remove(element)
        element.production = nil
    }

    func addTeamMember(_ member: TeamMember) {
        mutableSetValue(forKey: "_team").add(member)
        member.production = self
    }

    func addChangeEntry(_ entry: ChangeEntry) {
        mutableSetValue(forKey: "_changeLog").add(entry)
        entry.production = self
    }

    func removeTeamMember(_ member: TeamMember) {
        mutableSetValue(forKey: "_team").remove(member)
    }

    // MARK: - Computed properties

    var latestScript: Script? {
        scripts.max(by: { $0.importedAt < $1.importedAt })
    }

    var sortedElements: [Element] {
        elements.sorted {
            if $0.category.rawValue != $1.category.rawValue {
                return $0.category.rawValue < $1.category.rawValue
            }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    var sortedChangeLog: [ChangeEntry] {
        changeLog.sorted { $0.createdAt > $1.createdAt }
    }

    var pendingEmailNotifications: [ChangeEntry] {
        changeLog.filter { !$0.emailDispatched && $0.type.isHighPriority }
    }

    // MARK: - Factory

    @discardableResult
    static func create(name: String, in context: NSManagedObjectContext) -> Production {
        let p = Production(context: context)
        p.name = name
        p.createdAt = Date()
        return p
    }

    static func fetchRequest() -> NSFetchRequest<Production> {
        NSFetchRequest<Production>(entityName: "Production")
    }
}
