#!/usr/bin/env bash
# iOS-Release bauen und zu App Store Connect hochladen (nur auf dem Mac).
# Aufruf aus dem Projekt-Root:  bash scripts/release-ios.sh
#
# Voraussetzungen:
#   - Xcode + manuelle Distributions-Signierung (im App-Target der pbxproj verankert)
#   - ExportOptions.plist (Standard: ~/Desktop/mahjong-ios-export/ExportOptions.plist)
#   - ASC-API-Key in ~/.appstoreconnect/private_keys/ (KeyID VGHCB8Z8Q2)
#
# WICHTIG vorher: Hängt der vorige Build noch in der Prüfung? Dann erst abbrechen,
# sonst lässt sich der neue nicht einreichen:
#   python3 scripts/asc-status.py
set -euo pipefail
cd "$(dirname "$0")/.."

EXPORT_PLIST="${EXPORT_PLIST:-$HOME/Desktop/mahjong-ios-export/ExportOptions.plist}"
OUT="${OUT:-$HOME/Desktop/mahjong-ios-export}"
API_KEY_ID="VGHCB8Z8Q2"
API_ISSUER="0d4e473b-2807-4c66-9857-6b0eb78e62ce"

echo "== Vorprüfung =="
command -v xcodebuild >/dev/null || { echo "FEHLT: xcodebuild (Xcode installieren)"; exit 1; }
[ -f "$EXPORT_PLIST" ] || { echo "FEHLT: $EXPORT_PLIST"; exit 1; }

BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj | tr -dc '0-9')
VERSION=$(grep -m1 'MARKETING_VERSION' ios/App/App.xcodeproj/project.pbxproj | cut -d'=' -f2 | tr -d ' ;')
echo "   Version $VERSION · Build $BUILD"
echo "   Git: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"

echo
echo "== Prüfungen =="
npx tsc --noEmit
node scripts/check-figures.mjs > /dev/null && echo "   Figuren-Prüfung ok"

echo
echo "== Web-Bundle + Sync =="
npm run build
npx cap sync ios

ARCHIVE="$OUT/MahjongRoyale-$VERSION-b$BUILD.xcarchive"
mkdir -p "$OUT"

echo
echo "== Archivieren =="
(cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -destination "generic/platform=iOS" -archivePath "$ARCHIVE" archive)

echo
echo "== Exportieren =="
(cd ios/App && xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$EXPORT_PLIST" -exportPath "$OUT")

IPA="$OUT/App.ipa"
[ -f "$IPA" ] || { echo "IPA nicht gefunden: $IPA"; exit 1; }
ZIEL="$OUT/MahjongRoyale-ios-$VERSION-b$BUILD.ipa"
cp "$IPA" "$ZIEL"

echo
echo "== Hochladen zu App Store Connect =="
xcrun altool --upload-app -f "$ZIEL" -t ios --apiKey "$API_KEY_ID" --apiIssuer "$API_ISSUER"

echo
echo "✅ Build $BUILD hochgeladen: $ZIEL"
echo
echo "Nächste Schritte (Apple braucht ~15 min, bis der Build auftaucht):"
echo "  1. python3 scripts/asc-status.py          # Build sichtbar? alte Prüfung offen?"
echo "  2. In App Store Connect Build $BUILD der Version zuweisen und einreichen,"
echo "     dabei die phasenweise Freigabe (7 Tage) aktivieren."
