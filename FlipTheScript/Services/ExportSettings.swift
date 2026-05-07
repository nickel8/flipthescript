import Foundation
import SwiftUI
import Combine

// Persisted house-style settings for PDF export.
// Stored in UserDefaults — one set of settings per user, applies to all productions.

final class ExportSettings: ObservableObject {

    static let shared = ExportSettings()

    // MARK: - Published settings

    @Published var pageSize: PageSize {
        didSet { defaults.set(pageSize.rawValue, forKey: K.pageSize) }
    }
    @Published var accentHex: String {
        didSet { defaults.set(accentHex, forKey: K.accentHex) }
    }
    @Published var hiddenCategories: Set<String> {
        didSet { defaults.set(Array(hiddenCategories), forKey: K.hiddenCategories) }
    }
    @Published var bodyFontSize: FontSize {
        didSet { defaults.set(bodyFontSize.rawValue, forKey: K.bodyFontSize) }
    }
    @Published var logoData: Data? {
        didSet { defaults.set(logoData, forKey: K.logoData) }
    }

    // MARK: - Types

    enum PageSize: String, CaseIterable, Identifiable {
        case a4       = "A4"
        case usLetter = "US Letter"

        var id: String { rawValue }

        var width:  CGFloat { self == .a4 ? 595 : 612 }
        var height: CGFloat { self == .a4 ? 842 : 792 }
    }

    enum FontSize: String, CaseIterable, Identifiable {
        case small  = "Small"
        case medium = "Medium"
        case large  = "Large"

        var id: String { rawValue }

        var body:  CGFloat { switch self { case .small: 9;  case .medium: 10; case .large: 11 } }
        var label: CGFloat { switch self { case .small: 6;  case .medium: 7;  case .large: 8  } }
        var scene: CGFloat { switch self { case .small: 19; case .medium: 22; case .large: 25 } }
    }

    // Preset accent colours — dark enough for white text
    static let accentPresets: [(name: String, hex: String)] = [
        ("Charcoal", "#141417"),
        ("Navy",     "#1B2D4F"),
        ("Forest",   "#1A3D2A"),
        ("Burgundy", "#4A1525"),
        ("Slate",    "#2B3D50"),
        ("Copper",   "#7A3B1E"),
    ]

    // MARK: - Computed helpers

    var visibleCategories: [ElementCategory] {
        ElementCategory.allCases.filter { !hiddenCategories.contains($0.rawValue) }
    }

    var accentCGColor: CGColor {
        cgColor(fromHex: accentHex) ?? CGColor(red: 0.08, green: 0.08, blue: 0.10, alpha: 1)
    }

    var accentSwiftUIColor: Color {
        Color(cgColor: accentCGColor)
    }

    // MARK: - Init

    private let defaults = UserDefaults.standard
    private enum K {
        static let pageSize         = "export.pageSize"
        static let accentHex        = "export.accentHex"
        static let hiddenCategories = "export.hiddenCategories"
        static let bodyFontSize     = "export.bodyFontSize"
        static let logoData         = "export.logoData"
    }

    private init() {
        pageSize         = PageSize(rawValue: defaults.string(forKey: K.pageSize) ?? "") ?? .a4
        accentHex        = defaults.string(forKey: K.accentHex) ?? "#141417"
        hiddenCategories = Set(defaults.stringArray(forKey: K.hiddenCategories) ?? [])
        bodyFontSize     = FontSize(rawValue: defaults.string(forKey: K.bodyFontSize) ?? "") ?? .medium
        logoData         = defaults.data(forKey: K.logoData)
    }

    // MARK: - Hex → CGColor

    func cgColor(fromHex hex: String) -> CGColor? {
        let h = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard h.count == 6, let v = UInt64(h, radix: 16) else { return nil }
        return CGColor(
            red:   CGFloat((v >> 16) & 0xFF) / 255,
            green: CGFloat((v >>  8) & 0xFF) / 255,
            blue:  CGFloat( v        & 0xFF) / 255,
            alpha: 1
        )
    }
}
