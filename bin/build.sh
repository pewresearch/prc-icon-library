#!/bin/bash

# Check if @awesome.me folder exists in node_modules
if [ -d "node_modules/@awesome.me" ]; then
	# Get the first kit-xyz folder
	kit_folder=$(find node_modules/@awesome.me -maxdepth 1 -type d -name "kit-*" | head -n 1)

	# Check if kit folder exists
	if [ -d "$kit_folder" ]; then
		# Create build/icons folder if it doesn't exist
		mkdir -p build/icons

		echo "🚧 Building @prc/icon-library"

		# Copy icons/sprites folder to build/icons folder
		cp -r "$kit_folder/icons/sprites" build/icons

		echo "✅ @prc/icon-library ready"
	fi
else
	# Warn that there is no @awesome.me kit
	echo "🛑 No @awesome.me kit found in node_modules"
fi
