import Foundation
import PDFKit

// MARK: - Output type

struct ShootEntry {
    let sceneNumber: String  // matches ScriptScene.sceneNumber
    let shootDay: Int
    let shootOrder: Int      // global position across all days (1 = first scene shot)
    let shootDayLabel: String // e.g. "Day 1 – Saturday 16 May"
}

// MARK: - Parser

enum ScheduleParser {

    static func parse(pdfData: Data) -> [ShootEntry] {
        guard let doc = PDFDocument(data: pdfData) else { return [] }
        var fullText = ""
        for i in 0..<doc.pageCount {
            fullText += (doc.page(at: i)?.string ?? "") + "\n"
        }
        return parseText(fullText)
    }

    static func parseText(_ text: String) -> [ShootEntry] {
        let lines = text.components(separatedBy: .newlines)
        var entries: [ShootEntry] = []
        var currentDay = 0
        var currentDayLabel = ""
        var globalOrder = 0
        var seenScenes = Set<String>() // guard against duplicates

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { continue }

            if let (day, label) = extractShootDay(from: trimmed) {
                currentDay = day
                currentDayLabel = label
                continue
            }

            if let sceneNum = extractSceneNumber(from: trimmed),
               !seenScenes.contains(sceneNum) {
                globalOrder += 1
                seenScenes.insert(sceneNum)
                entries.append(ShootEntry(
                    sceneNumber: sceneNum,
                    shootDay: currentDay,
                    shootOrder: globalOrder,
                    shootDayLabel: currentDayLabel
                ))
            }
        }

        return entries
    }

    // MARK: - Line matchers

    /// Matches: "Shoot Day # 1 Saturday, 16 May 2026"
    /// Also matches: "-- Day 1 Saturday 16th May --" style headers
    private static func extractShootDay(from line: String) -> (Int, String)? {
        // Primary: "Shoot Day # N <rest>"
        let primary = #"^Shoot Day #\s*(\d+)\s*(.*)"#
        if let m = match(line, pattern: primary) {
            let n = Int(m[0]) ?? 0
            let label = "Day \(n) – \(m[1].trimmingCharacters(in: .whitespaces))"
            return (n, label)
        }

        // Secondary: "-- Day N <rest> --"
        let secondary = #"^--\s*Day (\d+)\s+(.*?)\s*--"#
        if let m = match(line, pattern: secondary) {
            let n = Int(m[0]) ?? 0
            let label = "Day \(n) – \(m[1].trimmingCharacters(in: .whitespaces))"
            return (n, label)
        }

        return nil
    }

    /// Matches: "Scene # 2", "Scene #2", "Scene# 2A"
    /// Does NOT match "Shoot Day # N" or "End Day # N"
    private static func extractSceneNumber(from line: String) -> String? {
        // Must start with "Scene" (case-insensitive), not "Shoot" or "End"
        let lower = line.lowercased()
        guard lower.hasPrefix("scene") else { return nil }

        let pattern = #"^[Ss]cene\s*#\s*(\w+)"#
        if let m = match(line, pattern: pattern) {
            return m[0]
        }
        return nil
    }

    // MARK: - Regex helper

    /// Returns capture groups [1...] as strings, or nil if no match.
    private static func match(_ string: String, pattern: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let m = regex.firstMatch(in: string, range: NSRange(string.startIndex..., in: string))
        else { return nil }

        var groups: [String] = []
        for i in 1..<m.numberOfRanges {
            if let range = Range(m.range(at: i), in: string) {
                groups.append(String(string[range]))
            } else {
                groups.append("")
            }
        }
        return groups
    }
}
