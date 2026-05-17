import Foundation
import CoreData
import Combine

// MARK: - TodoSyncService
//
// Syncs todos between Core Data and Supabase (via the web app's /api/cloud-todos).
// Only active when the user is signed in to cloud AND the production has been published.
//
// Push: called after any local create/toggle — writes the change to Supabase.
// Pull: called when TodoSheet opens — fetches Supabase state and merges into Core Data.
//   - Supabase todo exists locally  → update title + isDone
//   - Supabase todo not local       → create it in Core Data
//   - Local todo with cloudID not in Supabase → delete from Core Data (removed on web)

@MainActor
final class TodoSyncService {

    static let shared = TodoSyncService()

    private let baseURL = URL(string: "https://www.flip-the-script.app/api/cloud-todos")!

    // MARK: - Push (create)

    func push(_ todo: TodoItem) {
        guard let token = CloudAuthManager.shared.accessToken,
              let production = todo.production,
              production.cloudID != nil else { return }

        Task {
            var body: [String: Any] = [
                "production_cloud_id": production.cloudID!.uuidString,
                "title":               todo.title,
                "is_done":             todo.isDone,
            ]
            if let sceneCloudId = todo.scene?.cloudID?.uuidString {
                body["scene_cloud_id"] = sceneCloudId
            }

            guard let data = try? JSONSerialization.data(withJSONObject: body) else { return }
            var req = URLRequest(url: baseURL)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.httpBody = data
            req.timeoutInterval = 15

            guard let (respData, _) = try? await URLSession.shared.data(for: req),
                  let json = try? JSONSerialization.jsonObject(with: respData) as? [String: Any],
                  let cloudIdStr = json["id"] as? String,
                  let cloudId = UUID(uuidString: cloudIdStr) else { return }

            // Store the Supabase id as cloudID so future toggles/deletes can reference it
            todo.cloudID = cloudId
            PersistenceController.shared.save()
        }
    }

    // MARK: - Toggle (update isDone)

    func toggle(_ todo: TodoItem) {
        guard let token = CloudAuthManager.shared.accessToken,
              let cloudId = todo.cloudID else { return }

        Task {
            let body: [String: Any] = ["id": cloudId.uuidString, "is_done": todo.isDone]
            guard let data = try? JSONSerialization.data(withJSONObject: body) else { return }
            var req = URLRequest(url: baseURL)
            req.httpMethod = "PATCH"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.httpBody = data
            req.timeoutInterval = 15
            _ = try? await URLSession.shared.data(for: req)
        }
    }

    // MARK: - Delete

    func delete(_ todo: TodoItem, context: NSManagedObjectContext) {
        let cloudId = todo.cloudID
        let token = CloudAuthManager.shared.accessToken

        context.delete(todo)
        PersistenceController.shared.save()

        guard let token, let cloudId else { return }

        Task {
            let body: [String: Any] = ["id": cloudId.uuidString]
            guard let data = try? JSONSerialization.data(withJSONObject: body) else { return }
            var req = URLRequest(url: baseURL)
            req.httpMethod = "DELETE"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.httpBody = data
            req.timeoutInterval = 15
            _ = try? await URLSession.shared.data(for: req)
        }
    }

    // MARK: - Pull (merge Supabase → Core Data)

    func pull(production: Production, context: NSManagedObjectContext) {
        guard CloudAuthManager.shared.isSignedIn else {
            print("🔵 TodoSync pull: skipped — not signed in")
            return
        }
        guard let token = CloudAuthManager.shared.accessToken else {
            print("🔵 TodoSync pull: skipped — no access token")
            return
        }
        guard let productionCloudId = production.cloudID?.uuidString else {
            print("🔵 TodoSync pull: skipped — production has no cloudID")
            return
        }

        print("🔵 TodoSync pull: starting for production \(productionCloudId)")

        Task {
            // Refresh token before pulling
            let _ = await CloudAuthManager.shared.refreshIfNeeded()
            guard let freshToken = CloudAuthManager.shared.accessToken else { return }

            guard var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return }
            comps.queryItems = [URLQueryItem(name: "productionCloudId", value: productionCloudId)]
            guard let url = comps.url else { return }

            var req = URLRequest(url: url)
            req.setValue("Bearer \(freshToken)", forHTTPHeaderField: "Authorization")
            req.timeoutInterval = 15

            guard let (data, resp) = try? await URLSession.shared.data(for: req),
                  let http = resp as? HTTPURLResponse else {
                print("🔴 TodoSync pull: network error")
                return
            }

            print("🔵 TodoSync pull: HTTP \(http.statusCode) — \(String(data: data, encoding: .utf8) ?? "")")
            guard http.statusCode == 200 else { return }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            guard let remote = try? decoder.decode([RemoteTodo].self, from: data) else {
                print("🔴 TodoSync pull: JSON decode failed")
                return
            }

            print("🔵 TodoSync pull: got \(remote.count) todos from server")
            await MainActor.run {
                merge(remote: remote, into: production, context: context)
            }
        }
    }

    // MARK: - Merge logic

    private func merge(remote: [RemoteTodo], into production: Production, context: NSManagedObjectContext) {
        let localTodos = production.todoItems
        let localByCloudId = Dictionary(uniqueKeysWithValues: localTodos.compactMap { t -> (String, TodoItem)? in
            guard let id = t.cloudID else { return nil }
            return (id.uuidString.lowercased(), t)
        })
        let remoteIds = Set(remote.compactMap { $0.cloudId?.lowercased() })

        var changed = false

        // Update existing / insert new
        for r in remote {
            guard let cloudId = r.cloudId else { continue }
            if let local = localByCloudId[cloudId.lowercased()] {
                // Update if anything changed
                if local.isDone != r.isDone || local.title != r.title {
                    local.isDone = r.isDone
                    local.title  = r.title
                    changed = true
                }
            } else {
                // New todo created on web — add to Core Data
                let item = TodoItem(context: context)
                item.cloudID   = UUID(uuidString: cloudId)
                item.title     = r.title
                item.isDone    = r.isDone
                item.createdAt = r.createdAt ?? Date()
                production.addTodoItem(item)

                // Re-link to scene if we have a matching cloudID
                if let sceneCloudId = r.sceneCloudId {
                    let sceneReq = NSFetchRequest<ScriptScene>(entityName: "ScriptScene")
                    sceneReq.predicate = NSPredicate(format: "cloudID == %@", sceneCloudId as CVarArg)
                    sceneReq.fetchLimit = 1
                    if let scene = try? context.fetch(sceneReq).first {
                        scene.addTodoItem(item)
                    }
                }
                changed = true
            }
        }

        // Delete local todos that were removed on the web
        for local in localTodos {
            guard let id = local.cloudID else { continue }
            if !remoteIds.contains(id.uuidString.lowercased()) {
                context.delete(local)
                changed = true
            }
        }

        if changed {
            production.objectWillChange.send()
            PersistenceController.shared.save()
        }
    }

    // MARK: - Remote model

    private struct RemoteTodo: Decodable {
        let cloudId:      String?
        let title:        String
        let isDone:       Bool
        let sceneCloudId: String?
        let createdAt:    Date?

        enum CodingKeys: String, CodingKey {
            case cloudId, title, isDone, sceneCloudId, createdAt
        }
    }
}
