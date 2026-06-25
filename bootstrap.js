#!/usr/bin/env node

const os = require('os')
const path = require('path')
const fs = require('fs')
const { spawn, execSync } = require('child_process')
const readline = require('readline')

const IS_INTERACTIVE = process.stdin.isTTY
const rl = IS_INTERACTIVE ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const ask = (q) => {
  if (!IS_INTERACTIVE) return Promise.resolve('y')
  return new Promise((r) => rl.question(q, r))
}

const PLATFORM = os.platform()
const IS_PKG = !!process.pkg
const INSTALL_DIR = PLATFORM === 'win32'
  ? path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE || os.homedir(), 'UniPath')
  : path.join(os.homedir(), '.unipath')
const REPO_ZIP = 'https://github.com/sadlu/Unipath---demo/archive/refs/heads/main.zip'

const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RED = '\x1b[31m'
const NC = '\x1b[0m'

function info(m)  { console.log(`${CYAN}${m}${NC}`) }
function ok(m)    { console.log(`${GREEN}${m}${NC}`) }
function warn(m)  { console.log(`${YELLOW}${m}${NC}`) }
function fail(m)  { console.log(`${RED}${m}${NC}`) }

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts })
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Exit code ${code}`)))
    p.on('error', reject)
  })
}

function runCapture(cmd, args) {
  try {
    return execSync(`${cmd} ${args.join(' ')}`, { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function hasGit() {
  try { execSync('git --version', { stdio: 'pipe' }); return true }
  catch { return false }
}

// ── Checks ──

async function checkNode() {
  info('[1/5] Checking Node.js ...')
  const ver = runCapture('node', ['--version']).replace(/v/g, '')
  if (!ver) {
    warn('  Node.js not found')
    return false
  }
  const major = parseInt(ver.split('.')[0], 10)
  if (major >= 18) {
    ok(`  Node.js ${ver} found`)
    return true
  }
  warn(`  Node.js ${ver} found, but >= 18 required`)
  return false
}

async function checkNpm() {
  info('[2/5] Checking npm ...')
  const ver = runCapture('npm', ['--version'])
  if (ver) {
    ok(`  npm ${ver} found`)
    return true
  }
  warn('  npm not found')
  return false
}

// ── Installers ──

async function installNodeWindows() {
  warn('\n  Node.js >= 18 is required. Install now?')
  const a = await ask('  Download and install Node.js? [Y/n] ')
  if (a.toLowerCase() === 'n') {
    fail('  Please install Node.js from https://nodejs.org and re-run setup')
    return false
  }
  info('  Downloading Node.js 20 LTS for Windows ...')
  const url = 'https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi'
  const dest = path.join(os.tmpdir(), 'node-installer.msi')
  await run('curl', ['-Lo', dest, url])
  info('  Running Node.js installer ...')
  await run('msiexec', ['/i', dest, '/quiet', '/norestart'])
  info('  Node.js installed. It may take a moment to be available in PATH.')
  info('  Please re-run this setup after installation completes.')
  return true
}

// ── Download Source ──

async function downloadSource() {
  info('\n[3/5] Downloading UniPath source code ...')

  fs.mkdirSync(INSTALL_DIR, { recursive: true })

  if (fs.existsSync(path.join(INSTALL_DIR, 'package.json'))) {
    ok('  Source already exists at ' + INSTALL_DIR)
    return true
  }

  // Try git clone first (faster, smaller)
  if (hasGit()) {
    info('  Cloning repository via git ...')
    try {
      await run('git', ['clone', 'https://github.com/sadlu/Unipath---demo.git', INSTALL_DIR])
      ok('  Repository cloned successfully')
      return true
    } catch (e) {
      warn('  Git clone failed, falling back to zip download ...')
    }
  }

  // Fallback: download zip
  info('  Downloading zip archive from GitHub ...')
  const zipPath = path.join(os.tmpdir(), 'unipath-main.zip')
  await run('curl', ['-Lo', zipPath, REPO_ZIP])

  info('  Extracting ...')

  if (PLATFORM === 'win32') {
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
    await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile])
    try { fs.rmSync(psFile) } catch {}
  } else {
    const extractDir = path.join(os.tmpdir(), 'unipath-extract')
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true })
    fs.mkdirSync(extractDir, { recursive: true })
    await run('tar', ['-xf', zipPath, '-C', extractDir])
    const items = fs.readdirSync(extractDir)
    const srcDir = items.find(i => i.startsWith('Unipath---demo'))
    if (!srcDir) { fail('  Could not find source in extracted archive'); return false }
    await run('cp', ['-r', path.join(extractDir, srcDir, '*'), INSTALL_DIR])
    try { fs.rmSync(extractDir, { recursive: true }) } catch {}
  }

  try { fs.rmSync(zipPath) } catch {}

  if (fs.existsSync(path.join(INSTALL_DIR, 'package.json'))) {
    ok('  Source downloaded successfully')
    return true
  }
  fail('  Failed to download source code')
  return false
}

// ── Setup & Launch ──

async function setupAndLaunch() {
  info('\n[4/5] Installing dependencies ...')
  await run('npm', ['install'], { cwd: INSTALL_DIR })

  info('\n[5/5] Building the app ...')
  await run('npm', ['run', 'build'], { cwd: INSTALL_DIR })

  ok('\n================================================')
  ok('  UniPath setup complete!')
  ok(`  Installed at: ${INSTALL_DIR}`)
  ok('================================================')

  // Create desktop shortcut on Windows
  if (PLATFORM === 'win32') {
    try {
      const desktop = path.join(os.homedir(), 'Desktop')
      const psScript = `
        $WS = New-Object -ComObject WScript.Shell
        $SC = $WS.CreateShortcut("${desktop}\\UniPath.lnk")
        $SC.TargetPath = "cmd.exe"
        $SC.Arguments = "/c cd /d ${INSTALL_DIR} && npm start"
        $SC.WorkingDirectory = "${INSTALL_DIR}"
        $SC.Description = "UniPath - Career Coach App"
        $SC.Save()
      `
      fs.writeFileSync(path.join(os.tmpdir(), 'shortcut.ps1'), psScript)
      await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(os.tmpdir(), 'shortcut.ps1')])
      ok('  Desktop shortcut created')
    } catch (e) {
      warn('  Could not create desktop shortcut: ' + e.message)
    }
  }

  const launch = await ask('\nLaunch UniPath now? [Y/n] ')
  if (launch.toLowerCase() !== 'n') {
    await run('npm', ['start'], { cwd: INSTALL_DIR })
  }
}

// ── Main ──

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

  info(`Install directory: ${INSTALL_DIR}\n`)

  if (!await checkNode()) {
    if (PLATFORM === 'win32') {
      const installed = await installNodeWindows()
      if (!installed) {
        await pause()
        process.exit(1)
      }
      // Node was just installed; re-run needed for PATH refresh
      await pause()
      process.exit(0)
    } else {
      fail('Node.js >= 18 is required. Install it from https://nodejs.org and re-run.')
      await pause()
      process.exit(1)
    }
  }

  await checkNpm()

  if (!await downloadSource()) {
    await pause()
    process.exit(1)
  }

  await setupAndLaunch()

  if (rl) rl.close()
}

async function pause() {
  if (!IS_INTERACTIVE && IS_PKG) {
    console.log('\nClosing in 10 seconds...')
    await new Promise(r => setTimeout(r, 10000))
  }
}

main()
  .then(pause)
  .catch(async (err) => {
    fail(`\nSetup failed: ${err.message}`)
    await pause()
    process.exit(1)
  })
