import Foundation
import CoreData

@objc(SceneElement)
public class SceneElement: ObservableManagedObject {

    @NSManaged public var cloudID:        UUID?
    @NSManaged public var notes:         String
    @NSManaged public var element:       Element?
    @NSManaged public var breakdownSheet: BreakdownSheet?

    // MARK: - Factory

    @discardableResult
    static func create(element: Element, breakdownSheet: BreakdownSheet, in context: NSManagedObjectContext) -> SceneElement {
        let se = SceneElement(context: context)
        se.element        = element
        se.breakdownSheet = breakdownSheet
        se.notes          = ""
        se.cloudID        = UUID()
        return se
    }

    static func fetchRequest() -> NSFetchRequest<SceneElement> {
        NSFetchRequest<SceneElement>(entityName: "SceneElement")
    }
}
