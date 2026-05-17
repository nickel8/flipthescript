import Foundation
import CoreData

@objc(Production)
public class Production: ObservableManagedObject {

    @NSManaged public var name: String
    @NSManaged public var createdAt: Date
    @NSManaged public var hasEpisodes: Bool
    @NSManaged public var cloudID: UUID?
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

    // Raw relationship storage
    @NSManaged private var _episodes:   NSSet?
    @NSManaged private var _elements:   NSSet?
    @NSManaged private var _team:       NSSet?
    @NSManaged private var _changeLog:  NSSet?
    @NSManaged private var _todoItems:  NSSet?

    // MARK: - Typed arrays

    var episodes: [Episode] {
        Array((_episodes as? Set<Episode>) ?? [])
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

    var todoItems: [TodoItem] {
        Array((_todoItems as? Set<TodoItem>) ?? [])
            .sorted { $0.createdAt < $1.createdAt }
    }

    // MARK: - Script convenience (flattens across all episodes)

    var scripts: [Script] {
        episodes.flatMap { $0.scripts }
    }

    /// The episode that owns scripts for a production without episode structure.
    var defaultEpisode: Episode? {
        episodes.first(where: { $0.isDefault }) ?? episodes.first
    }

    // MARK: - Mutation helpers

    func addEpisode(_ episode: Episode) {
        mutableSetValue(forKey: "_episodes").add(episode)
        episode.production = self
    }

    /// Convenience: add a script to the default episode.
    func addScript(_ script: Script) {
        guard let ep = defaultEpisode else { return }
        ep.addScript(script)
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

    func addTodoItem(_ item: TodoItem) {
        mutableSetValue(forKey: "_todoItems").add(item)
        item.production = self
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
        p.name        = name
        p.createdAt   = Date()
        p.hasEpisodes = false
        p.cloudID     = UUID()
        // Every production gets a default episode so scripts always have a home
        let defaultEp = Episode.create(name: "Default", number: 0, isDefault: true, in: context)
        p.addEpisode(defaultEp)
        return p
    }

    static func fetchRequest() -> NSFetchRequest<Production> {
        NSFetchRequest<Production>(entityName: "Production")
    }
}
