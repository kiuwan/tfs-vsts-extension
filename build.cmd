
@echo off
echo --- 
echo --- BUILD Started
echo --- 
echo --- Deleting node modules
echo --- 
if exist "node_modules" rd /s /q "node_modules"
if exist "baseline-analysis-task\node_modules" rd /s /q "baseline-analysis-task\node_modules"
if exist "delivery-analysis-task\node_modules" rd /s /q "delivery-analysis-task\node_modules"

echo --- 
echo --- Deleting old transpiled JS source and map files
echo --- 
del /Q /F /S "*.js"
del /Q /F /S "*.js.map"
del /Q /F /S "*.d.ts"

echo --- 
echo --- Deleting old vsix distributions
echo --- 
del /Q /F /S "*.vsix"

echo --- 
echo --- Installing node dependencies
echo --- 
call npm install

call mkdir baseline-analysis-task\node_modules
call xcopy /E /Q /Y node_modules baseline-analysis-task\node_modules\
call mkdir delivery-analysis-task\node_modules
call xcopy /E /Q /Y node_modules delivery-analysis-task\node_modules\

echo --- 
echo --- Transpiling TypeScript source files
echo --- 
call npx tsc -p tsconfig.json
call npx tsc -p tsconfig-ext.json

echo --- 
echo --- Packaging extension with TFX-CLI tool using vss-extension.json
echo --- 
call tfx extension create

echo --- 
echo --- BUILD FINISH
echo --- 
@echo on