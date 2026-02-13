#!/bin/bash

REQUIRED_NODE_MAJOR=20

echo "---"
echo "--- STARTING BUILD"
echo "---"
# -----------------------------
# Check if Node is installed
# -----------------------------
if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js is not installed."
    exit 1
fi
# -----------------------------
# Check Node version
# -----------------------------
NODE_VERSION=$(node -v)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)

echo "Detected Node version: $NODE_VERSION"

if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
    echo "ERROR: Node $REQUIRED_NODE_MAJOR or higher is required."
    echo "Please install Node $REQUIRED_NODE_MAJOR+ and try again."
    exit 1
fi

echo "Node version check passed"
echo "---"
echo "--- Deleting NPM node modules"
echo "---"
rm -rf node_modules/
rm -rf baseline-analysis-task/node_modules/
rm -rf delivery-analysis-task/node_modules/

echo "---"
echo "--- Deleting transpiled JS source and map files"
echo "---"
find . -name '*.js' -delete
find . -name '*.js.map' -delete
find . -name '*.d.ts' -delete

echo "---"
echo "--- Deleting old vsix distributions"
echo "---"
rm -f *.vsix

echo "---"
echo "--- Installing node dependencies"
echo "---"
npm install
cp -rfL node_modules/ baseline-analysis-task/
cp -rfL node_modules/ delivery-analysis-task/

echo "---"
echo "--- Transpiling TypeScript source files"
echo "---"
npx tsc -p tsconfig.json
npx tsc -p tsconfig-ext.json

echo "---"
echo "--- Packaging extension with TFX-CLI tool using vss-extension.json"
echo "---"
npx -y tfx-cli extension create

echo "---"
echo "--- BUILD FINISH"
echo "---"
