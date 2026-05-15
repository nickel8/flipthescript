import CoreData

// MARK: - Base class: makes NSManagedObject work with @ObservedObject

public class ObservableManagedObject: NSManagedObject, Identifiable {
    public var id: NSManagedObjectID { objectID }
}

// MARK: - Persistence Controller

final class PersistenceController {

    static let shared = PersistenceController()
    static let preview = PersistenceController(inMemory: true)

    let container: NSPersistentContainer

    var viewContext: NSManagedObjectContext { container.viewContext }

    init(inMemory: Bool = false) {
        container = NSPersistentContainer(
            name: "FlipTheScript",
            managedObjectModel: PersistenceController.makeModel()
        )

        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        } else {
            PersistenceController.migrateFromContainerIfNeeded()
        }

        container.loadPersistentStores { [weak container] desc, error in
            guard let error else { return }
            print("⚠️ Core Data load error: \(error)")
            // Model changed — destroy incompatible store and recreate fresh
            guard let url = desc.url, url.path != "/dev/null",
                  let coordinator = container?.persistentStoreCoordinator else { return }
            try? coordinator.destroyPersistentStore(at: url, type: .sqlite)
            try? coordinator.addPersistentStore(ofType: NSSQLiteStoreType, configurationName: nil, at: url)
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    // MARK: - Data migration chain (runs on first launch after update)

    private static func migrateFromContainerIfNeeded() {
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser
        guard let appSupport = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return }
        let destBase = appSupport.appendingPathComponent("FlipTheScript/FlipTheScript")

        // Step 1: Hoddy.FlipTheScript sandbox → user Application Support (legacy, pre-sandbox-removal build)
        let oldContainerBase = home
            .appendingPathComponent("Library/Containers/Hoddy.FlipTheScript/Data/Library/Application Support/FlipTheScript/FlipTheScript")
        if fm.fileExists(atPath: oldContainerBase.appendingPathExtension("sqlite").path),
           !fm.fileExists(atPath: destBase.appendingPathExtension("sqlite").path) {
            try? fm.createDirectory(at: destBase.deletingLastPathComponent(), withIntermediateDirectories: true)
            for ext in ["sqlite", "sqlite-wal", "sqlite-shm"] {
                let src = oldContainerBase.appendingPathExtension(ext)
                let dst = destBase.appendingPathExtension(ext)
                if fm.fileExists(atPath: src.path) { try? fm.copyItem(at: src, to: dst) }
            }
            print("✅ Migrated from Hoddy.FlipTheScript container to Application Support")
            return
        }

        // Step 2: user Application Support → com.hoddytools.FlipTheScript sandbox
        // Needed when upgrading from the non-sandboxed direct-distribution build.
        // In a sandboxed app, applicationSupportDirectory points inside the container,
        // so we construct the unsandboxed path manually.
        let unsandboxedBase = home
            .appendingPathComponent("Library/Application Support/FlipTheScript/FlipTheScript")
        if fm.fileExists(atPath: unsandboxedBase.appendingPathExtension("sqlite").path),
           !fm.fileExists(atPath: destBase.appendingPathExtension("sqlite").path) {
            try? fm.createDirectory(at: destBase.deletingLastPathComponent(), withIntermediateDirectories: true)
            for ext in ["sqlite", "sqlite-wal", "sqlite-shm"] {
                let src = unsandboxedBase.appendingPathExtension(ext)
                let dst = destBase.appendingPathExtension(ext)
                if fm.fileExists(atPath: src.path) { try? fm.copyItem(at: src, to: dst) }
            }
            print("✅ Migrated from unsandboxed Application Support to new sandbox container")
        }
    }

    // MARK: - Save

    func save() {
        guard container.viewContext.hasChanges else { return }
        do { try container.viewContext.save() }
        catch { print("⚠️ Save error: \(error)") }
    }

    // MARK: - Programmatic Core Data model ────────────────────────────────────

    static func makeModel() -> NSManagedObjectModel {
        let model = NSManagedObjectModel()

        let prodE    = makeEntity("Production")
        let episodeE = makeEntity("Episode")
        let scriptE  = makeEntity("Script")
        let sceneE   = makeEntity("ScriptScene")
        let bdE      = makeEntity("BreakdownSheet")
        let elemE    = makeEntity("Element")
        let seE      = makeEntity("SceneElement")
        let memberE  = makeEntity("TeamMember")
        let entryE   = makeEntity("ChangeEntry")
        let todoE    = makeEntity("TodoItem")

        prodE.properties = [
            str("name"), date("createdAt"),
            bool("hasEpisodes"),
            optStr("shareEmailsJSON"),
            optStr("adminEmailsJSON"),
        ]

        episodeE.properties = [
            str("name"), int32("number"), date("createdAt"), bool("isDefault"),
        ]

        scriptE.properties = [
            str("version"), str("filename"), date("importedAt"),
            binary("pdfData", external: true), bool("isParsing"),
            optStr("colorHex"),
        ]

        sceneE.properties = [
            str("sceneNumber"), str("slugLine"), str("intExt"),
            str("location"), str("timeOfDay"), int32("pageStart"),
            str("rawText"), str("revisionStatusRaw", default: "Unchanged"),
            int32("shootDay"), int32("shootOrder"),
        ]

        bdE.properties = [
            str("synopsis"), str("notes"), bool("isReviewed"),
        ]

        elemE.properties = [
            str("name"), str("categoryRaw"), str("notes"),
        ]

        seE.properties = [
            str("notes"),
        ]

        memberE.properties = [
            str("name"), str("email"), str("roleRaw"), str("departmentRaw"),
            optStr("cloudKitUserID"),
            bool("notifyByPush", default: true), bool("notifyByEmail"),
            date("addedAt"),
        ]

        entryE.properties = [
            str("typeRaw"), str("summary"),
            str("affectedSceneNumbersRaw"),
            str("authorName"), date("createdAt"), bool("emailDispatched"),
        ]

        todoE.properties = [
            str("title"), bool("isDone"), date("createdAt"),
        ]

        // Production ↔ Episode
        let (p_episodes, ep_production) = manyToOne(many: "_episodes", from: prodE, to: episodeE, manyDelete: .cascadeDeleteRule, one: "production", oneDelete: .nullifyDeleteRule)
        prodE.properties    += [p_episodes]
        episodeE.properties += [ep_production]

        // Episode ↔ Script
        let (ep_scripts, s_episode) = manyToOne(many: "_scripts", from: episodeE, to: scriptE, manyDelete: .cascadeDeleteRule, one: "episode", oneDelete: .nullifyDeleteRule)
        episodeE.properties += [ep_scripts]
        scriptE.properties  += [s_episode]

        // Production ↔ Element
        let (p_elements, e_production) = manyToOne(many: "_elements", from: prodE, to: elemE, manyDelete: .cascadeDeleteRule, one: "production", oneDelete: .nullifyDeleteRule)
        prodE.properties  += [p_elements]
        elemE.properties  += [e_production]

        // Production ↔ TeamMember
        let (p_team, m_production) = manyToOne(many: "_team", from: prodE, to: memberE, manyDelete: .cascadeDeleteRule, one: "production", oneDelete: .nullifyDeleteRule)
        prodE.properties   += [p_team]
        memberE.properties += [m_production]

        // Production ↔ ChangeEntry
        let (p_log, ce_production) = manyToOne(many: "_changeLog", from: prodE, to: entryE, manyDelete: .cascadeDeleteRule, one: "production", oneDelete: .nullifyDeleteRule)
        prodE.properties  += [p_log]
        entryE.properties += [ce_production]

        // Script ↔ ScriptScene
        let (s_scenes, sc_script) = manyToOne(many: "_scenes", from: scriptE, to: sceneE, manyDelete: .cascadeDeleteRule, one: "script", oneDelete: .nullifyDeleteRule)
        scriptE.properties += [s_scenes]
        sceneE.properties  += [sc_script]

        // ScriptScene ↔ BreakdownSheet (one-to-one)
        let sc_sheet = toOneRel("breakdownSheet", to: bdE, delete: .cascadeDeleteRule)
        let bd_scene = toOneRel("scene", to: sceneE, delete: .nullifyDeleteRule)
        sc_sheet.inverseRelationship = bd_scene
        bd_scene.inverseRelationship = sc_sheet
        sceneE.properties += [sc_sheet]
        bdE.properties    += [bd_scene]

        // BreakdownSheet ↔ SceneElement
        let (bd_ses, se_sheet) = manyToOne(many: "_sceneElements", from: bdE, to: seE, manyDelete: .cascadeDeleteRule, one: "breakdownSheet", oneDelete: .nullifyDeleteRule)
        bdE.properties += [bd_ses]
        seE.properties += [se_sheet]

        // Element ↔ SceneElement
        let (e_ses, se_element) = manyToOne(many: "_sceneElements", from: elemE, to: seE, manyDelete: .nullifyDeleteRule, one: "element", oneDelete: .nullifyDeleteRule)
        elemE.properties += [e_ses]
        seE.properties   += [se_element]

        // Production ↔ TodoItem
        let (p_todos, t_production) = manyToOne(many: "_todoItems", from: prodE, to: todoE, manyDelete: .cascadeDeleteRule, one: "production", oneDelete: .nullifyDeleteRule)
        prodE.properties += [p_todos]
        todoE.properties += [t_production]

        // ScriptScene ↔ TodoItem (optional — nullify so todos survive scene deletion)
        let (sc_todos, t_scene) = manyToOne(many: "_todoItems", from: sceneE, to: todoE, manyDelete: .nullifyDeleteRule, one: "scene", oneDelete: .nullifyDeleteRule)
        sceneE.properties += [sc_todos]
        todoE.properties  += [t_scene]

        model.entities = [prodE, episodeE, scriptE, sceneE, bdE, elemE, seE, memberE, entryE, todoE]
        return model
    }

    // MARK: - Builder helpers

    private static func makeEntity(_ name: String) -> NSEntityDescription {
        let e = NSEntityDescription(); e.name = name; e.managedObjectClassName = name; return e
    }

    private static func str(_ name: String, default v: String = "") -> NSAttributeDescription {
        let a = NSAttributeDescription(); a.name = name; a.attributeType = .stringAttributeType; a.defaultValue = v; a.isOptional = true; return a
    }

    private static func optStr(_ name: String) -> NSAttributeDescription {
        let a = NSAttributeDescription(); a.name = name; a.attributeType = .stringAttributeType; a.isOptional = true; return a
    }

    private static func date(_ name: String) -> NSAttributeDescription {
        let a = NSAttributeDescription(); a.name = name; a.attributeType = .dateAttributeType; a.defaultValue = Date(); a.isOptional = true; return a
    }

    private static func bool(_ name: String, default v: Bool = false) -> NSAttributeDescription {
        let a = NSAttributeDescription(); a.name = name; a.attributeType = .booleanAttributeType; a.defaultValue = v as NSNumber; a.isOptional = true; return a
    }

    private static func int32(_ name: String, default v: Int32 = 0) -> NSAttributeDescription {
        let a = NSAttributeDescription(); a.name = name; a.attributeType = .integer32AttributeType; a.defaultValue = v as NSNumber; a.isOptional = true; return a
    }

    private static func binary(_ name: String, external: Bool = false) -> NSAttributeDescription {
        let a = NSAttributeDescription(); a.name = name; a.attributeType = .binaryDataAttributeType; a.allowsExternalBinaryDataStorage = external; a.isOptional = true; return a
    }

    private static func manyToOne(
        many manyName: String, from fromE: NSEntityDescription, to toE: NSEntityDescription, manyDelete: NSDeleteRule,
        one oneName: String, oneDelete: NSDeleteRule
    ) -> (NSRelationshipDescription, NSRelationshipDescription) {
        let many = NSRelationshipDescription(); many.name = manyName; many.destinationEntity = toE; many.deleteRule = manyDelete; many.minCount = 0; many.maxCount = 0
        let one  = NSRelationshipDescription(); one.name  = oneName;  one.destinationEntity  = fromE; one.deleteRule = oneDelete; one.minCount = 0; one.maxCount = 1; one.isOptional = true
        many.inverseRelationship = one; one.inverseRelationship = many
        return (many, one)
    }

    private static func toOneRel(_ name: String, to dest: NSEntityDescription, delete: NSDeleteRule) -> NSRelationshipDescription {
        let r = NSRelationshipDescription(); r.name = name; r.destinationEntity = dest; r.deleteRule = delete; r.minCount = 0; r.maxCount = 1; r.isOptional = true; return r
    }
}
