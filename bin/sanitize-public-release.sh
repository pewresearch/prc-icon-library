#!/usr/bin/env bash
# Safety net for the public pewresearch/prc-icon-library sibling repo.
# Font Awesome Pro weight sprites are not shipped. If a leftover
# build/icons/sprites directory appears, remove it.

set -euo pipefail

PLUGIN_NAME="${PLUGIN_NAME:-prc-icon-library}"
SPRITES="./${PLUGIN_NAME}/build/icons/sprites"

if [ ! -d "$SPRITES" ]; then
	echo "No sprites directory at ${SPRITES}; nothing to sanitize."
	exit 0
fi

rm -rf "$SPRITES"
echo "Removed leftover ${SPRITES} (FA Pro weight sprites are not redistributed)."
