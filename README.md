# TFS / Azure DevOps Extension

This project builds the **Azure DevOps extension** and generates a `.vsix` package.

---

# Prerequisites

Before building the extension, ensure the following tools are installed.

## 1. Node.js

**Required version:** `Node.js 20.x`

Verify installation:

```bash
node -v
```

Expected output:

```
v20.x.x
```

If Node 20 is not installed, download it from:  
https://nodejs.org/

---

## 2. NPM

`npm` is included with Node.js.

Verify installation:

```bash
npm -v
```

---

# Build Instructions

The project supports:

- **Windows** (Command Prompt / PowerShell)
- **Git Bash / Linux **

## Option 1: Windows

Run:

```cmd
build.cmd
```

or

```cmd
.\build.cmd
```

---

## Option 2: Git Bash / Linux 

Run:

```bash
./build.sh
```

---

# What the Build Script Does

The build process performs the following steps:

1. Deletes existing `node_modules`
2. Removes previously transpiled `.js`, `.js.map`, and `.d.ts` files
3. Deletes old `.vsix` files
4. Installs dependencies using `npm install`
5. Transpiles TypeScript sources
6. Packages the extension using:

```bash
npx -y tfx-cli extension create
```

---

# Output Location

After a successful build, the generated `.vsix` file will be located in the **project root directory**:

```
<project-root>/
```

Example:

```
kiuwan-publisher.kiuwan-analysis-extension-<version>.vsix
```


