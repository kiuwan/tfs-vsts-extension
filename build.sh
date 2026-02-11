#!/bin/bash +x

echo "---"
echo "--- STARTING BUILD"
echo "---"
echo "--- Cleaning NPM node modules"
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
tfx extension create

echo "---"
echo "--- BUILD FINISH"
echo "---"
