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
const DIR = __dirname
const IS_PKG = !!process.pkg  // running as standalone executable

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

// ── Checks ──

async function checkNode() {
  if (IS_PKG) {
    ok('[1/5] Node.js bundled with setup executable')
    return true
  }
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
  if (IS_PKG) {
    ok('[2/5] npm bundled with setup executable')
    return true
  }
  info('[2/5] Checking npm ...')
  const ver = runCapture('npm', ['--version'])
  if (ver) {
    ok(`  npm ${ver} found`)
    return true
  }
  warn('  npm not found')
  return false
}

async function checkPython() {
  info('[3/5] Checking Python ...')
  let ver = runCapture('python3', ['--version']).replace(/^Python /, '')
  let cmd = 'python3'
  if (!ver) {
    ver = runCapture('python', ['--version']).replace(/^Python /, '')
    cmd = 'python'
  }
  if (!ver) {
    warn('  Python not found')
    return { ok: false, cmd: '' }
  }
  const parts = ver.split('.').map(Number)
  if (parts[0] >= 3 && parts[1] >= 10) {
    ok(`  Python ${ver} found (${cmd})`)
    return { ok: true, cmd }
  }
  warn(`  Python ${ver} found, but >= 3.10 required`)
  return { ok: false, cmd }
}

async function checkVenv(pyCmd) {
  info('[4/5] Checking Python venv ...')
  if (!pyCmd) {
    warn('  Cannot check venv without Python')
    return false
  }
  try {
    execSync(`${pyCmd} -c "import venv"`, { stdio: 'pipe' })
    ok('  venv module available')
    return true
  } catch {
    warn('  venv module not available')
    return false
  }
}

// ── Installers ──

async function installPythonWindows() {
  // Try winget first (built into Windows 10/11)
  try {
    execSync('where winget', { stdio: 'pipe' })
    warn('\n  Python >= 3.10 is required. Install via winget?')
    const a = await ask('  Proceed? [Y/n] ')
    if (a.toLowerCase() !== 'n') {
      info('  Installing Python via winget ...')
      await run('winget', ['install', '-e', '--id', 'Python.Python.3.12', '--accept-source-agreements'])
      info('\n  Python installed. Please re-run this setup.')
      return true
    }
  } catch {
    // winget not available, proceed to manual download
  }

  warn('\n  Python >= 3.10 is required. Download automatically?')
  const a = await ask('  Download Python 3.12? [Y/n] ')
  if (a.toLowerCase() === 'n') {
    fail('  Please install Python from https://www.python.org/downloads/ and re-run setup')
    return false
  }
  info('  Downloading Python 3.12 for Windows ...')
  const url = 'https://www.python.org/ftp/python/3.12.5/python-3.12.5-amd64.exe'
  const dest = path.join(os.tmpdir(), 'python-installer.exe')
  await run('curl', ['-Lo', dest, url])
  info('  Running installer ...')
  await run(dest, ['/quiet', 'InstallAllUsers=1', 'PrependPath=1', 'Include_test=0'])
  info('  Python installed. Please re-run this setup.')
  return true
}

async function installPythonLinux() {
  const pm = detectPkgManager()
  if (!pm) {
    fail('  No known package manager. Install Python from https://www.python.org/downloads/')
    return false
  }
  warn(`  Install Python via ${pm}?`)
  const a = await ask('  Proceed? [Y/n] ')
  if (a.toLowerCase() === 'n') return false
  const cmds = {
    apt: 'sudo apt update && sudo apt install -y python3 python3-pip python3-venv',
    'apt-get': 'sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv',
    dnf: 'sudo dnf install -y python3 python3-pip python3-virtualenv',
    yum: 'sudo yum install -y python3 python3-pip python3-virtualenv',
    pacman: 'sudo pacman -S --noconfirm python python-pip python-virtualenv',
    brew: 'brew install python',
    zypper: 'sudo zypper install -y python3 python3-pip python3-virtualenv',
  }
  await run('sh', ['-c', cmds[pm] || `echo "Install Python manually via ${pm}"`])
  return true
}

function detectPkgManager() {
  const progs = ['apt', 'apt-get', 'dnf', 'yum', 'pacman', 'zypper', 'brew']
  for (const p of progs) {
    try { execSync(`which ${p}`, { stdio: 'pipe' }); return p } catch {}
  }
  return null
}

// ── Setup ──

async function setupProject() {
  info('\n[5/5] Installing frontend dependencies (npm install) ...')
  await run('npm', ['install'], { cwd: DIR })

  info('\n[5/5] Setting up Python backend ...')
  const pyCmd = runCapture('python3', ['--version']) ? 'python3' : 'python'
  const venvDir = path.join(DIR, 'backend', '.venv')
  if (!fs.existsSync(venvDir)) {
    await run(pyCmd, ['-m', 'venv', path.join(DIR, 'backend', '.venv')])
  }

  const pip = PLATFORM === 'win32'
    ? path.join(venvDir, 'Scripts', 'pip.exe')
    : path.join(venvDir, 'bin', 'pip')
  await run(`"${pip}"`, ['install', '-r', path.join(DIR, 'backend', 'requirements.txt')])

  info('\n[5/5] Building the app ...')
  await run('npm', ['run', 'build'], { cwd: DIR })

  ok('\n=================================')
  ok('  UniPath setup complete!')
  ok('  Run it with:  npm start')
  ok('=================================')

  const launch = await ask('\nLaunch UniPath now? [Y/n] ')
  if (launch.toLowerCase() !== 'n') {
    await run('npm', ['start'], { cwd: DIR })
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
  console.log(`${BOLD}UniPath — Setup${NC}\n`)

  const nodeOk = await checkNode()
  await checkNpm()
  const py = await checkPython()
  if (py.ok) await checkVenv(py.cmd)

  // Install missing deps (skip Node.js if running as pkg — it's bundled)
  const needNode = !nodeOk && !IS_PKG
  const needPy = !py.ok

  if (needNode || needPy) {
    warn('\nSome dependencies are missing.')
    const proceed = await ask('Attempt to install missing dependencies automatically? [Y/n] ')
    if (proceed.toLowerCase() !== 'n') {
      if (needPy) {
        if (PLATFORM === 'win32') await installPythonWindows()
        else await installPythonLinux()
      }
    } else {
      fail('Please install missing dependencies manually and re-run setup.')
      rl.close()
      return
    }
  }

  await setupProject()
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
    if (IS_PKG) {
      fail('\nIf the issue is with Python installation, try installing Python 3.12 manually')
      fail('from https://www.python.org/downloads/ and then re-run this setup.')
    }
    await pause()
    process.exit(1)
  })
