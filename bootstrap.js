#!/usr/bin/env node

const os = require('os')
const path = require('path')
const fs = require('fs')
const { spawn, execSync } = require('child_process')

const PLATFORM = os.platform()
const ARCH = process.arch === 'arm64' ? 'arm64' : 'x64'
const IS_PKG = !!process.pkg
const INSTALL_DIR = PLATFORM === 'win32'
  ? path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE || os.homedir(), 'UniPath')
  : path.join(os.homedir(), '.unipath')
const NODE_DIR = path.join(INSTALL_DIR, '.node')
const REPO_ZIP = 'https://github.com/sadlu/Unipath---demo/archive/refs/heads/main.zip'
const LOG_FILE = path.join(os.tmpdir(), 'unipath-setup.log')

const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RED = '\x1b[31m'
const NC = '\x1b[0m'

const LOG = []
function logConsole(level, msg) {
  const line = `[${new Date().toISOString()}] ${level}: ${msg}`
  LOG.push(line)
  console.log(msg)
}
function info(m)  { logConsole('INFO', `${CYAN}${m}${NC}`) }
function ok(m)    { logConsole('OK',   `${GREEN}${m}${NC}`) }
function warn(m)  { logConsole('WARN', `${YELLOW}${m}${NC}`) }
function fail(m)  { logConsole('FAIL', `${RED}${m}${NC}`) }

function saveLog() {
  try { fs.writeFileSync(LOG_FILE, LOG.join('\n'), 'utf8') } catch {}
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    logConsole('RUN', `  > ${cmd} ${args.join(' ')}`)
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts })
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Exit code ${code}`)))
    p.on('error', reject)
  })
}

function runCapture(cmd, args) {
  try {
    const out = execSync(`${cmd} ${args.join(' ')}`, { encoding: 'utf8', timeout: 10000 }).trim()
    return out
  } catch (e) {
    return ''
  }
}

function hasGit() {
  try { execSync('git --version', { stdio: 'pipe', timeout: 5000 }); return true }
  catch { return false }
}

// ─── Portable Node.js ───

const NODE_VERSION = '20.19.0'
const NODE_URL = ARCH === 'arm64'
  ? `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-arm64.zip`
  : `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`

function findNodeExe() {
  // Check PATH first
  const pathNode = runCapture('node', ['--version'])
  if (pathNode) return { exe: 'node', npm: 'npm', from: 'PATH' }
  // Check bundled with pkg
  if (IS_PKG) {
    try {
      const bundled = path.dirname(process.execPath)
      const test = runCapture(path.join(bundled, 'node'), ['--version'])
      if (test) return { exe: path.join(bundled, 'node'), npm: path.join(bundled, 'npm'), from: 'bundled' }
    } catch {}
  }
  // Check portable node in INSTALL_DIR
  const nodeExe = path.join(NODE_DIR, 'node.exe')
  if (fs.existsSync(nodeExe)) {
    const ver = runCapture(nodeExe, ['--version'])
    if (ver) return { exe: nodeExe, npm: path.join(NODE_DIR, 'npm'), from: 'portable' }
  }
  return null
}

async function installNodePortable() {
  info(`\n  Node.js not found. Downloading Node.js ${NODE_VERSION} (${ARCH}) portable ...`)
  const zipPath = path.join(os.tmpdir(), 'node-portable.zip')
  fs.mkdirSync(NODE_DIR, { recursive: true })

  // Download
  info(`  URL: ${NODE_URL}`)
  await run('curl', ['-#Lo', zipPath, NODE_URL])
  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1e6) {
    fail('  Download failed or file too small')
    return false
  }

  // Extract
  info('  Extracting ...')
  const psScript = `
    $zip = '${zipPath.replace(/'/g, "''")}'
    $dest = '${NODE_DIR.replace(/'/g, "''")}'
    $extract = Join-Path $env:TEMP 'node-extract'
    if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
    New-Item -ItemType Directory -Path $extract -Force | Out-Null
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $src = Get-ChildItem $extract | Where-Object { $_.Name -like 'node-v*' } | Select-Object -First 1
    if ($src) {
      Get-ChildItem $src.FullName | Move-Item -Destination $dest -Force
    }
  `
  const psFile = path.join(os.tmpdir(), 'node-extract.ps1')
  fs.writeFileSync(psFile, psScript)
  try {
    await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile])
  } finally {
    try { fs.rmSync(psFile); fs.rmSync(zipPath) } catch {}
  }

  // Verify
  const nodeExe = path.join(NODE_DIR, 'node.exe')
  if (fs.existsSync(nodeExe)) {
    ok(`  Node.js ${NODE_VERSION} ready at ${NODE_DIR}`)
    // Add to PATH for this process
    process.env.PATH = `${NODE_DIR};${process.env.PATH}`
    return true
  }
  fail('  Failed to set up Node.js')
  return false
}

// ─── Download Source ───

async function downloadSource() {
  info('\n[2/4] Downloading UniPath source code ...')
  fs.mkdirSync(INSTALL_DIR, { recursive: true })

  if (fs.existsSync(path.join(INSTALL_DIR, 'package.json'))) {
    ok('  Already downloaded at ' + INSTALL_DIR)
    return true
  }

  if (hasGit()) {
    info('  Cloning via git ...')
    try {
      await run('git', ['clone', 'https://github.com/sadlu/Unipath---demo.git', INSTALL_DIR])
      if (fs.existsSync(path.join(INSTALL_DIR, 'package.json'))) { ok('  Cloned OK'); return true }
    } catch (e) {
      warn('  Git clone failed: ' + e.message)
    }
  }

  info('  Downloading zip from GitHub ...')
  const zipPath = path.join(os.tmpdir(), 'unipath.zip')
  await run('curl', ['-#Lo', zipPath, REPO_ZIP])

  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000) {
    fail('  Download failed')
    return false
  }

  info('  Extracting ...')
  const psScript = `
    $zip = '${zipPath.replace(/'/g, "''")}'
    $dest = '${INSTALL_DIR.replace(/'/g, "''")}'
    $extract = Join-Path $env:TEMP 'unipath-extract'
    if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
    New-Item -ItemType Directory -Path $extract -Force | Out-Null
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $src = Get-ChildItem $extract | Where-Object { $_.Name -like 'Unipath*' } | Select-Object -First 1
    if ($src) {
      Get-ChildItem $src.FullName | Move-Item -Destination $dest -Force
    }
  `
  const psFile = path.join(os.tmpdir(), 'extract.ps1')
  fs.writeFileSync(psFile, psScript)
  try {
    await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile])
  } finally {
    try { fs.rmSync(psFile); fs.rmSync(zipPath) } catch {}
  }

  if (fs.existsSync(path.join(INSTALL_DIR, 'package.json'))) {
    ok('  Source downloaded OK')
    return true
  }
  fail('  Failed to download source')
  return false
}

// ─── Setup & Launch ───

async function setupAndLaunch() {
  info('\n[3/4] Installing npm dependencies ...')
  await run('npm', ['install', '--legacy-peer-deps'], { cwd: INSTALL_DIR })

  info('\n[4/4] Building the app ...')
  await run('npm', ['run', 'build'], { cwd: INSTALL_DIR })

  ok('\n=============================================')
  ok('  UniPath setup complete!')
  ok(`  Installed at: ${INSTALL_DIR}`)
  ok('=============================================')

  // Desktop shortcut (launch.bat that sets PATH and runs npm start)
  try {
    const desktop = path.join(os.homedir(), 'Desktop')
    const batPath = path.join(INSTALL_DIR, 'launch.bat')
    fs.writeFileSync(batPath, `@echo off\r\nset PATH=${NODE_DIR};%PATH%\r\ncd /d "${INSTALL_DIR}"\r\nnpm start\r\npause\r\n`)
    const psScript = `
      $WS = New-Object -ComObject WScript.Shell
      $SC = $WS.CreateShortcut("${desktop.replace(/'/g, "''")}\\UniPath.lnk")
      $SC.TargetPath = "${batPath.replace(/'/g, "''")}"
      $SC.WorkingDirectory = "${INSTALL_DIR.replace(/'/g, "''")}"
      $SC.Description = "UniPath - Career Coach"
      $SC.Save()
    `
    const sf = path.join(os.tmpdir(), 'shortcut.ps1')
    fs.writeFileSync(sf, psScript)
    await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', sf])
    try { fs.rmSync(sf) } catch {}
    ok('  Desktop shortcut created')
  } catch (e) {
    warn('  Shortcut creation skipped: ' + e.message)
  }

  ok('\n  UniPath is ready! Double-click the desktop shortcut to launch.')
  ok(`  Or run: cd "${INSTALL_DIR}" && npm start`)
}

// ─── Main ───

async function main() {
  console.log(`
   _    _       _ _   _       ____  _     _
  | |  | |     | | | (_)     |  _ \\| |__ (_)_ __
  | |  | |_ __ | | |_ _  __ _| |_) | '_ \\| | '_ \\
  | |  | | '_ \\| | __| |/ _\` |  __/| | | | | |_) |
  | |__| | | | | | |_| | (_| | |   | | | | | .__/
   \\____/|_| |_|_|\\__,_|\\__,_|_|   |_| |_|_|_|
  `)
  console.log(`${BOLD}UniPath — Windows Installer${NC}\n`)
  info(`Install dir : ${INSTALL_DIR}`)
  info(`Node dir    : ${NODE_DIR}`)
  info(`Architecture: ${ARCH}`)
  info(`Log file    : ${LOG_FILE}\n`)

  // ── Step 1: Node.js ──
  info('[1/4] Checking Node.js ...')
  const nodeInfo = findNodeExe()
  if (nodeInfo) {
    const ver = runCapture(nodeInfo.exe, ['--version'])
    ok(`  Node.js ${ver} found (${nodeInfo.from})`)
    // Ensure our portable node dir is on PATH for npm
    if (nodeInfo.from === 'portable') {
      process.env.PATH = `${NODE_DIR};${process.env.PATH}`
    }
  } else if (PLATFORM === 'win32') {
    warn('  Node.js not found — will download portable version')
    const ok2 = await installNodePortable()
    if (!ok2) {
      fail('  Could not set up Node.js')
      saveLog()
      process.exit(1)
    }
  } else {
    fail('  Node.js >= 18 required. Install from https://nodejs.org and re-run.')
    saveLog()
    process.exit(1)
  }

  // ── Step 2: Download source ──
  const srcOk = await downloadSource()
  if (!srcOk) {
    saveLog()
    process.exit(1)
  }

  // ── Step 3+4: npm install, build, finish ──
  await setupAndLaunch()

  saveLog()
  ok(`\nLog saved to: ${LOG_FILE}`)
  console.log('\nClosing in 15 seconds...')
  await new Promise(r => setTimeout(r, 15000))
}

main().catch(async (err) => {
  fail(`\nSetup failed: ${err.message}`)
  if (err.stack) fail(err.stack)
  saveLog()
  fail(`\nLog saved to: ${LOG_FILE}`)
  fail('Please share this log file so I can help fix the issue.')
  console.log('\nClosing in 20 seconds...')
  await new Promise(r => setTimeout(r, 20000))
  process.exit(1)
})
