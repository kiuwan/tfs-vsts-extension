#!/bin/bash +x

echo "---"
echo "--- STARTING BUILD
echo "---"
echo "--- Cleaning NPM node modules...
echo "---"
rm -rf node_modules/
rm -rf baseline-analysis-task/node_modules/
rm -rf delivery-analysis-task/node_modules/

echo "---"
echo "--- Cleaning transpiled JavaScript source and map files..."
echo "---"
find . -name '*.js' -delete
find . -name '*.js.map' -delete
find . -name '*.d.ts' -delete

echo "---"
echo "--- Cleaning previous VSIX distributions..."
echo "---"
rm -f *.vsix

echo "---"
echo "--- Installing NPM dependencies..."
echo "---"
npm install
cp -rfL node_modules/ baseline-analysis-task/
cp -rfL node_modules/ delivery-analysis-task/

echo "---"
echo "--- Transpiling TypeScript sources..."
echo "---"
tsc -p tsconfig.json
tsc -p tsconfig-ext.json

echo "---"
echo "--- Packaging extension with TFX-CLI tool and default configuration (vss-extension.json)..."
echo "---"
tfx extension create

echo "---"
echo "--- BUILD FINISH"
echo "---"
