import Foundation
import CoreData

@objc(BreakdownSheet)
public class BreakdownSheet: ObservableManagedObject {

    @NSManaged public var synopsis:   String
    @NSManaged public var notes:      String
    @NSManaged public var isReviewed: Bool
    @NSManaged public var scene:      ScriptScene?
    @NSManaged private var _sceneElements: NSSet?

    // MARK: - Typed array

    var sceneElements: [SceneElement] {
        Array((_sceneElements as? Set<SceneElement>) ?? [])
    }

    // MARK: - Mutation helper

    func addSceneElement(_ se: SceneElement) {
        mutableSetValue(forKey: "_sceneElements").add(se)
        se.breakdownSheet = self
    }

    func removeSceneElement(_ se: SceneElement) {
        mutableSetValue(forKey: "_sceneElements").remove(se)
    }

    // MARK: - Computed helpers

    func elements(for category: ElementCategory) -> [SceneElement] {
        sceneElements
            .filter { $0.element?.category == category }
            .sorted { ($0.element?.name ?? "") < ($1.element?.name ?? "") }
    }

    var categoriesInUse: [ElementCategory] {
        let used = Set(sceneElements.compactMap { $0.element?.category })
        return ElementCategory.allCases.filter { used.contains($0) }
    }

    static func fetchRequest() -> NSFetchRequest<BreakdownSheet> {
        NSFetchRequest<BreakdownSheet>(entityName: "BreakdownSheet")
    }
}
