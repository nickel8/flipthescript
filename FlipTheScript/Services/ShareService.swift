import Foundation

// ---------------------------------------------------------------------------
// ShareService
// Serialises a Script's breakdown to JSON and publishes it to the server.
// No script text is included — only synopses, elements, and schedule data.
// ---------------------------------------------------------------------------

struct ShareService {

    static let baseURL = "https://www.flip-the-script.app"

    // MARK: - Publish

    struct PublishResult {
        let breakdownId: String
        let viewURL: URL
    }

    static func publish(
        script: Script,
        adEmail: String,
        colleagues: [String]
    ) async throws -> PublishResult {

        let snapshot = buildSnapshot(script: script)
        let body: [String: Any] = [
            "adEmail":        adEmail,
            "productionName": script.production?.name ?? "Untitled Production",
            "scriptVersion":  script.version,
            "colleagues":     colleagues,
            "breakdown":      snapshot,
        ]

        guard let url = URL(string: "\(baseURL)/api/share") else {
            throw ShareError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw ShareError.serverError
        }

        let json = try JSONDecoder().decode(ShareResponse.self, from: data)
        let viewURL = URL(string: "\(baseURL)/view/\(json.breakdownId)")!
        return PublishResult(breakdownId: json.breakdownId, viewURL: viewURL)
    }

    // MARK: - Update (re-publish amended breakdown)

    static func update(breakdownId: String, script: Script) async throws {
        let snapshot = buildSnapshot(script: script)
        let body: [String: Any] = [
            "breakdownId":   breakdownId,
            "scriptVersion": script.version,
            "breakdown":     snapshot,
        ]

        guard let url = URL(string: "\(baseURL)/api/share") else { throw ShareError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw ShareError.serverError
        }
    }

    // MARK: - Snapshot builder

    private static func buildSnapshot(script: Script) -> [String: Any] {
        let scenes: [[String: Any]] = script.sortedScenes.map { scene in
            var dict: [String: Any] = [
                "sceneNumber": scene.sceneNumber,
                "slugLine":    scene.slugLine,
                "synopsis":    scene.breakdownSheet?.synopsis ?? "",
                "pageStart":   scene.pageStart,
            ]

            // Group elements by category
            if let sheet = scene.breakdownSheet {
                let grouped: [String: [String]] = Dictionary(
                    grouping: sheet.sceneElements.compactMap { $0.element },
                    by: { $0.category.rawValue }
                ).mapValues { $0.map(\.name) }
                dict["elements"] = grouped.map { ["category": $0.key, "items": $0.value] }
            } else {
                dict["elements"] = [[String: Any]]()
            }

            return dict
        }
        return ["scenes": scenes]
    }

    // MARK: - Types

    private struct ShareResponse: Decodable {
        let breakdownId: String
    }

    enum ShareError: LocalizedError {
        case invalidURL
        case serverError

        var errorDescription: String? {
            switch self {
            case .invalidURL:    return "Invalid server URL."
            case .serverError:   return "The server returned an error. Please try again."
            }
        }
    }
}
