
@echo off
echo --- 
echo --- STARTING BUILD
echo --- 
echo --- Cleaning NPM node modules...
echo --- 
if exist "node_modules" rd /s /q "node_modules"

echo --- 
echo --- Cleaning transpiled JavaScript source and map files...
echo --- 
del /Q /F /S "*.js"
del /Q /F /S "*.js.map"

echo --- 
echo --- Cleaning previous VSIX distributions...
echo --- 
del /Q /F /S "*.vsix"

echo --- 
echo --- Installing NPM dependencies...
echo --- 
call npm install

echo --- 
echo --- Transpiling TypeScript sources...
echo --- 
call tsc

echo --- 
echo --- Packaging extension with TFX-CLI tool and default configuration (vss-extension.json)...
echo --- 
call tfx extension create --manifest-globs .\vss-extension-dev.json

echo --- 
echo --- BUILD FINISH
echo --- 
@echo on
