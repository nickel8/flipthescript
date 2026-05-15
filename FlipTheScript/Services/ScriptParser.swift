import Foundation
import PDFKit

struct ParsedScene {
    let sceneNumber: String
    let slugLine: String
    let intExt: String
    let location: String
    let timeOfDay: String
    let pageStart: Int
    var rawText: String
}

enum ScriptParser {

    static func parse(pdfData: Data) -> [ParsedScene] {
        guard let document = PDFDocument(data: pdfData) else { return [] }

        var linesByPage: [(line: String, page: Int)] = []
        for i in 0..<document.pageCount {
            guard let page = document.page(at: i),
                  let text = page.string else { continue }
            // Handle \r\n, \r, and \n
            let lines = text.components(separatedBy: .newlines)
            for line in lines {
                linesByPage.append((line: line, page: i + 1))
            }
        }

        return buildScenes(from: linesByPage)
    }

    /// Parse a single line as a scene — used when the user manually selects headings.
    /// Falls back gracefully if the line doesn't match a known slug format.
    static func parseAnyLine(_ line: String, fallbackNumber: Int, page: Int) -> ParsedScene {
        // Try the regular slug parsers first
        if let m = tryFormatA(line) {
            return ParsedScene(
                sceneNumber: m.sceneNumber ?? String(fallbackNumber),
                slugLine: m.cleanSlug,
                intExt: m.intExt,
                location: m.location,
                timeOfDay: m.timeOfDay,
                pageStart: page,
                rawText: m.cleanSlug + "\n"
            )
        }
        if let m = tryFormatB(line) {
            return ParsedScene(
                sceneNumber: m.sceneNumber ?? String(fallbackNumber),
                slugLine: m.cleanSlug,
                intExt: m.intExt,
                location: m.location,
                timeOfDay: m.timeOfDay,
                pageStart: page,
                rawText: m.cleanSlug + "\n"
            )
        }

        // Generic fallback: strip leading scene number if present, use rest as location
        let stripped = line.trimmingCharacters(in: .whitespaces)
        let withoutNum = stripped.replacingOccurrences(
            of: #"^\d+[A-Za-z]?\.?\s+"#, with: "", options: .regularExpression
        ).trimmingCharacters(in: .whitespaces)

        let sceneNum: String
        if let numStr = stripped.range(of: #"^\d+[A-Za-z]?"#, options: .regularExpression) {
            sceneNum = String(stripped[numStr]).replacingOccurrences(of: ".", with: "")
        } else {
            sceneNum = String(fallbackNumber)
        }

        // Detect INT/EXT anywhere to set intExt field
        let upper = withoutNum.uppercased()
        let intExt: String
        if upper.contains("INT") && upper.contains("EXT") { intExt = "INT/EXT" }
        else if upper.contains("EXT") { intExt = "EXT" }
        else if upper.contains("INT") { intExt = "INT" }
        else { intExt = "INT" }

        return ParsedScene(
            sceneNumber: sceneNum,
            slugLine: stripped,
            intExt: intExt,
            location: withoutNum,
            timeOfDay: "UNSPECIFIED",
            pageStart: page,
            rawText: stripped + "\n"
        )
    }

    static func isTextBased(pdfData: Data) -> Bool {
        guard let document = PDFDocument(data: pdfData),
              let firstPage = document.page(at: 0) else { return false }
        return (firstPage.string ?? "").count > 100
    }

    // MARK: - Private

    private static func buildScenes(from lines: [(line: String, page: Int)]) -> [ParsedScene] {
        var scenes: [ParsedScene] = []
        var current: ParsedScene?
        var autoNumber = 0

        for entry in lines {
            let trimmed = entry.line.trimmingCharacters(in: .whitespaces)
            if let match = parseSlugLine(trimmed) {
                if let scene = current { scenes.append(scene) }
                autoNumber += 1
                let num = match.sceneNumber ?? String(autoNumber)
                current = ParsedScene(
                    sceneNumber: num,
                    slugLine: match.cleanSlug,
                    intExt: match.intExt,
                    location: match.location,
                    timeOfDay: match.timeOfDay,
                    pageStart: entry.page,
                    rawText: match.cleanSlug + "\n"
                )
            } else if current != nil, !trimmed.isEmpty {
                current!.rawText += trimmed + "\n"
            }
        }
        if let last = current { scenes.append(last) }
        return scenes
    }

    private struct SlugMatch {
        let sceneNumber: String?
        let cleanSlug: String
        let intExt: String
        let location: String
        let timeOfDay: String
    }

    private static let intExtPattern = #"INT\.?(?:\/EXT\.?)?|EXT\.?(?:\/INT\.?)?|INT\/EXT|EXT\/INT|I\/E\.?"#

    // Format A: INT./EXT. at the START — "INT. LOCATION - DAY"  (classic screenplay)
    // ^(scene_num)? (INT/EXT)\s+ (location) (- TIME)? (trailing_num)? $
    private static let slugRegexStart: NSRegularExpression? = try? NSRegularExpression(
        pattern: #"^(\d+[A-Za-z]?\.?\s+)?"# +
                 #"(\#(intExtPattern))\s+"# +
                 #"(.+?)"# +
                 #"(?:\s*[-–—]\s*([A-Z][A-Z\s/\.\-]+))?"# +
                 #"(\s+\d+[A-Za-z]?\.?)?\s*$"#,
        options: [.caseInsensitive]
    )

    // Format B: INT./EXT. in the MIDDLE — "LOCATION - INT. - DAY"  (some UK formats)
    // ^(scene_num)? (location) - (INT/EXT) (- TIME)? $
    private static let slugRegexMiddle: NSRegularExpression? = try? NSRegularExpression(
        pattern: #"^(\d+[A-Za-z]?\.?\s+)?"# +
                 #"(.+?)"# +
                 #"\s*[-–—]\s*"# +
                 #"(\#(intExtPattern))"# +
                 #"(?:\s*[-–—.]\s*([A-Z][A-Z\s/\.\-]+))?"# +
                 #"\s*(\d+[A-Za-z]?\.?)?\s*$"#,
        options: [.caseInsensitive]
    )

    private static func parseSlugLine(_ line: String) -> SlugMatch? {
        guard line.count > 5 else { return nil }
        let stripped = line.trimmingCharacters(in: .whitespaces)

        // Quick gate: line must contain INT or EXT somewhere (case-insensitive)
        let upper = stripped.uppercased()
        guard upper.contains("INT") || upper.contains("EXT") else { return nil }

        // Try Format A first (INT/EXT at start, after optional scene number)
        if let m = tryFormatA(stripped) { return m }

        // Fall back to Format B (INT/EXT in the middle)
        if let m = tryFormatB(stripped) { return m }

        return nil
    }

    // MARK: Format A — "INT. LOCATION - DAY"
    private static func tryFormatA(_ line: String) -> SlugMatch? {
        let withoutNumber = line.replacingOccurrences(
            of: #"^\d+[A-Za-z]?\.?\s+"#, with: "", options: .regularExpression
        ).trimmingCharacters(in: .whitespaces).uppercased()

        let validPrefixes = ["INT.", "EXT.", "INT/EXT", "EXT/INT", "I/E", "INT ", "EXT "]
        guard validPrefixes.contains(where: { withoutNumber.hasPrefix($0) }) else { return nil }

        guard let regex = slugRegexStart,
              let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line))
        else { return nil }

        let sceneNum = rangeStr(match, at: 1, in: line)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ".", with: "")
            .trimmingCharacters(in: .whitespaces)
        let rawIntExt = rangeStr(match, at: 2, in: line) ?? "INT"
        let location  = rangeStr(match, at: 3, in: line)?.trimmingCharacters(in: .whitespaces) ?? ""
        let timeOfDay = rangeStr(match, at: 4, in: line)?.trimmingCharacters(in: .whitespaces).uppercased() ?? "UNSPECIFIED"

        var clean = line
        if let n = rangeStr(match, at: 1, in: line) { clean = String(clean.dropFirst(n.count)).trimmingCharacters(in: .whitespaces) }
        if let t = rangeStr(match, at: 5, in: line) { clean = String(clean.dropLast(t.count)).trimmingCharacters(in: .whitespaces) }
        clean = clean.trimmingCharacters(in: .whitespaces)

        return SlugMatch(
            sceneNumber: (sceneNum?.isEmpty == false) ? sceneNum : nil,
            cleanSlug: clean.isEmpty ? line.trimmingCharacters(in: .whitespaces) : clean,
            intExt: normalizeIntExt(rawIntExt),
            location: location.isEmpty ? withoutNumber : location,
            timeOfDay: timeOfDay
        )
    }

    // MARK: Format B — "LOCATION - INT. - DAY"  or  "1. LOCATION - INT. - DAY"
    private static func tryFormatB(_ line: String) -> SlugMatch? {
        guard let regex = slugRegexMiddle,
              let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line))
        else { return nil }

        // Group 3 = INT/EXT — must be present
        guard let rawIntExt = rangeStr(match, at: 3, in: line), !rawIntExt.isEmpty else { return nil }

        let sceneNum = rangeStr(match, at: 1, in: line)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ".", with: "")
            .trimmingCharacters(in: .whitespaces)
        let location  = rangeStr(match, at: 2, in: line)?.trimmingCharacters(in: .whitespaces) ?? ""
        let timeOfDay = rangeStr(match, at: 4, in: line)?.trimmingCharacters(in: .whitespaces).uppercased() ?? "UNSPECIFIED"

        // Sanity check — location should be non-trivially short
        guard location.count > 1 else { return nil }

        // Reconstruct a clean slug in canonical form: "LOCATION - INT. - DAY"
        var clean = location
        clean += " - \(rawIntExt.uppercased())"
        if timeOfDay != "UNSPECIFIED" { clean += " - \(timeOfDay)" }

        return SlugMatch(
            sceneNumber: (sceneNum?.isEmpty == false) ? sceneNum : nil,
            cleanSlug: clean,
            intExt: normalizeIntExt(rawIntExt),
            location: location,
            timeOfDay: timeOfDay
        )
    }

    private static func rangeStr(_ match: NSTextCheckingResult, at i: Int, in str: String) -> String? {
        let r = match.range(at: i)
        guard r.location != NSNotFound, let range = Range(r, in: str) else { return nil }
        return String(str[range])
    }

    private static func normalizeIntExt(_ raw: String) -> String {
        let up = raw.uppercased()
        if up.contains("INT") && up.contains("EXT") { return "INT/EXT" }
        if up.contains("EXT") { return "EXT" }
        return "INT"
    }
}
