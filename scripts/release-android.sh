#!/usr/bin/env bash
# Android-Release bauen (nur auf dem Mac: braucht Android-SDK + Upload-Keystore).
# Aufruf aus dem Projekt-Root:  bash scripts/release-android.sh
#
# Danach hochladen mit:
#   python3 scripts/play-upload.py --aab <pfad>.aab --fraction 0.2 --notes "..."
set -euo pipefail
cd "$(dirname "$0")/.."

JAVA_HOME_DEFAULT="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DEFAULT}"

echo "== Vorprüfung =="
[ -f android/upload-keystore.jks ] || { echo "FEHLT: android/upload-keystore.jks (nicht im Repo, aus dem Backup holen)"; exit 1; }
[ -f android/keystore.properties ] || { echo "FEHLT: android/keystore.properties"; exit 1; }
[ -d "$JAVA_HOME" ] || { echo "FEHLT: JAVA_HOME ($JAVA_HOME) — Pfad anpassen oder Android Studio installieren"; exit 1; }

VC=$(grep -m1 'versionCode' android/app/build.gradle | tr -dc '0-9')
VN=$(grep -m1 'versionName' android/app/build.gradle | cut -d'"' -f2)
echo "   versionCode $VC · versionName $VN"
echo "   Git: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  echo "   WARNUNG: Arbeitsverzeichnis nicht sauber — es wird der ARBEITSSTAND gebaut, nicht der Commit."
fi

echo
echo "== Prüfungen =="
npx tsc --noEmit
node scripts/check-figures.mjs > /dev/null && echo "   Figuren-Prüfung ok"

echo
echo "== Web-Bundle + Sync =="
npm run build
npx cap sync android

echo
echo "== Signiertes AAB bauen =="
(cd android && ./gradlew --quiet bundleRelease)

AAB=android/app/build/outputs/bundle/release/app-release.aab
[ -f "$AAB" ] || { echo "AAB nicht gefunden: $AAB"; exit 1; }

# Test-Werbe-IDs dürfen im Release nicht vorkommen (siehe CLAUDE.md).
if unzip -p "$AAB" base/dex/classes.dex 2>/dev/null | grep -qa 3940256099942544; then
  echo "ABBRUCH: Google-Test-Werbe-ID im Bundle gefunden — USE_TEST_ADS steht auf true!"
  exit 1
fi

ZIEL="$HOME/Desktop/MahjongRoyale-android-${VN}-vc${VC}.aab"
cp "$AAB" "$ZIEL"
echo
echo "✅ fertig: $ZIEL  ($(du -h "$ZIEL" | cut -f1))"
echo
echo "Hochladen (erst an 20 % der Nutzer):"
echo "  python3 scripts/play-upload.py --aab \"$ZIEL\" --fraction 0.2 \\"
echo "    --notes \"Levelwechsel repariert, schwerere Level, Werbung verdeckt die Bedienknöpfe nicht mehr, Vibration.\""
echo
echo "Später an alle ausrollen:"
echo "  python3 scripts/play-upload.py --promote $VC --complete"
