import Foundation
import CoreData
import Combine

// MARK: - PublishService

/// Builds a full production snapshot and POSTs it to the web app's /api/publish
/// endpoint, which uses the Supabase service role to write the data.
/// No Supabase credentials or RLS policies are needed on the Mac app side.
@MainActor
final class PublishService: ObservableObject {

    static let shared = PublishService()

    @Published var isPublishing  = false
    @Published var progressLabel = ""
    @Published var publishError: String?

    private let publishURL = URL(string: "https://www.flip-the-script.app/api/publish")!
    private let defaults   = UserDefaults.standard

    // MARK: - Last-published date

    func lastPublishedAt(for production: Production) -> Date? {
        guard let id = production.cloudID else { return nil }
        return defaults.object(forKey: "fts.published.\(id.uuidString)") as? Date
    }

    // MARK: - Entry point

    func publish(_ production: Production) async {
        guard !isPublishing else { return }

        let auth = CloudAuthManager.shared
        guard auth.isSignedIn else {
            publishError = CloudError.notSignedIn.localizedDescription
            return
        }

        isPublishing  = true
        publishError  = nil
        progressLabel = "Preparing…"
        defer { isPublishing = false }

        do {
            // Always refresh the token before publishing — access tokens expire after 1 hour
            let _ = await auth.refreshIfNeeded()
            // Lazily assign any missing cloudIDs (objects created before cloud support)
            assignMissingCloudIDs(production)
            PersistenceController.shared.save()

            progressLabel = "Building snapshot…"
            let payload = buildPayload(production)

            progressLabel = "Publishing…"
            guard let token = auth.accessToken, !token.isEmpty else {
                throw CloudError.notSignedIn
            }
            try await postSnapshot(payload, token: token)

            progressLabel = "Published"
            defaults.set(Date(), forKey: "fts.published.\(production.cloudID!.uuidString)")

        } catch {
            publishError  = error.localizedDescription
            progressLabel = ""
            print("🔴 Publish error: \(error)")
        }
    }

    // MARK: - Build payload

    private func buildPayload(_ production: Production) -> PublishPayload {
        var episodes:       [EpisodePayload]       = []
        var scripts:        [ScriptPayload]        = []
        var scenes:         [ScenePayload]         = []
        var breakdownSheets:[SheetPayload]         = []
        var sceneElements:  [SceneElementPayload]  = []

        for episode in production.episodes {
            episodes.append(EpisodePayload(episode: episode))
            for script in episode.scripts {
                scripts.append(ScriptPayload(script: script, episodeCloudID: episode.cloudID!))
                for scene in script.sortedScenes {
                    scenes.append(ScenePayload(scene: scene, scriptCloudID: script.cloudID!))
                    if let sheet = scene.breakdownSheet {
                        breakdownSheets.append(SheetPayload(sheet: sheet, sceneCloudID: scene.cloudID!))
                        for se in sheet.sceneElements {
                            guard let elementCloudID = se.element?.cloudID else { continue }
                            sceneElements.append(SceneElementPayload(se: se, sheetCloudID: sheet.cloudID!, elementCloudID: elementCloudID))
                        }
                    }
                }
            }
        }

        let elements = production.elements.map { ElementPayload(element: $0, productionCloudID: production.cloudID!) }

        let todos = production.todoItems.map { TodoPayload(todo: $0) }

        return PublishPayload(
            production:     ProductionPayload(production: production),
            episodes:       episodes,
            scripts:        scripts,
            scenes:         scenes,
            breakdownSheets: breakdownSheets,
            elements:       elements,
            sceneElements:  sceneElements,
            todos:          todos
        )
    }

    // MARK: - HTTP POST

    private func postSnapshot(_ payload: PublishPayload, token: String) async throws {
        var req = URLRequest(url: publishURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)",  forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 60

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        req.httpBody = try encoder.encode(payload)

        let (data, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse, http.statusCode >= 400 {
            let body = String(data: data, encoding: .utf8) ?? "unknown"
            print("🔴 /api/publish \(http.statusCode): \(body)")
            throw CloudError.publishFailed(body)
        }
        print("✅ /api/publish succeeded")
    }

    // MARK: - CloudID lazy assignment

    private func assignMissingCloudIDs(_ production: Production) {
        if production.cloudID == nil { production.cloudID = UUID() }
        for episode in production.episodes {
            if episode.cloudID == nil { episode.cloudID = UUID() }
            for script in episode.scripts {
                if script.cloudID == nil { script.cloudID = UUID() }
                for scene in script.scenes {
                    if scene.cloudID == nil { scene.cloudID = UUID() }
                    if let sheet = scene.breakdownSheet {
                        if sheet.cloudID == nil { sheet.cloudID = UUID() }
                        for se in sheet.sceneElements {
                            if se.cloudID == nil { se.cloudID = UUID() }
                        }
                    }
                }
            }
        }
        for element in production.elements {
            if element.cloudID == nil { element.cloudID = UUID() }
        }
        for todo in production.todoItems {
            if todo.cloudID == nil { todo.cloudID = UUID() }
        }
    }
}

// MARK: - Payload types (Encodable, camelCase — matching TypeScript interface)

private struct PublishPayload: Encodable {
    let production:      ProductionPayload
    let episodes:        [EpisodePayload]
    let scripts:         [ScriptPayload]
    let scenes:          [ScenePayload]
    let breakdownSheets: [SheetPayload]
    let elements:        [ElementPayload]
    let sceneElements:   [SceneElementPayload]
    let todos:           [TodoPayload]
}

private struct ProductionPayload: Encodable {
    let cloudId: String
    let name:    String
    init(production: Production) {
        cloudId = production.cloudID!.uuidString
        name    = production.name
    }
}

private struct EpisodePayload: Encodable {
    let cloudId:          String
    let productionCloudId: String  // resolved by server
    let name:             String
    let number:           Int32
    let isDefault:        Bool
    init(episode: Episode) {
        cloudId           = episode.cloudID!.uuidString
        productionCloudId = episode.production?.cloudID?.uuidString ?? ""
        name              = episode.name
        number            = episode.number
        isDefault         = episode.isDefault
    }
}

private struct ScriptPayload: Encodable {
    let cloudId:      String
    let episodeCloudId: String
    let version:      String
    let filename:     String
    let importedAt:   Date
    let colorHex:     String?
    let isCurrent:    Bool
    init(script: Script, episodeCloudID: UUID) {
        cloudId       = script.cloudID!.uuidString
        episodeCloudId = episodeCloudID.uuidString
        version       = script.version
        filename      = script.filename
        importedAt    = script.importedAt
        colorHex      = script.colorHex
        isCurrent     = true
    }
}

private struct ScenePayload: Encodable {
    let cloudId:        String
    let scriptCloudId:  String
    let sceneNumber:    String
    let slugLine:       String
    let intExt:         String
    let location:       String
    let timeOfDay:      String
    let pageStart:      Int32
    let rawText:        String
    let revisionStatus: String
    let shootDay:       Int32
    let shootOrder:     Int32
    let isComplete:     Bool
    init(scene: ScriptScene, scriptCloudID: UUID) {
        cloudId        = scene.cloudID!.uuidString
        scriptCloudId  = scriptCloudID.uuidString
        sceneNumber    = scene.sceneNumber
        slugLine       = scene.slugLine
        intExt         = scene.intExt
        location       = scene.location
        timeOfDay      = scene.timeOfDay
        pageStart      = scene.pageStart
        rawText        = scene.rawText
        revisionStatus = scene.revisionStatus.rawValue
        shootDay       = scene.shootDay
        shootOrder     = scene.shootOrder
        isComplete     = scene.isComplete
    }
}

private struct SheetPayload: Encodable {
    let cloudId:      String
    let sceneCloudId: String
    let synopsis:     String
    let notes:        String
    let isReviewed:   Bool
    init(sheet: BreakdownSheet, sceneCloudID: UUID) {
        cloudId      = sheet.cloudID!.uuidString
        sceneCloudId = sceneCloudID.uuidString
        synopsis     = sheet.synopsis
        notes        = sheet.notes
        isReviewed   = sheet.isReviewed
    }
}

private struct ElementPayload: Encodable {
    let cloudId:          String
    let productionCloudId: String
    let name:             String
    let category:         String
    let notes:            String
    init(element: Element, productionCloudID: UUID) {
        cloudId           = element.cloudID!.uuidString
        productionCloudId = productionCloudID.uuidString
        name              = element.name
        category          = element.category.rawValue
        notes             = element.notes
    }
}

private struct SceneElementPayload: Encodable {
    let cloudId:       String
    let sheetCloudId:  String
    let elementCloudId: String
    let notes:         String
    init(se: SceneElement, sheetCloudID: UUID, elementCloudID: UUID) {
        cloudId        = se.cloudID!.uuidString
        sheetCloudId   = sheetCloudID.uuidString
        elementCloudId = elementCloudID.uuidString
        notes          = se.notes
    }
}

private struct TodoPayload: Encodable {
    let cloudId:        String
    let title:          String
    let isDone:         Bool
    let createdAt:      Date
    let sceneCloudId:   String?
    init(todo: TodoItem) {
        cloudId      = todo.cloudID!.uuidString
        title        = todo.title
        isDone       = todo.isDone
        createdAt    = todo.createdAt
        sceneCloudId = todo.scene?.cloudID?.uuidString
    }
}
