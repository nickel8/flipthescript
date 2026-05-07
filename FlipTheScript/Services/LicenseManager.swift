import Foundation
import Combine

// MARK: - LicenseManager
//
// Handles license key activation and 1-day free trial.
//
// TODO: When Paddle is set up, replace the stubbed validate() call with:
//   POST https://api.paddle.com/licenses/verify
//   Body: { "license_key": key, "product_id": YOUR_PADDLE_PRODUCT_ID }
//   A 200 response with "activated" status means the key is valid.

@MainActor
final class LicenseManager: ObservableObject {

    static let shared = LicenseManager()

    @Published private(set) var state: LicenseState
    @Published var isValidating = false
    @Published var activationError: String?

    private let defaults = UserDefaults.standard

    private enum Keys {
        static let activated    = "license.activated"
        static let key          = "license.key"
        static let firstLaunch  = "license.firstLaunch"
    }

    var licenseKey: String? { defaults.string(forKey: Keys.key) }

    var trialDaysRemaining: Int {
        guard let first = defaults.object(forKey: Keys.firstLaunch) as? Date else { return 1 }
        let elapsed = Calendar.current.dateComponents([.day], from: first, to: Date()).day ?? 0
        return max(0, 1 - elapsed)
    }

    private init() {
        // Record first launch date
        if defaults.object(forKey: Keys.firstLaunch) == nil {
            defaults.set(Date(), forKey: Keys.firstLaunch)
        }

        if defaults.bool(forKey: Keys.activated) {
            state = .activated
        } else {
            let days = Calendar.current.dateComponents(
                [.day],
                from: (defaults.object(forKey: Keys.firstLaunch) as? Date) ?? Date(),
                to: Date()
            ).day ?? 0
            state = days < 1 ? .trial : .expired
        }
    }

    // MARK: - Activate

    func activate(key: String) async {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !trimmed.isEmpty else {
            activationError = "Please enter a license key."
            return
        }

        isValidating = true
        activationError = nil
        defer { isValidating = false }

        let valid = await validateWithPaddle(key: trimmed)

        if valid {
            defaults.set(trimmed, forKey: Keys.key)
            defaults.set(true, forKey: Keys.activated)
            state = .activated
        } else {
            activationError = "That license key doesn't look right. Check for typos or contact hello@flipthescript.app."
        }
    }

    // MARK: - Deactivate (for testing / support)

    func deactivate() {
        defaults.removeObject(forKey: Keys.activated)
        defaults.removeObject(forKey: Keys.key)
        let days = Calendar.current.dateComponents(
            [.day],
            from: (defaults.object(forKey: Keys.firstLaunch) as? Date) ?? Date(),
            to: Date()
        ).day ?? 0
        state = days < 1 ? .trial : .expired
    }

    // MARK: - License validation

    private func validateWithPaddle(key: String) async -> Bool {
        // Development key
        if key == "FLIP-TEST-DEV0-0000" { return true }

        guard let url = URL(string: "https://www.flip-the-script.app/api/activate") else { return false }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(["key": key])
        request.timeoutInterval = 15

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(ActivateResponse.self, from: data)
            return response.valid
        } catch {
            return false
        }
    }

    private struct ActivateResponse: Decodable {
        let valid: Bool
    }
}

// MARK: - License State

enum LicenseState {
    case trial      // Within 1-day free trial
    case activated  // Valid license key entered
    case expired    // Trial over, no license
}
