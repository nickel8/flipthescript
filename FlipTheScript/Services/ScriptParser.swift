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

    // Time of day keywords — kept separate so we can use them in the regex
    private static let todKeywords = [
        "DAY", "NIGHT", "DAWN", "DUSK", "CONTINUOUS", "LATER",
        "MORNING", "EVENING", "AFTERNOON", "MAGIC HOUR", "GOLDEN HOUR",
        "SUNRISE", "SUNSET", "PRE-DAWN", "MOMENTS LATER", "SAME TIME",
        "SAME", "FLASHBACK", "INTERCUT", "SERIES OF SHOTS"
    ]

    private static let intExtPattern = #"INT\.?(?:\/EXT\.?)?|EXT\.?(?:\/INT\.?)?|INT\/EXT|EXT\/INT|I\/E"#

    // Slug line regex — time of day is OPTIONAL (some scripts omit it)
    private static let slugRegex: NSRegularExpression? = try? NSRegularExpression(
        pattern: #"^(\d+[A-Za-z]?\.?\s+)?"# +         // optional scene number
                 #"(\#(intExtPattern))\s+"# +            // INT. / EXT. (required)
                 #"(.+?)"# +                             // location (greedy as little as possible)
                 #"(?:\s*[-–—]\s*([A-Z][A-Z\s/\.\-]+))?"# + // optional  - DAY/NIGHT/etc
                 #"(\s+\d+[A-Za-z]?\.?)?\s*$"#,         // optional trailing scene number (margin dupe)
        options: [.caseInsensitive]
    )

    private static func parseSlugLine(_ line: String) -> SlugMatch? {
        guard line.count > 5 else { return nil }

        // Must start with an INT/EXT marker (after optional scene number + whitespace)
        // This is more reliable than an uppercase ratio check
        let stripped = line.trimmingCharacters(in: .whitespaces)
        let withoutNumber = stripped.replacingOccurrences(
            of: #"^\d+[A-Za-z]?\.?\s+"#,
            with: "",
            options: .regularExpression
        ).trimmingCharacters(in: .whitespaces).uppercased()

        let validPrefixes = ["INT.", "EXT.", "INT/EXT", "EXT/INT", "I/E.", "INT ", "EXT "]
        guard validPrefixes.contains(where: { withoutNumber.hasPrefix($0) }) else { return nil }

        guard let regex = slugRegex,
              let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line))
        else { return nil }

        let sceneNum = rangeStr(match, at: 1, in: line)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ".", with: "")
            .trimmingCharacters(in: .whitespaces)
        let rawIntExt = rangeStr(match, at: 2, in: line) ?? "INT"
        let location  = rangeStr(match, at: 3, in: line)?.trimmingCharacters(in: .whitespaces) ?? ""
        let timeOfDay = rangeStr(match, at: 4, in: line)?.trimmingCharacters(in: .whitespaces).uppercased() ?? "UNSPECIFIED"

        // Build clean slug: remove leading scene number and trailing duplicated scene number
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
