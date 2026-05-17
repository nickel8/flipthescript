import Foundation
import CoreData

@objc(TodoItem)
public class TodoItem: ObservableManagedObject {

    @NSManaged public var title: String
    @NSManaged public var isDone: Bool
    @NSManaged public var createdAt: Date
    @NSManaged public var cloudID: UUID?
    @NSManaged public var production: Production?
    @NSManaged public var scene: ScriptScene?

    @discardableResult
    static func create(title: String, in context: NSManagedObjectContext) -> TodoItem {
        let t = TodoItem(context: context)
        t.title     = title
        t.isDone    = false
        t.createdAt = Date()
        return t
    }

    static func fetchRequest() -> NSFetchRequest<TodoItem> {
        NSFetchRequest<TodoItem>(entityName: "TodoItem")
    }
}
