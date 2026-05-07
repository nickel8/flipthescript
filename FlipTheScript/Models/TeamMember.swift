import Foundation
import CoreData

// MARK: - Enums (unchanged)

enum TeamRole: String, Codable, CaseIterable, Identifiable {
    case owner   = "Owner"
    case editor  = "Editor"
    case viewer  = "Viewer"

    var id: String { rawValue }

    var description: String {
        switch self {
        case .owner:  return "Can edit and manage the team"
        case .editor: return "Can edit breakdowns"
        case .viewer: return "Read-only access"
        }
    }

    var systemImage: String {
        switch self {
        case .owner:  return "crown.fill"
        case .editor: return "pencil"
        case .viewer: return "eye.fill"
        }
    }
}

enum Department: String, Codable, CaseIterable, Identifiable {
    case artDirection = "Art Direction"
    case props        = "Props"
    case setDressing  = "Set Dressing"
    case buying       = "Buying"
    case greens       = "Greens"
    case sfx          = "SFX"
    case costume      = "Costume"
    case other        = "Other"

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .artDirection: return "paintbrush.fill"
        case .props:        return "cube.box.fill"
        case .setDressing:  return "house.fill"
        case .buying:       return "bag.fill"
        case .greens:       return "leaf.fill"
        case .sfx:          return "wand.and.stars"
        case .costume:      return "tshirt.fill"
        case .other:        return "person.fill"
        }
    }

    var primaryCategories: [ElementCategory] {
        switch self {
        case .artDirection: return ElementCategory.allCases
        case .props:        return [.props, .weapons]
        case .setDressing:  return [.setDressing, .greens]
        case .buying:       return [.props, .setDressing, .costume]
        case .greens:       return [.greens]
        case .sfx:          return [.sfx]
        case .costume:      return [.costume]
        case .other:        return ElementCategory.allCases
        }
    }
}

// MARK: - TeamMember

@objc(TeamMember)
public class TeamMember: ObservableManagedObject {

    @NSManaged public var name:           String
    @NSManaged public var email:          String
    @NSManaged private var roleRaw:       String
    @NSManaged private var departmentRaw: String
    @NSManaged public var cloudKitUserID: String?
    @NSManaged public var notifyByPush:   Bool
    @NSManaged public var notifyByEmail:  Bool
    @NSManaged public var addedAt:        Date
    @NSManaged public var production:     Production?

    // MARK: - Enum wrappers

    var role: TeamRole {
        get { TeamRole(rawValue: roleRaw) ?? .viewer }
        set { roleRaw = newValue.rawValue }
    }

    var department: Department {
        get { Department(rawValue: departmentRaw) ?? .other }
        set { departmentRaw = newValue.rawValue }
    }

    // MARK: - Computed

    var initials: String {
        let parts   = name.split(separator: " ")
        let letters = parts.prefix(2).compactMap { $0.first }
        return String(letters).uppercased()
    }

    // MARK: - Factory

    @discardableResult
    static func create(
        name: String,
        email: String,
        role: TeamRole,
        department: Department,
        notifyByPush: Bool = true,
        notifyByEmail: Bool = false,
        in context: NSManagedObjectContext
    ) -> TeamMember {
        let m = TeamMember(context: context)
        m.name          = name
        m.email         = email
        m.role          = role
        m.department    = department
        m.notifyByPush  = notifyByPush
        m.notifyByEmail = notifyByEmail
        m.addedAt       = Date()
        return m
    }

    static func fetchRequest() -> NSFetchRequest<TeamMember> {
        NSFetchRequest<TeamMember>(entityName: "TeamMember")
    }
}
