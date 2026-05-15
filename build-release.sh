#!/usr/bin/env bash
# build-release.sh
#
# Full release pipeline for FlipTheScript:
#   archive → export → notarize → staple → zip → GitHub release instructions
#
# Prerequisites (one-time setup):
#   1. Xcode → Settings → Accounts → Manage Certificates → + → Developer ID Application
#   2. Create an App Store Connect API key (Developer role) at:
#      https://appstoreconnect.apple.com/access/integrations/api
#   3. Store notarization credentials once:
#      xcrun notarytool store-credentials "FlipTheScript" \
#          --key ~/Downloads/AuthKey_XXXXXXXX.p8 \
#          --key-id "XXXXXXXX" \
#          --issuer "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
#
# Usage:
#   ./build-release.sh
#
# Output:
#   build/FlipTheScript-<version>.zip   — ready to upload to GitHub releases

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

SCHEME="FlipTheScript"
PROJECT="FlipTheScript.xcodeproj"
BUNDLE_ID="Hoddy.FlipTheScript"
NOTARYTOOL_PROFILE="FlipTheScript"   # name used in store-credentials above
BUILD_DIR="$(pwd)/build"

# ── Preflight ─────────────────────────────────────────────────────────────────

echo "── Preflight checks ──"

if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    echo "ERROR: No 'Developer ID Application' certificate found in Keychain."
    echo "       Open Xcode → Settings → Accounts → Manage Certificates → + → Developer ID Application"
    exit 1
fi

if ! xcrun notarytool history --keychain-profile "$NOTARYTOOL_PROFILE" &>/dev/null; then
    echo "ERROR: Notarization credentials not stored."
    echo "       Run: xcrun notarytool store-credentials \"$NOTARYTOOL_PROFILE\" --key ~/Downloads/AuthKey_XXXXX.p8 --key-id XXXXX --issuer <uuid>"
    exit 1
fi

# ── Read version ──────────────────────────────────────────────────────────────

VERSION=$(xcodebuild -project "$PROJECT" -scheme "$SCHEME" -showBuildSettings \
    | grep "MARKETING_VERSION" | head -1 | awk '{print $3}')
BUILD=$(xcodebuild -project "$PROJECT" -scheme "$SCHEME" -showBuildSettings \
    | grep "CURRENT_PROJECT_VERSION" | head -1 | awk '{print $3}')

echo "── Building FlipTheScript v${VERSION} (build ${BUILD}) ──"

# ── Clean build dir ───────────────────────────────────────────────────────────

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

ARCHIVE_PATH="$BUILD_DIR/FlipTheScript.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
APP_PATH="$EXPORT_PATH/FlipTheScript.app"
ZIP_NAME="FlipTheScript-${VERSION}.zip"
ZIP_PATH="$BUILD_DIR/$ZIP_NAME"

# ── Archive ───────────────────────────────────────────────────────────────────

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

if [ ! -d "$ARCHIVE_PATH" ]; then
    echo "ERROR: Archive failed — $ARCHIVE_PATH not found"
    exit 1
fi
echo "Archive OK: $ARCHIVE_PATH"

# ── Export ────────────────────────────────────────────────────────────────────

echo ""
echo "── Exporting (Developer ID) ──"
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$(pwd)/ExportOptions.plist" \
    | xcpretty 2>/dev/null || true

if [ ! -d "$APP_PATH" ]; then
    echo "ERROR: Export failed — $APP_PATH not found"
    exit 1
fi
echo "Export OK: $APP_PATH"

# ── Verify code signature ─────────────────────────────────────────────────────

echo ""
echo "── Verifying signature ──"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type exec --verbose "$APP_PATH" && echo "Gatekeeper: OK"

# ── Zip ───────────────────────────────────────────────────────────────────────

echo ""
echo "── Creating zip ──"
cd "$EXPORT_PATH"
ditto -c -k --keepParent "FlipTheScript.app" "$ZIP_PATH"
cd - > /dev/null
echo "Zip OK: $ZIP_PATH"

# ── Notarize ─────────────────────────────────────────────────────────────────

echo ""
echo "── Notarizing (this takes 1-3 minutes) ──"
xcrun notarytool submit "$ZIP_PATH" \
    --keychain-profile "$NOTARYTOOL_PROFILE" \
    --wait \
    --timeout 30m

# ── Staple ───────────────────────────────────────────────────────────────────

echo ""
echo "── Stapling notarization ticket ──"
# Staple to the .app inside the zip — need to unzip, staple, re-zip
STAPLE_DIR="$BUILD_DIR/stapled"
mkdir -p "$STAPLE_DIR"
ditto -x -k "$ZIP_PATH" "$STAPLE_DIR"
xcrun stapler staple "$STAPLE_DIR/FlipTheScript.app"
xcrun stapler validate "$STAPLE_DIR/FlipTheScript.app" && echo "Staple: OK"

# Recreate zip from stapled app.
# --norsrc --noextattr: omit resource forks and extended attributes from the zip
# so Archive Utility doesn't create ._AppleDouble files on extraction, which
# would appear as unsealed files and break Gatekeeper verification.
rm "$ZIP_PATH"
cd "$STAPLE_DIR"
ditto -c -k --keepParent --norsrc --noextattr "FlipTheScript.app" "$ZIP_PATH"
cd - > /dev/null
echo "Stapled zip: $ZIP_PATH"

cat <<DONE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FlipTheScript v${VERSION} (build ${BUILD}) — DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Zip: $ZIP_PATH

 Next steps:
   1. Create a GitHub release tagged v${VERSION}
   2. Upload $ZIP_NAME as the release asset
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DONE
