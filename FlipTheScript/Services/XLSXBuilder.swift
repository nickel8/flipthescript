import Foundation

// MARK: - Public entry point

enum XLSXBuilder {

    /// Columns produced in both the preview and the xlsx file.
    static let columns: [(header: String, keyPath: KeyPath<ScriptScene, String>, width: Double)] = [
        ("Scene #",      \.sceneNumber,  8),
        ("I/E",          \.intExt,       8),
        ("Location",     \.location,     32),
        ("Time of Day",  \.timeOfDayDisplay, 14),
        ("Page",         \.pageDisplay,   6),
    ]

    static let elementColumns: [(header: String, category: ElementCategory, width: Double)] = [
        ("Synopsis",     .characters,    0),   // synopsis is special-cased
        ("Characters",   .characters,    25),
        ("Props",        .props,         22),
        ("Set Dressing", .setDressing,   22),
        ("Vehicles",     .vehicles,      18),
        ("Weapons",      .weapons,       18),
        ("Greens",       .greens,        18),
        ("SFX",          .sfx,           18),
        ("Costume",      .costume,       22),
        ("Other",        .other,         20),
    ]

    static func build(script: Script, settings: ExportSettings) -> Data {
        let accent = xlsxARGB(settings.accentHex)
        var zip = ZipWriter()
        zip.addFile(path: "[Content_Types].xml",         data: contentTypes())
        zip.addFile(path: "_rels/.rels",                  data: rootRels())
        zip.addFile(path: "xl/workbook.xml",              data: workbook(script: script))
        zip.addFile(path: "xl/_rels/workbook.xml.rels",   data: workbookRels())
        zip.addFile(path: "xl/styles.xml",                data: styles(accent: accent))
        zip.addFile(path: "xl/worksheets/sheet1.xml",     data: sheet(script: script, settings: settings))
        return zip.finalize()
    }

    // "#1B2D4F" → "FF1B2D4F"
    static func xlsxARGB(_ hex: String) -> String {
        "FF" + (hex.hasPrefix("#") ? String(hex.dropFirst()) : hex).uppercased()
    }

    // MARK: - XML parts

    private static func contentTypes() -> Data {
        encode("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\
        <Default Extension="xml" ContentType="application/xml"/>\
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\
        <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>\
        </Types>
        """)
    }

    private static func rootRels() -> Data {
        encode("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\
        </Relationships>
        """)
    }

    private static func workbook(script: Script) -> Data {
        let name = esc(script.version)
        return encode("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" \
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\
        <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="22000" windowHeight="14000"/></bookViews>\
        <sheets><sheet name="\(name)" sheetId="1" r:id="rId1"/></sheets>\
        </workbook>
        """)
    }

    private static func workbookRels() -> Data {
        encode("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>\
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\
        </Relationships>
        """)
    }

    private static func styles(accent: String) -> Data {
        // fills: [0]=none (required), [1]=gray125 (required), [2]=accent, [3]=altRow
        encode("""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\
        <fonts count="2">\
        <font><sz val="10"/><name val="Calibri"/></font>\
        <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>\
        </fonts>\
        <fills count="4">\
        <fill><patternFill patternType="none"/></fill>\
        <fill><patternFill patternType="gray125"/></fill>\
        <fill><patternFill patternType="solid"><fgColor rgb="\(accent)"/></patternFill></fill>\
        <fill><patternFill patternType="solid"><fgColor rgb="FFF0F3F4"/></patternFill></fill>\
        </fills>\
        <borders count="2">\
        <border><left/><right/><top/><bottom/><diagonal/></border>\
        <border>\
        <left style="thin"><color rgb="FFCCCCCC"/></left>\
        <right style="thin"><color rgb="FFCCCCCC"/></right>\
        <top style="thin"><color rgb="FFCCCCCC"/></top>\
        <bottom style="thin"><color rgb="FFCCCCCC"/></bottom>\
        <diagonal/>\
        </border>\
        </borders>\
        <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\
        <cellXfs count="3">\
        <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">\
        <alignment wrapText="1" vertical="top"/></xf>\
        <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>\
        <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">\
        <alignment wrapText="1" vertical="top"/></xf>\
        </cellXfs>\
        </styleSheet>
        """)
    }

    // MARK: - Worksheet

    private static func sheet(script: Script, settings: ExportSettings) -> Data {
        let scenes = script.sortedScenes
        let headers = allHeaders(settings: settings)
        let widths  = allWidths(settings: settings)
        let lastCol = colLetter(headers.count - 1)

        var xml = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\
        <sheetViews><sheetView workbookViewId="0">\
        <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>\
        <selection pane="bottomLeft" activeCell="A2" sqref="A2"/>\
        </sheetView></sheetViews>\
        <sheetFormatPr defaultRowHeight="15" customHeight="1"/>\
        <cols>
        """

        for (i, w) in widths.enumerated() {
            let n = i + 1
            xml += "<col min=\"\(n)\" max=\"\(n)\" width=\"\(w)\" customWidth=\"1\"/>"
        }
        xml += "</cols><sheetData>"

        // Header row (style 1 = bold white on accent)
        xml += "<row r=\"1\" ht=\"18\" customHeight=\"1\">"
        for (i, h) in headers.enumerated() {
            xml += "<c r=\"\(colLetter(i))1\" s=\"1\" t=\"inlineStr\"><is><t>\(esc(h))</t></is></c>"
        }
        xml += "</row>"

        // Data rows
        for (ri, scene) in scenes.enumerated() {
            let rowNum = ri + 2
            let style  = ri % 2 == 0 ? "0" : "2"   // alternating fill
            let values = allValues(scene: scene, settings: settings)

            xml += "<row r=\"\(rowNum)\">"
            for (ci, v) in values.enumerated() {
                xml += "<c r=\"\(colLetter(ci))\(rowNum)\" s=\"\(style)\" t=\"inlineStr\"><is><t>\(esc(v))</t></is></c>"
            }
            xml += "</row>"
        }

        xml += "</sheetData>"
        xml += "<autoFilter ref=\"A1:\(lastCol)1\"/>"
        xml += "</worksheet>"
        return encode(xml)
    }

    // MARK: - Column helpers

    static func allHeaders(settings: ExportSettings) -> [String] {
        var h = columns.map(\.header)
        h.append("Synopsis")
        h += settings.visibleCategories.map(\.rawValue)
        return h
    }

    static func allWidths(settings: ExportSettings) -> [Double] {
        var w = columns.map(\.width)
        w.append(45)   // synopsis
        w += settings.visibleCategories.map { cat in
            elementColumns.first(where: { $0.category == cat })?.width ?? 20
        }
        return w
    }

    static func allValues(scene: ScriptScene, settings: ExportSettings) -> [String] {
        let sheet = scene.breakdownSheet
        func elements(_ cat: ElementCategory) -> String {
            (sheet?.elements(for: cat).compactMap { $0.element?.name } ?? []).joined(separator: ", ")
        }
        var v: [String] = [
            scene.sceneNumber,
            scene.intExt,
            scene.location,
            scene.timeOfDay == "UNSPECIFIED" ? "" : scene.timeOfDay,
            "\(scene.pageStart)",
            sheet?.synopsis.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
        ]
        v += settings.visibleCategories.map { elements($0) }
        return v
    }

    // MARK: - Utilities

    private static func colLetter(_ index: Int) -> String {
        var n = index
        var result = ""
        repeat {
            result = String(UnicodeScalar(65 + n % 26)!) + result
            n = n / 26 - 1
        } while n >= 0
        return result
    }

    private static func esc(_ s: String) -> String {
        s.replacingOccurrences(of: "&",  with: "&amp;")
         .replacingOccurrences(of: "<",  with: "&lt;")
         .replacingOccurrences(of: ">",  with: "&gt;")
         .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private static func encode(_ s: String) -> Data { Data(s.utf8) }
}

// MARK: - ScriptScene convenience

private extension ScriptScene {
    var timeOfDayDisplay: String { timeOfDay == "UNSPECIFIED" ? "" : timeOfDay }
    var pageDisplay: String { "\(pageStart)" }
}

// MARK: - Minimal ZIP writer (STORED, no compression)

private struct ZipWriter {
    private var archive  = Data()
    private var directory = Data()
    private var count: UInt16 = 0

    mutating func addFile(path: String, data content: Data) {
        let name   = Data(path.utf8)
        let crc    = CRC32.compute(content)
        let size   = UInt32(content.count)
        let offset = UInt32(archive.count)

        // Local file header
        archive += sig(0x04034b50)
        archive += u16(20); archive += u16(0); archive += u16(0)  // version, flags, compression
        archive += u16(0);  archive += u16(0)                     // mod time, mod date
        archive += u32(crc); archive += u32(size); archive += u32(size)
        archive += u16(UInt16(name.count)); archive += u16(0)
        archive += name
        archive += content

        // Central directory entry
        directory += sig(0x02014b50)
        directory += u16(20); directory += u16(20)  // version made by, version needed
        directory += u16(0);  directory += u16(0); directory += u16(0)  // flags, compression
        directory += u16(0);  directory += u16(0)  // mod time, mod date
        directory += u32(crc); directory += u32(size); directory += u32(size)
        directory += u16(UInt16(name.count)); directory += u16(0); directory += u16(0)
        directory += u16(0); directory += u16(0); directory += u32(0)  // disk, internal, external
        directory += u32(offset)
        directory += name

        count += 1
    }

    mutating func finalize() -> Data {
        let dirOffset = UInt32(archive.count)
        let dirSize   = UInt32(directory.count)
        archive += directory
        // End of central directory
        archive += sig(0x06054b50)
        archive += u16(0); archive += u16(0)    // disk number, start disk
        archive += u16(count); archive += u16(count)
        archive += u32(dirSize); archive += u32(dirOffset)
        archive += u16(0)  // comment length
        return archive
    }

    private func sig(_ v: UInt32) -> Data { u32(v) }
    private func u16(_ v: UInt16) -> Data { withBytes(of: v.littleEndian) }
    private func u32(_ v: UInt32) -> Data { withBytes(of: v.littleEndian) }

    private func withBytes<T>(of value: T) -> Data {
        var v = value
        return withUnsafeBytes(of: &v) { Data($0) }
    }
}

// MARK: - CRC32

private enum CRC32 {
    static func compute(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xFFFF_FFFF
        for byte in data {
            crc ^= UInt32(byte)
            for _ in 0..<8 {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB8_8320 : crc >> 1
            }
        }
        return ~crc
    }
}
