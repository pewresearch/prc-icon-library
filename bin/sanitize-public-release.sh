#!/usr/bin/env bash
# Strip Font Awesome Pro sprites before this plugin is pushed to the public
# pewresearch/prc-icon-library repository. Invoked from ship-plugins in
# .github/workflows/build-release.yml.

set -euo pipefail

# When run from ship-plugins, cwd is the parent of the extracted plugin dir.
PLUGIN_NAME="${PLUGIN_NAME:-prc-icon-library}"
SPRITES="./${PLUGIN_NAME}/build/icons/sprites"

if [ ! -d "$SPRITES" ]; then
	echo "No sprites directory at ${SPRITES}; nothing to sanitize."
	exit 0
fi

# Keep brands.svg only (FA Free Brands — SIL OFL 1.1 / CC BY 4.0).
# custom-icons.svg and Pro styles are not redistributed publicly.
find "$SPRITES" -type f -name '*.svg' ! -name 'brands.svg' -delete

echo "Remaining sprites:"
ls -la "$SPRITES"
