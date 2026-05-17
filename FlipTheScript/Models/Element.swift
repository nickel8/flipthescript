import Foundation
import CoreData
import SwiftUI

// MARK: - ElementCategory

enum ElementCategory: String, Codable, CaseIterable, Identifiable {
    case characters  = "Characters"
    case props       = "Props"
    case setDressing = "Set Dressing"
    case vehicles    = "Vehicles"
    case weapons     = "Weapons"
    case greens      = "Greens"
    case sfx         = "SFX"
    case vfx         = "VFX"
    case costume     = "Costume"
    case clearance   = "Clearance"
    case other       = "Other"

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .characters:  return Color(red: 0.56, green: 0.35, blue: 0.90)
        case .props:       return Color(red: 0.95, green: 0.50, blue: 0.10)
        case .setDressing: return Color(red: 0.20, green: 0.50, blue: 0.90)
        case .vehicles:    return Color(red: 0.10, green: 0.65, blue: 0.70)
        case .weapons:     return Color(red: 0.88, green: 0.20, blue: 0.20)
        case .greens:      return Color(red: 0.18, green: 0.72, blue: 0.28)
        case .sfx:         return Color(red: 0.88, green: 0.72, blue: 0.10)
        case .vfx:         return Color(red: 0.20, green: 0.60, blue: 0.95)
        case .costume:     return Color(red: 0.90, green: 0.38, blue: 0.58)
        case .clearance:   return Color(red: 0.85, green: 0.30, blue: 0.10)
        case .other:       return Color(red: 0.55, green: 0.55, blue: 0.58)
        }
    }

    var icon: String {
        switch self {
        case .characters:  return "person.fill"
        case .props:       return "cube.box.fill"
        case .setDressing: return "house.fill"
        case .vehicles:    return "car.fill"
        case .weapons:     return "target"
        case .greens:      return "leaf.fill"
        case .sfx:         return "wand.and.stars"
        case .vfx:         return "sparkles"
        case .costume:     return "tshirt.fill"
        case .clearance:   return "checkmark.shield.fill"
        case .other:       return "ellipsis.circle.fill"
        }
    }
}

// MARK: - Element

@objc(Element)
public class Element: ObservableManagedObject {

    @NSManaged public var cloudID:    UUID?
    @NSManaged public var name:       String
    @NSManaged private var categoryRaw: String
    @NSManaged public var notes:      String
    @NSManaged public var production: Production?
    @NSManaged private var _sceneElements: NSSet?

    // MARK: - Enum wrapper

    var category: ElementCategory {
        get { ElementCategory(rawValue: categoryRaw) ?? .other }
        set { categoryRaw = newValue.rawValue }
    }

    // MARK: - Typed array

    var sceneElements: [SceneElement] {
        Array((_sceneElements as? Set<SceneElement>) ?? [])
    }

    // MARK: - Factory

    @discardableResult
    static func create(
        name: String,
        category: ElementCategory,
        in context: NSManagedObjectContext
    ) -> Element {
        let e = Element(context: context)
        e.name     = name
        e.category = category
        e.notes    = ""
        e.cloudID  = UUID()
        return e
    }

    static func fetchRequest() -> NSFetchRequest<Element> {
        NSFetchRequest<Element>(entityName: "Element")
    }
}
