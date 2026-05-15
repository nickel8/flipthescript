import Foundation
import CoreData

@objc(Episode)
public class Episode: ObservableManagedObject {

    @NSManaged public var name: String
    @NSManaged public var number: Int32
    @NSManaged public var createdAt: Date
    @NSManaged public var isDefault: Bool
    @NSManaged public var production: Production?

    @NSManaged private var _scripts: NSSet?

    // MARK: - Typed array

    var scripts: [Script] {
        Array((_scripts as? Set<Script>) ?? [])
    }

    var latestScript: Script? {
        scripts.max(by: { $0.importedAt < $1.importedAt })
    }

    // MARK: - Mutation helper

    func addScript(_ script: Script) {
        mutableSetValue(forKey: "_scripts").add(script)
        script.episode = self
    }

    // MARK: - Factory

    @discardableResult
    static func create(name: String, number: Int32, isDefault: Bool = false, in context: NSManagedObjectContext) -> Episode {
        let e = Episode(context: context)
        e.name      = name
        e.number    = number
        e.createdAt = Date()
        e.isDefault = isDefault
        return e
    }

    static func fetchRequest() -> NSFetchRequest<Episode> {
        NSFetchRequest<Episode>(entityName: "Episode")
    }
}
