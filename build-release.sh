#!/usr/bin/env bash
# build-release.sh
#
# Full hands-off release pipeline for FlipTheScript.
#
# Usage:
#   ./build-release.sh <version>
#   ./build-release.sh 1.10
#
# What it does:
#   preflight → bump version → archive → export → notarize → staple
#   → Sparkle sig → appcast → download page → commit + push → GitHub release
#
# One-time prerequisites:
#   1. Xcode → Settings → Accounts → Manage Certificates → + → Developer ID Application
#   2. Store notarization credentials:
#      xcrun notarytool store-credentials "FlipTheScript" \
#          --key ~/Downloads/AuthKey_XXXXXXXX.p8 \
#          --key-id "XXXXXXXX" \
#          --issuer "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
#   3. gh auth login (GitHub CLI at ~/bin/gh)

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠️  $*${RESET}"; }
die()  { echo -e "${RED}✗ $*${RESET}"; exit 1; }
sep()  { echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

# ── Args ──────────────────────────────────────────────────────────────────────

YES=false
NEW_VERSION=""
for arg in "$@"; do
    case "$arg" in
        -y|--yes) YES=true ;;
        *) NEW_VERSION="$arg" ;;
    esac
done

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: ./build-release.sh <version> [-y]"
    echo "  e.g. ./build-release.sh 1.10"
    echo "  e.g. ./build-release.sh 1.10 -y   # non-interactive"
    exit 1
fi

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
    die "Version must be X.Y or X.Y.Z — got: $NEW_VERSION"
fi

# ── Config ────────────────────────────────────────────────────────────────────

SCHEME="FlipTheScript"
PROJECT="FlipTheScript.xcodeproj"
PBXPROJ="$PROJECT/project.pbxproj"
NOTARYTOOL_PROFILE="FlipTheScript"
BUILD_DIR="$(pwd)/build"
WEB_DIR="$(pwd)/web"
GH=~/bin/gh

# ══════════════════════════════════════════════════════════════════════════════
sep; echo " PREFLIGHT CHECKS"; sep

# Developer ID cert
security find-identity -v -p codesigning | grep -q "Developer ID Application" \
    || die "No 'Developer ID Application' cert in Keychain.\n  Xcode → Settings → Accounts → Manage Certificates → + → Developer ID Application"
ok "Developer ID certificate"

# Notarization credentials
NOTARY_CHECK=$(xcrun notarytool history --keychain-profile "$NOTARYTOOL_PROFILE" 2>&1 || true)
if echo "$NOTARY_CHECK" | grep -q "agreement"; then
    die "Apple legal agreement expired or missing.\n  → Sign in at https://appstoreconnect.apple.com and accept any pending agreements, then re-run."
elif echo "$NOTARY_CHECK" | grep -qi "error\|invalid\|not found"; then
    die "Notarization credentials not stored.\n  xcrun notarytool store-credentials \"$NOTARYTOOL_PROFILE\" --key ~/Downloads/AuthKey_XXXXX.p8 --key-id XXXXX --issuer <uuid>"
fi
ok "Notarization credentials (profile: $NOTARYTOOL_PROFILE)"

# GitHub CLI
"$GH" auth status &>/dev/null \
    || die "gh not authenticated. Run: ~/bin/gh auth login"
ok "GitHub CLI authenticated"

# Sparkle sign_update (optional — app uses manual updates, not Sparkle in-app updater)
SIGN_UPDATE=$(find /tmp/SparkleForSPM/bin \
    ~/Library/Developer/Xcode/DerivedData/FlipTheScript-*/SourcePackages/artifacts \
    ~/Library/Caches/org.sparkle-project.Sparkle \
    -name "sign_update" 2>/dev/null | head -1 || true)
if [ -n "$SIGN_UPDATE" ]; then
    ok "Sparkle sign_update: $SIGN_UPDATE"
else
    warn "sign_update not found — appcast will be updated without EdDSA signature"
fi

# ExportOptions.plist
[ -f "ExportOptions.plist" ] \
    || die "ExportOptions.plist not found in project root"
ok "ExportOptions.plist"

# ══════════════════════════════════════════════════════════════════════════════
sep; echo " VERSION BUMP"; sep

CURRENT_VERSION=$(grep -m1 "MARKETING_VERSION" "$PBXPROJ" | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?')
CURRENT_BUILD=$(grep -m1 "CURRENT_PROJECT_VERSION" "$PBXPROJ" | grep -oE '[0-9]+')
NEW_BUILD=$((CURRENT_BUILD + 1))

echo ""
echo "  Current : v${CURRENT_VERSION} (build ${CURRENT_BUILD})"
echo "  New     : v${NEW_VERSION} (build ${NEW_BUILD})"

# ── Uncommitted source changes ─────────────────────────────────────────────

DIRTY=$(git status --porcelain | grep -Ev "^.? build/" | grep -Ev "^\?\?" || true)
if [ -n "$DIRTY" ]; then
    echo ""
    warn "Uncommitted changes in source files:"
    echo "$DIRTY"
    echo ""
    if [ "$YES" = true ]; then
        git add -A -- ':!build'
        git commit -m "chore: pre-release"
        ok "Source changes auto-committed"
    else
        read -r -p "  Commit these before releasing? [Y/n] " WANT_COMMIT
        if [[ "${WANT_COMMIT:-Y}" =~ ^[Yy]$ ]]; then
            read -r -p "  Commit message: " COMMIT_MSG
            git add -A -- ':!build'
            git commit -m "$COMMIT_MSG"
            ok "Source changes committed"
        fi
    fi
fi

# ── Confirm ────────────────────────────────────────────────────────────────

echo ""
echo "  Plan: bump → archive → sign → notarize → staple → publish"
echo ""
if [ "$YES" = false ]; then
    read -r -p "  Release v${NEW_VERSION} now? [Y/n] " GO
    [[ "${GO:-Y}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

# ── Bump xcodeproj ─────────────────────────────────────────────────────────

sed -i '' \
    "s/MARKETING_VERSION = [0-9][0-9.]*/MARKETING_VERSION = ${NEW_VERSION}/g" \
    "$PBXPROJ"
sed -i '' \
    "s/CURRENT_PROJECT_VERSION = [0-9][0-9]*/CURRENT_PROJECT_VERSION = ${NEW_BUILD}/g" \
    "$PBXPROJ"

# Verify the bump took
VERIFY_VER=$(grep -m1 "MARKETING_VERSION" "$PBXPROJ" | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?')
VERIFY_BUILD=$(grep -m1 "CURRENT_PROJECT_VERSION" "$PBXPROJ" | grep -oE '[0-9]+')
[ "$VERIFY_VER" = "$NEW_VERSION" ]   || die "Marketing version bump failed (got: $VERIFY_VER)"
[ "$VERIFY_BUILD" = "$NEW_BUILD" ]   || die "Build number bump failed (got: $VERIFY_BUILD)"
ok "xcodeproj bumped → v${NEW_VERSION} build ${NEW_BUILD}"

# ══════════════════════════════════════════════════════════════════════════════
sep; echo " BUILD"; sep

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

ARCHIVE_PATH="$BUILD_DIR/FlipTheScript.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
APP_PATH="$EXPORT_PATH/FlipTheScript.app"
ZIP_NAME="FlipTheScript-${NEW_VERSION}.zip"
ZIP_PATH="$BUILD_DIR/$ZIP_NAME"

# Archive
echo ""
echo "── Archiving ──"
xcodebuild archive \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM=CA889WK9CJ \
    | xcpretty 2>/dev/null || true

[ -d "$ARCHIVE_PATH" ] || die "Archive failed — $ARCHIVE_PATH not found"
ok "Archive complete"

# Export
echo ""
echo "── Exporting (Developer ID) ──"
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$(pwd)/ExportOptions.plist" \
    | xcpretty 2>/dev/null || true

[ -d "$APP_PATH" ] || die "Export failed — $APP_PATH not found"
ok "Export complete"

# Verify signature
echo ""
echo "── Verifying signature ──"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type exec --verbose "$APP_PATH" \
    && ok "Gatekeeper: OK" \
    || warn "Gatekeeper: not yet notarized (expected at this stage)"

# ══════════════════════════════════════════════════════════════════════════════
sep; echo " NOTARIZE & STAPLE"; sep

# Zip for notarization
echo ""
echo "── Zipping ──"
cd "$EXPORT_PATH"
ditto -c -k --keepParent "FlipTheScript.app" "$ZIP_PATH"
cd - > /dev/null
ok "Zip: $ZIP_PATH"

# Notarize
echo ""
echo "── Notarizing (1–3 min) ──"
xcrun notarytool submit "$ZIP_PATH" \
    --keychain-profile "$NOTARYTOOL_PROFILE" \
    --wait \
    --timeout 30m
ok "Notarization accepted"

# Staple
echo ""
echo "── Stapling ──"
STAPLE_DIR="$BUILD_DIR/stapled"
mkdir -p "$STAPLE_DIR"
ditto -x -k "$ZIP_PATH" "$STAPLE_DIR"
xcrun stapler staple "$STAPLE_DIR/FlipTheScript.app"
xcrun stapler validate "$STAPLE_DIR/FlipTheScript.app"
ok "Staple validated"

# Re-zip from stapled app
rm "$ZIP_PATH"
cd "$STAPLE_DIR"
ditto -c -k --keepParent --norsrc --noextattr "FlipTheScript.app" "$ZIP_PATH"
cd - > /dev/null
ok "Stapled zip: $ZIP_PATH"

# ══════════════════════════════════════════════════════════════════════════════
sep; echo " APPCAST + DOWNLOAD PAGE"; sep

FILESIZE=$(stat -f%z "$ZIP_PATH")
PUBDATE=$(date -R)

# Sparkle EdDSA signature (optional — app no longer embeds Sparkle updater)
SIGNATURE=""
if [ -n "$SIGN_UPDATE" ]; then
    echo ""
    SIGN_OUTPUT=$("$SIGN_UPDATE" "$ZIP_PATH")
    SIGNATURE=$(echo "$SIGN_OUTPUT" | grep -o 'sparkle:edSignature="[^"]*"' | cut -d'"' -f2)
    [ -n "$SIGNATURE" ] && ok "Sparkle EdDSA signature generated" || warn "Sparkle signature generation failed — continuing without"
fi

# Update appcast.xml
echo ""
APPCAST="$WEB_DIR/public/appcast.xml"
if [ -n "$SIGNATURE" ]; then
    ED_SIG_LINE="        sparkle:edSignature=\"${SIGNATURE}\""
else
    ED_SIG_LINE=""
fi
NEW_ITEM="<item>
    <title>Version ${NEW_VERSION}</title>
    <pubDate>${PUBDATE}</pubDate>
    <sparkle:version>${NEW_BUILD}</sparkle:version>
    <sparkle:shortVersionString>${NEW_VERSION}</sparkle:shortVersionString>
    <sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>
    <enclosure
        url=\"https://github.com/nickel8/flipthescript/releases/download/v${NEW_VERSION}/${ZIP_NAME}\"
${ED_SIG_LINE}
        length=\"${FILESIZE}\"
        type=\"application/octet-stream\"
    />
</item>"
TMPITEM=$(mktemp)
printf '%s' "$NEW_ITEM" > "$TMPITEM"
awk -v item_file="$TMPITEM" '
/<\/language>/ {
    print
    print ""
    while ((getline line < item_file) > 0) print line
    next
}
{ print }
' "$APPCAST" > "${APPCAST}.tmp" && mv "${APPCAST}.tmp" "$APPCAST"
rm -f "$TMPITEM"
ok "appcast.xml updated"

# Update download page
OPEN_PAGE="$WEB_DIR/app/open/page.tsx"
sed -i '' \
    "s|releases/download/v[0-9.]*/FlipTheScript-[0-9.]*.zip|releases/download/v${NEW_VERSION}/FlipTheScript-${NEW_VERSION}.zip|g" \
    "$OPEN_PAGE"
sed -i '' \
    "s|FlipTheScript-[0-9.]*.zip|FlipTheScript-${NEW_VERSION}.zip|g" \
    "$OPEN_PAGE"
ok "Download page updated"

# ══════════════════════════════════════════════════════════════════════════════
sep; echo " COMMIT + PUSH + RELEASE"; sep

# Commit version bump to main repo
echo ""
git add "$PBXPROJ"
git commit -m "chore: bump version to ${NEW_VERSION} (build ${NEW_BUILD})"
git tag "v${NEW_VERSION}"
git push
git push --tags
ok "Main repo: committed, tagged v${NEW_VERSION}, pushed"

# Commit + push web changes
echo ""
cd "$WEB_DIR"
git add public/appcast.xml app/open/page.tsx
git commit -m "chore: release v${NEW_VERSION}"
git push
cd - > /dev/null
ok "Web repo: committed and pushed"

# Create GitHub release
echo ""
"$GH" release create "v${NEW_VERSION}" \
    "${ZIP_PATH}#${ZIP_NAME}" \
    --repo nickel8/flipthescript \
    --title "v${NEW_VERSION}" \
    --notes "See https://www.flip-the-script.app for what's new."
ok "GitHub release created"

# ══════════════════════════════════════════════════════════════════════════════

cat <<DONE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FlipTheScript v${NEW_VERSION} (build ${NEW_BUILD}) — SHIPPED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GitHub : https://github.com/nickel8/flipthescript/releases/tag/v${NEW_VERSION}
  App    : https://www.flip-the-script.app/open
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DONE
