
@echo off
echo --- 
echo --- BUILD Started
echo --- 
:: ----------------------------------
:: Check if Node is installed
:: ----------------------------------
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed.
    exit /b 1
)

:: ----------------------------------
:: Check Node version (Require 20+)
:: ----------------------------------
for /f "tokens=1 delims=." %%v in ('node -v') do (
    set NODE_VERSION=%%v
)

set NODE_VERSION=%NODE_VERSION:v=%

echo Detected Node version: %NODE_VERSION%

if %NODE_VERSION% LSS 20 (
    echo ERROR: Node 20 or higher is required.
    exit /b 1
)

echo Node version check passed

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
call npx -y tfx-cli extension create

echo --- 
echo --- BUILD FINISH
echo --- 
@echo on