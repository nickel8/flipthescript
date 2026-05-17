import Foundation
import Combine

// MARK: - CloudError

enum CloudError: LocalizedError {
    case authFailed(String)
    case publishFailed(String)
    case notSignedIn

    var errorDescription: String? {
        switch self {
        case .authFailed(let msg):   return msg
        case .publishFailed(let msg): return "Publish failed: \(msg)"
        case .notSignedIn:           return "Sign in to publish to cloud."
        }
    }
}

// MARK: - CloudAuthManager

@MainActor
final class CloudAuthManager: ObservableObject {

    static let shared = CloudAuthManager()

    @Published private(set) var isSignedIn = false
    @Published private(set) var userEmail: String?
    @Published var isLoading  = false
    @Published var authError: String?

    // MARK: - Token storage (Keychain)

    private(set) var accessToken: String? {
        get { CloudKeychain.load(key: "accessToken") }
        set {
            if let v = newValue { CloudKeychain.save(v, key: "accessToken") }
            else                { CloudKeychain.delete(key: "accessToken") }
        }
    }

    private var refreshToken: String? {
        get { CloudKeychain.load(key: "refreshToken") }
        set {
            if let v = newValue { CloudKeychain.save(v, key: "refreshToken") }
            else                { CloudKeychain.delete(key: "refreshToken") }
        }
    }

    /// The Supabase user UUID decoded from the JWT `sub` claim.
    var userID: String? {
        guard let token = accessToken,
              let payload = decodeJWTPayload(token) else { return nil }
        return payload["sub"] as? String
    }

    // MARK: - Init

    private init() {
        isSignedIn = accessToken != nil
        userEmail  = UserDefaults.standard.string(forKey: "fts.cloud.email")
    }

    // MARK: - Sign in

    func signIn(email: String, password: String) async {
        isLoading  = true
        authError  = nil
        defer { isLoading = false }

        do {
            let body: [String: String] = ["email": email, "password": password]
            let resp: AuthResponse = try await postAuth(path: "/auth/v1/token?grant_type=password", body: body)
            apply(response: resp, fallbackEmail: email)
        } catch let e as CloudError {
            authError = e.localizedDescription
        } catch {
            authError = error.localizedDescription
        }
    }

    // MARK: - Sign up

    func signUp(email: String, password: String) async {
        isLoading = true
        authError = nil
        defer { isLoading = false }

        do {
            let body: [String: String] = [
                "email": email,
                "password": password,
                "redirect_to": "https://www.flip-the-script.app/cloud/confirmed"
            ]
            let resp: AuthResponse = try await postAuth(path: "/auth/v1/signup", body: body)
            if resp.accessToken != nil {
                apply(response: resp, fallbackEmail: email)
            } else {
                // Email confirmation required — Supabase returns no token until confirmed
                authError = "Check your email to confirm your account, then sign in."
            }
        } catch let e as CloudError {
            authError = e.localizedDescription
        } catch {
            authError = error.localizedDescription
        }
    }

    // MARK: - Sign out

    func signOut() {
        accessToken  = nil
        refreshToken = nil
        userEmail    = nil
        UserDefaults.standard.removeObject(forKey: "fts.cloud.email")
        isSignedIn   = false
    }

    // MARK: - Token refresh

    /// Silently refreshes the access token. Returns `true` if the token is now valid.
    func refreshIfNeeded() async -> Bool {
        guard let rt = refreshToken else { return false }
        let body: [String: String] = ["refresh_token": rt]
        do {
            let resp: AuthResponse = try await postAuth(path: "/auth/v1/token?grant_type=refresh_token", body: body)
            if resp.accessToken != nil {
                apply(response: resp, fallbackEmail: userEmail ?? "")
                return true
            }
        } catch {}
        return false
    }

    // MARK: - Helpers

    private func apply(response: AuthResponse, fallbackEmail: String) {
        guard let token = response.accessToken else { return }
        accessToken  = token
        refreshToken = response.refreshToken ?? refreshToken
        let email    = response.user?.email ?? fallbackEmail
        userEmail    = email
        UserDefaults.standard.set(email, forKey: "fts.cloud.email")
        isSignedIn   = true
    }

    private func postAuth<R: Decodable>(path: String, body: [String: String]) async throws -> R {
        guard let url = URL(string: CloudConfig.supabaseURL + path) else { throw URLError(.badURL) }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(CloudConfig.anonKey, forHTTPHeaderField: "apikey")
        req.httpBody   = try JSONEncoder().encode(body)
        req.timeoutInterval = 20

        let (data, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse, http.statusCode >= 400 {
            let msg = (try? JSONDecoder().decode(SupabaseErrorBody.self, from: data))?.message
                ?? String(data: data, encoding: .utf8)
                ?? "Authentication failed"
            throw CloudError.authFailed(msg)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(R.self, from: data)
    }

    private func decodeJWTPayload(_ token: String) -> [String: Any]? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var b64 = String(parts[1])
        let pad = b64.count % 4
        if pad > 0 { b64 += String(repeating: "=", count: 4 - pad) }
        guard let data = Data(base64Encoded: b64) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    // MARK: - Response types

    private struct AuthResponse: Decodable {
        let accessToken:  String?
        let refreshToken: String?
        let user:         AuthUser?
    }

    private struct AuthUser: Decodable {
        let email: String?
    }

    private struct SupabaseErrorBody: Decodable {
        let message: String?
        let msg:     String?
        var resolvedMessage: String { message ?? msg ?? "Unknown error" }
    }
}
