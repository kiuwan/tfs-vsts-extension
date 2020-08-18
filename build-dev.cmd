
@echo off
echo --- 
echo --- STARTING BUILD
echo --- 
echo --- Cleaning NPM node modules...
echo --- 
if exist "node_modules" rd /s /q "node_modules"
if exist "baseline-analysis-task\node_modules" rd /s /q "baseline-analysis-task\node_modules"
if exist "delivery-analysis-task\node_modules" rd /s /q "delivery-analysis-task\node_modules"

echo --- 
echo --- Cleaning transpiled JavaScript source and map files...
echo --- 
del /Q /F /S "*.js"
del /Q /F /S "*.js.map"
del /Q /F /S "*.d.ts"

echo --- 
echo --- Cleaning previous VSIX distributions...
echo --- 
del /Q /F /S "*.vsix"

echo --- 
echo --- Installing NPM dependencies...
echo --- 
call npm install
call mkdir baseline-analysis-task\node_modules
call xcopy /E /Q /Y node_modules baseline-analysis-task\node_modules\
call mkdir delivery-analysis-task\node_modules
call xcopy /E /Q /Y node_modules delivery-analysis-task\node_modules\

echo --- 
echo --- Transpiling TypeScript sources...
echo --- 
call tsc

echo --- 
echo --- Packaging extension with TFX-CLI tool and development configuration (vss-extension-dev.json)...
echo --- 
call tfx extension create --manifest-globs .\vss-extension-dev.json

echo --- 
echo --- BUILD FINISH
echo --- 
@echo on
