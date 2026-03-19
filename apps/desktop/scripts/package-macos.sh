#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DESKTOP_DIR}/../.." && pwd)"

export PATH="${HOME}/.cargo/bin:${PATH}"

cd "${REPO_ROOT}"
npx tauri build --bundles app

DMG_DIR="${DESKTOP_DIR}/src-tauri/target/release/bundle/dmg"
ARCHIVE_DIR="${DESKTOP_DIR}/src-tauri/target/release/bundle/archive"
TAURI_CONF_PATH="${DESKTOP_DIR}/src-tauri/tauri.conf.json"
PRODUCT_NAME="$(node -p "require(process.argv[1]).productName" "${TAURI_CONF_PATH}")"
APP_BUNDLE_NAME="${PRODUCT_NAME}.app"
APP_PATH="${DESKTOP_DIR}/src-tauri/target/release/bundle/macos/${APP_BUNDLE_NAME}"

ARCH_RAW="$(uname -m)"
case "${ARCH_RAW}" in
  arm64)
    ARCH_SUFFIX="aarch64"
    ;;
  x86_64)
    ARCH_SUFFIX="x86_64"
    ;;
  *)
    ARCH_SUFFIX="${ARCH_RAW}"
    ;;
esac

VERSION="$(node -p "require(process.argv[1]).version" "${TAURI_CONF_PATH}")"
SAFE_PRODUCT_NAME="${PRODUCT_NAME// /_}"
DMG_PATH="${DMG_DIR}/${SAFE_PRODUCT_NAME}_${VERSION}_${ARCH_SUFFIX}.dmg"
ARCHIVE_PATH="${ARCHIVE_DIR}/${SAFE_PRODUCT_NAME}_${VERSION}_${ARCH_SUFFIX}.tar.gz"
BUILD_NUMBER="$(node -e '
  const fs = require("fs");
  const path = require("path");
  const [productName, ...dirs] = process.argv.slice(1);
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const compactPattern = new RegExp(`^${escape(productName)}(\\d+)\\.(?:dmg|tar\\.gz)$`);
  const appPattern = new RegExp(`^${escape(productName)} (\\d+)\\.app$`);
  let max = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    for (const entry of fs.readdirSync(dir)) {
      const match = entry.match(compactPattern) || entry.match(appPattern);
      if (match) {
        max = Math.max(max, Number(match[1]));
      }
    }
  }

  console.log(String(max + 1));
' "${PRODUCT_NAME}" "${DMG_DIR}" "${ARCHIVE_DIR}")"
NUMBERED_PREFIX="${PRODUCT_NAME}${BUILD_NUMBER}"
NUMBERED_DMG_PATH="${DMG_DIR}/${NUMBERED_PREFIX}.dmg"
NUMBERED_ARCHIVE_PATH="${ARCHIVE_DIR}/${NUMBERED_PREFIX}.tar.gz"
NUMBERED_APP_PATH="${ARCHIVE_DIR}/${PRODUCT_NAME} ${BUILD_NUMBER}.app"
STAGING_DIR="$(mktemp -d /tmp/orbital-dmg.XXXXXX)"

cleanup() {
  rm -rf "${STAGING_DIR}"
}

trap cleanup EXIT

mkdir -p "${DMG_DIR}" "${ARCHIVE_DIR}"
cp -R "${APP_PATH}" "${STAGING_DIR}/${APP_BUNDLE_NAME}"
ln -s /Applications "${STAGING_DIR}/Applications"
hdiutil create -volname "${PRODUCT_NAME}" -srcfolder "${STAGING_DIR}" -ov -format UDZO "${DMG_PATH}"
(cd "$(dirname "${APP_PATH}")" && tar -czf "${ARCHIVE_PATH}" "${APP_BUNDLE_NAME}")
cp "${DMG_PATH}" "${NUMBERED_DMG_PATH}"
cp "${ARCHIVE_PATH}" "${NUMBERED_ARCHIVE_PATH}"
cp -R "${APP_PATH}" "${NUMBERED_APP_PATH}"

echo "Created ${DMG_PATH}"
echo "Created ${ARCHIVE_PATH}"
echo "Created ${NUMBERED_DMG_PATH}"
echo "Created ${NUMBERED_ARCHIVE_PATH}"
echo "Created ${NUMBERED_APP_PATH}"
