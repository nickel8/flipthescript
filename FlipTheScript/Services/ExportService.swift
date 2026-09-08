import Foundation
import SwiftUI

#if os(macOS)
import AppKit
#else
import UIKit
#endif

enum ExportService {

    // MARK: - PDF Export

    static func buildBreakdownPDF(script: Script, settings: ExportSettings = .shared) -> Data {
        let renderer = BreakdownPDFRenderer(script: script, settings: settings)
        return renderer.render()
    }

    // MARK: - XLSX Export

    static func buildBreakdownXLSX(script: Script, settings: ExportSettings = .shared) -> Data {
        XLSXBuilder.build(script: script, settings: settings)
    }

    // MARK: - CSV Export

    static func buildBreakdownCSV(script: Script) -> String {
        var rows: [[String]] = []

        rows.append([
            "Scene #", "INT/EXT", "Location", "Time of Day", "Page",
            "Synopsis", "Revision",
            "Characters", "Props", "Set Dressing", "Vehicles",
            "Weapons", "Greens", "SFX", "Costume", "Other"
        ])

        for scene in script.sortedScenes {
            let sheet = scene.breakdownSheet
            func elements(_ cat: ElementCategory) -> String {
                (sheet?.elements(for: cat).compactMap { $0.element?.name } ?? [])
                    .joined(separator: ", ")
            }
            rows.append([
                scene.sceneNumber,
                scene.intExt,
                scene.location,
                scene.timeOfDay,
                String(scene.pageStart),
                sheet?.synopsis ?? "",
                scene.revisionStatus.rawValue,
                elements(.characters),
                elements(.props),
                elements(.setDressing),
                elements(.vehicles),
                elements(.weapons),
                elements(.greens),
                elements(.sfx),
                elements(.costume),
                elements(.other),
            ])
        }

        return rows.map { row in
            row.map { cell in
                let escaped = cell.replacingOccurrences(of: "\"", with: "\"\"")
                return "\"\(escaped)\""
            }.joined(separator: ",")
        }.joined(separator: "\n")
    }
}

// MARK: - PDF Renderer

private class BreakdownPDFRenderer {
    let script: Script
    let settings: ExportSettings

    var pageWidth:  CGFloat { settings.pageSize.width }
    var pageHeight: CGFloat { settings.pageSize.height }
    let margin:     CGFloat = 36
    var contentWidth: CGFloat { pageWidth - margin * 2 }
    let bottomLimit: CGFloat = 40

    // Design tokens
    let colorDivider   = CGColor(red: 0.88, green: 0.88, blue: 0.88, alpha: 1)
    let colorLabel     = CGColor(red: 0.55, green: 0.55, blue: 0.58, alpha: 1)
    let colorBody      = CGColor(red: 0.12, green: 0.12, blue: 0.14, alpha: 1)
    let colorSlug      = CGColor(red: 0.35, green: 0.35, blue: 0.38, alpha: 1)
    let colorPageNum   = CGColor(red: 0.65, green: 0.65, blue: 0.68, alpha: 1)
    let colorWhite     = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
    let colorWhiteDim  = CGColor(red: 1, green: 1, blue: 1, alpha: 0.65)

    init(script: Script, settings: ExportSettings) {
        self.script = script
        self.settings = settings
    }

    // MARK: - Render

    func render() -> Data {
        let data = NSMutableData()
        var mediaBox = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)

        guard let consumer = CGDataConsumer(data: data),
              let ctx = CGContext(consumer: consumer, mediaBox: &mediaBox, nil)
        else { return Data() }

        let scenes = script.sortedScenes
        for (index, scene) in scenes.enumerated() {
            ctx.beginPage(mediaBox: &mediaBox)
            drawPage(ctx: ctx, scene: scene, index: index, total: scenes.count)
            ctx.endPage()
        }

        ctx.closePDF()
        return data as Data
    }

    // MARK: - Page layout
    // `y` throughout is a CG y-coordinate (0 = bottom of page, pageHeight = top)
    // We start at the top and move downward (decrement y).

    private func drawPage(ctx: CGContext, scene: ScriptScene, index: Int, total: Int) {

        // ── Header bar (accent colour) ───────────────────────────────────────
        let headerH: CGFloat = 40
        ctx.setFillColor(settings.accentCGColor)
        ctx.fill(CGRect(x: 0, y: pageHeight - headerH, width: pageWidth, height: headerH))

        // Logo (if set)
        var textOffsetX: CGFloat = 0
        #if os(macOS)
        if let logoData = settings.logoData,
           let nsImage  = NSImage(data: logoData),
           let cgImage  = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) {
            let logoH: CGFloat = 26
            let logoW: CGFloat = min(logoH * nsImage.size.width / nsImage.size.height, 80)
            let logoY: CGFloat = pageHeight - headerH + (headerH - logoH) / 2
            ctx.saveGState()
            ctx.translateBy(x: margin, y: logoY + logoH)
            ctx.scaleBy(x: 1, y: -1)
            ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: logoW, height: logoH))
            ctx.restoreGState()
            textOffsetX = logoW + 10
        }
        #endif

        let prodName = "\(script.production?.name ?? "Script")  ·  \(script.version)"
        put(ctx, text: prodName,
            x: margin + textOffsetX, baseline: pageHeight - headerH + 16,
            font: .courierBold(ofSize: 8),
            color: colorWhite,
            maxWidth: contentWidth * 0.65)

        let sceneLabel = "Scene \(index + 1) of \(total)"
        putRight(ctx, text: sceneLabel,
                 right: pageWidth - margin, baseline: pageHeight - headerH + 16,
                 font: .courier(ofSize: 8),
                 color: colorWhiteDim,
                 maxWidth: 140)

        // ── Scene identity block ─────────────────────────────────────────────
        var y = pageHeight - headerH - 18  // baseline for scene number

        // Revision pill (if applicable)
        if scene.revisionStatus != .unchanged {
            let isNew = scene.revisionStatus == .added
            let pillText  = isNew ? "NEW" : "REVISED"
            let pillColor = isNew
                ? CGColor(red: 0.10, green: 0.72, blue: 0.35, alpha: 1)
                : CGColor(red: 0.90, green: 0.50, blue: 0.05, alpha: 1)
            let pillBg    = isNew
                ? CGColor(red: 0.10, green: 0.72, blue: 0.35, alpha: 0.12)
                : CGColor(red: 0.90, green: 0.50, blue: 0.05, alpha: 0.12)
            let pillW: CGFloat = isNew ? 30 : 48
            let pillH: CGFloat = 14
            let pillX: CGFloat = margin
            let pillY: CGFloat = y - pillH + 2
            let pill = CGRect(x: pillX, y: pillY, width: pillW, height: pillH)
            ctx.setFillColor(pillBg)
            ctx.fillRoundedRect(pill, cornerRadius: 3)
            put(ctx, text: pillText,
                x: pillX + (isNew ? 5 : 6), baseline: pillY + 3.5,
                font: .courierBold(ofSize: 6.5), color: pillColor, maxWidth: pillW)
            y -= (pillH + 6)
        }

        // Scene number
        put(ctx, text: "SCENE  \(scene.sceneNumber)",
            x: margin, baseline: y,
            font: .courierBold(ofSize: settings.bodyFontSize.scene), color: colorBody, maxWidth: contentWidth - 60)

        // Script page (right-aligned, same baseline)
        putRight(ctx, text: "p. \(scene.pageStart)",
                 right: pageWidth - margin, baseline: y,
                 font: .courier(ofSize: 10), color: colorPageNum, maxWidth: 50)

        y -= 6

        // INT/EXT badge + slug line
        let intExtW: CGFloat = 36
        drawBadge(ctx, text: scene.intExt, x: margin, baselineY: y - 13, color: colorLabel)
        put(ctx, text: scene.location + (scene.timeOfDay == "UNSPECIFIED" ? "" : "  —  \(scene.timeOfDay)"),
            x: margin + intExtW + 6, baseline: y - 13,
            font: .courier(ofSize: 10), color: colorSlug,
            maxWidth: contentWidth - intExtW - 6)

        y -= 28

        divider(ctx, y: y)
        y -= 14

        // ── Synopsis ─────────────────────────────────────────────────────────
        let synopsis = scene.breakdownSheet?.synopsis
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if !synopsis.isEmpty {
            put(ctx, text: "SYNOPSIS",
                x: margin, baseline: y,
                font: .courierBold(ofSize: 7), color: colorLabel, maxWidth: contentWidth)
            y -= 14

            let synH = putWrapped(ctx, text: synopsis,
                                  x: margin, topY: y,
                                  font: .courier(ofSize: settings.bodyFontSize.body), color: colorBody,
                                  maxWidth: contentWidth)
            y -= synH + 14

            divider(ctx, y: y)
            y -= 14
        }

        // ── Elements ─────────────────────────────────────────────────────────
        guard let sheet = scene.breakdownSheet, !sheet.sceneElements.isEmpty else {
            put(ctx, text: "No elements tagged yet.",
                x: margin, baseline: y - 2,
                font: .courier(ofSize: 9), color: colorLabel, maxWidth: contentWidth)
            return
        }

        put(ctx, text: "ELEMENTS",
            x: margin, baseline: y,
            font: .courierBold(ofSize: 7), color: colorLabel, maxWidth: contentWidth)
        y -= 14

        // Two-column grid
        let gap:      CGFloat = 16
        let colWidth: CGFloat = (contentWidth - gap) / 2

        var leftY  = y
        var rightY = y
        var useLeft = true

        for category in settings.visibleCategories {
            let items = sheet.elements(for: category)
            guard !items.isEmpty else { continue }

            let colX  = useLeft ? margin : margin + colWidth + gap
            var colY  = useLeft ? leftY  : rightY

            // Guard against running off the bottom of the page
            guard colY > bottomLimit + 20 else { continue }

            let catColor = cgColor(from: category.color)
            let catBg    = lighten(catColor, by: 0.88)
            let catFg    = darken(catColor,  by: 0.25)

            // Category header row
            let catRowH: CGFloat = 17
            ctx.setFillColor(catBg)
            ctx.fillRoundedRect(CGRect(x: colX, y: colY - catRowH, width: colWidth, height: catRowH),
                                cornerRadius: 3)
            put(ctx, text: category.rawValue.uppercased(),
                x: colX + 7, baseline: colY - catRowH + 4,
                font: .courierBold(ofSize: settings.bodyFontSize.label), color: catFg, maxWidth: colWidth - 14)
            colY -= (catRowH + 2)

            // Items
            for se in items {
                guard colY > bottomLimit else { break }
                let name = se.element?.name ?? "Unknown"
                put(ctx, text: "· \(name)",
                    x: colX + 8, baseline: colY - 10,
                    font: .courier(ofSize: settings.bodyFontSize.body - 1), color: colorBody, maxWidth: colWidth - 16)
                colY -= 13
            }
            colY -= 6

            if useLeft { leftY = colY } else { rightY = colY }
            useLeft.toggle()
        }
    }

    // MARK: - Drawing primitives

    /// Draw a single-line text string. `baseline` is the CG baseline y-coordinate.
    private func put(
        _ ctx: CGContext,
        text: String,
        x: CGFloat,
        baseline: CGFloat,
        font: CTFont,
        color: CGColor,
        maxWidth: CGFloat
    ) {
        let attrs: [CFString: Any] = [
            kCTFontAttributeName: font,
            kCTForegroundColorAttributeName: color
        ]
        let attrStr = CFAttributedStringCreate(nil, text as CFString, attrs as CFDictionary)!
        let line = CTLineCreateWithAttributedString(attrStr)

        // Truncate if wider than maxWidth
        let lineWidth = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        let drawLine: CTLine
        if lineWidth > maxWidth {
            let truncToken = CTLineCreateWithAttributedString(
                CFAttributedStringCreate(nil, "…" as CFString, attrs as CFDictionary)!
            )
            drawLine = CTLineCreateTruncatedLine(line, Double(maxWidth), .end, truncToken) ?? line
        } else {
            drawLine = line
        }

        ctx.saveGState()
        ctx.textMatrix = .identity
        ctx.textPosition = CGPoint(x: x, y: baseline)
        CTLineDraw(drawLine, ctx)
        ctx.restoreGState()
    }

    private func putRight(
        _ ctx: CGContext,
        text: String,
        right: CGFloat,
        baseline: CGFloat,
        font: CTFont,
        color: CGColor,
        maxWidth: CGFloat
    ) {
        let attrs: [CFString: Any] = [
            kCTFontAttributeName: font,
            kCTForegroundColorAttributeName: color
        ]
        let attrStr = CFAttributedStringCreate(nil, text as CFString, attrs as CFDictionary)!
        let line = CTLineCreateWithAttributedString(attrStr)
        let w = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        let x = max(right - min(w, maxWidth), right - maxWidth)

        ctx.saveGState()
        ctx.textMatrix = .identity
        ctx.textPosition = CGPoint(x: x, y: baseline)
        CTLineDraw(line, ctx)
        ctx.restoreGState()
    }

    /// Draw wrapped text. `topY` is the CG y for the top of the first line.
    /// Returns height consumed.
    @discardableResult
    private func putWrapped(
        _ ctx: CGContext,
        text: String,
        x: CGFloat,
        topY: CGFloat,
        font: CTFont,
        color: CGColor,
        maxWidth: CGFloat
    ) -> CGFloat {
        let attrs: [CFString: Any] = [
            kCTFontAttributeName: font,
            kCTForegroundColorAttributeName: color
        ]
        let attrStr = NSAttributedString(string: text, attributes: attrs as [NSAttributedString.Key: Any])
        let framesetter = CTFramesetterCreateWithAttributedString(attrStr as CFAttributedString)

        let suggested = CTFramesetterSuggestFrameSizeWithConstraints(
            framesetter,
            CFRange(location: 0, length: attrStr.length),
            nil,
            CGSize(width: maxWidth, height: CGFloat.greatestFiniteMagnitude),
            nil
        )
        let height = ceil(suggested.height) + 6

        let rect = CGRect(x: x, y: topY - height, width: maxWidth, height: height)
        let path  = CGPath(rect: rect, transform: nil)
        let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: 0), path, nil)

        ctx.saveGState()
        ctx.textMatrix = .identity
        CTFrameDraw(frame, ctx)
        ctx.restoreGState()

        return height
    }

    private func divider(_ ctx: CGContext, y: CGFloat) {
        ctx.setStrokeColor(colorDivider)
        ctx.setLineWidth(0.5)
        ctx.move(to: CGPoint(x: margin, y: y))
        ctx.addLine(to: CGPoint(x: pageWidth - margin, y: y))
        ctx.strokePath()
    }

    private func drawBadge(_ ctx: CGContext, text: String, x: CGFloat, baselineY: CGFloat, color: CGColor) {
        let bg = lighten(color, by: 0.6)
        let w: CGFloat = 34
        let h: CGFloat = 14
        ctx.setFillColor(bg)
        ctx.fillRoundedRect(CGRect(x: x, y: baselineY - 2, width: w, height: h), cornerRadius: 3)
        put(ctx, text: text, x: x + 4, baseline: baselineY + 1,
            font: .courierBold(ofSize: 6.5), color: darken(color, by: 0.2), maxWidth: w - 8)
    }

    // MARK: - Color helpers

    private func cgColor(from swiftUIColor: Color) -> CGColor {
        #if os(macOS)
        return NSColor(swiftUIColor).cgColor
        #else
        return UIColor(swiftUIColor).cgColor
        #endif
    }

    private func lighten(_ color: CGColor, by amount: CGFloat) -> CGColor {
        guard let c = color.components, c.count >= 3 else { return color }
        return CGColor(red: c[0] + (1 - c[0]) * amount,
                       green: c[1] + (1 - c[1]) * amount,
                       blue:  c[2] + (1 - c[2]) * amount,
                       alpha: 1)
    }

    private func darken(_ color: CGColor, by amount: CGFloat) -> CGColor {
        guard let c = color.components, c.count >= 3 else { return color }
        return CGColor(red: c[0] * (1 - amount),
                       green: c[1] * (1 - amount),
                       blue:  c[2] * (1 - amount),
                       alpha: 1)
    }
}

// MARK: - CGContext rounded rect helper

private extension CGContext {
    func fillRoundedRect(_ rect: CGRect, cornerRadius r: CGFloat) {
        let path = CGMutablePath()
        path.addRoundedRect(in: rect, cornerWidth: r, cornerHeight: r)
        addPath(path)
        fillPath()
    }
}

// MARK: - Font helpers

private extension CTFont {
    /// Courier (the industry-standard screenplay font)
    static func courier(ofSize size: CGFloat) -> CTFont {
        CTFontCreateWithName("Courier" as CFString, size, nil)
    }
    static func courierBold(ofSize size: CGFloat) -> CTFont {
        CTFontCreateWithName("Courier-Bold" as CFString, size, nil)
    }
}

private extension CGColor {
    static var black: CGColor { CGColor(red: 0, green: 0, blue: 0, alpha: 1) }
    static var white: CGColor { CGColor(red: 1, green: 1, blue: 1, alpha: 1) }
}
