const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile, execSync } = require('child_process')
const { Notification } = require('electron')
const db = require('./database')

const KOLIKO_START = '# KOLIKO_START'
const KOLIKO_END   = '# KOLIKO_END'

const HOSTS_PATH = process.platform === 'win32'
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts'

let processMonitorInterval = null
let blockingActive = false
let onBlockingChange = null

// ── PUBLIC API ─────────────────────────────────────────────────────────────

function setBlockingChangeHandler(fn) {
  onBlockingChange = fn
}

function isBlockingActive() {
  return blockingActive
}

async function activateBlocking(domains) {
  try {
    const current = fs.readFileSync(HOSTS_PATH, 'utf8')
    if (current.includes(KOLIKO_START)) return // already blocked

    const block = buildBlock(domains)
    await writeHosts(current + '\n' + block + '\n')
    blockingActive = true
    onBlockingChange && onBlockingChange(true)
  } catch (err) {
    console.error('[blocker] activateBlocking error:', err.message)
  }
}

async function deactivateBlocking() {
  try {
    const current = fs.readFileSync(HOSTS_PATH, 'utf8')
    if (!current.includes(KOLIKO_START)) {
      blockingActive = false
      return
    }
    const cleaned = removeBlock(current)
    await writeHosts(cleaned)
    blockingActive = false
    onBlockingChange && onBlockingChange(false)
  } catch (err) {
    console.error('[blocker] deactivateBlocking error:', err.message)
  }
}

function startProcessMonitor() {
  if (processMonitorInterval) return
  processMonitorInterval = setInterval(killBlockedApps, 30_000)
}

function stopProcessMonitor() {
  if (processMonitorInterval) {
    clearInterval(processMonitorInterval)
    processMonitorInterval = null
  }
}

// Verify hosts consistency on startup
async function verifyOnStartup() {
  const pending = db.hasPendingObligations()
  const hostsHasBlock = fs.existsSync(HOSTS_PATH) &&
    fs.readFileSync(HOSTS_PATH, 'utf8').includes(KOLIKO_START)

  if (pending && !hostsHasBlock) {
    const domains = db.getSetting('blocked_domains') || []
    await activateBlocking(domains)
  } else if (!pending && hostsHasBlock) {
    await deactivateBlocking()
  }
  blockingActive = pending
}

// ── HOSTS FILE ─────────────────────────────────────────────────────────────

function buildBlock(domains) {
  const lines = domains.map(d => `0.0.0.0 ${d}`).join('\n')
  return `${KOLIKO_START}\n${lines}\n${KOLIKO_END}`
}

function removeBlock(content) {
  const re = new RegExp(`\\n?${KOLIKO_START}[\\s\\S]*?${KOLIKO_END}\\n?`, 'g')
  return content.replace(re, '')
}

async function writeHosts(content) {
  if (process.platform === 'win32') {
    await writeHostsWindows(content)
  } else {
    await writeHostsUnix(content)
  }
}

function writeHostsWindows(content) {
  return new Promise((resolve, reject) => {
    const tmpScript = path.join(os.tmpdir(), 'koliko_hosts.ps1')
    // Write content to a temp file then copy with PS
    const tmpHosts = path.join(os.tmpdir(), 'koliko_hosts.tmp')
    fs.writeFileSync(tmpHosts, content, 'utf8')

    const script = `
      $src = '${tmpHosts.replace(/\\/g, '\\\\')}'
      $dst = '${HOSTS_PATH.replace(/\\/g, '\\\\')}'
      Copy-Item -Path $src -Destination $dst -Force
    `
    fs.writeFileSync(tmpScript, script, 'utf8')

    const ps = execFile('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden',
      '-File', tmpScript,
    ], { windowsHide: true })

    ps.on('close', code => code === 0 ? resolve() : reject(new Error(`PS exit ${code}`)))
    ps.on('error', reject)
  })
}

function writeHostsUnix(content) {
  return new Promise((resolve, reject) => {
    const sudo = require('sudo-prompt')
    const tmpFile = path.join(os.tmpdir(), 'koliko_hosts.tmp')
    fs.writeFileSync(tmpFile, content, 'utf8')
    const cmd = `cp "${tmpFile}" "${HOSTS_PATH}" && chmod 644 "${HOSTS_PATH}"`
    sudo.exec(cmd, { name: 'Koliko' }, err => err ? reject(err) : resolve())
  })
}

// ── PROCESS MONITOR ────────────────────────────────────────────────────────

function killBlockedApps() {
  if (!db.hasPendingObligations()) return
  const appsConfig = db.getSetting('blocked_apps') || {}
  const blocked = appsConfig[process.platform] || []
  if (blocked.length === 0) return

  try {
    if (process.platform === 'win32') {
      const list = execSync('tasklist /FO CSV /NH', { encoding: 'utf8' })
      for (const app of blocked) {
        if (list.toLowerCase().includes(app.toLowerCase())) {
          execSync(`taskkill /F /IM "${app}"`, { stdio: 'ignore' })
          new Notification({
            title: 'Koliko',
            body: `Terminez vos obligations avant d'ouvrir ${app.replace('.exe', '')}.`,
          }).show()
        }
      }
    } else {
      const list = execSync('ps aux', { encoding: 'utf8' })
      for (const app of blocked) {
        if (list.includes(app)) {
          execSync(`pkill -x "${app}"`, { stdio: 'ignore' })
          new Notification({
            title: 'Koliko',
            body: `Terminez vos obligations avant d'ouvrir ${app}.`,
          }).show()
        }
      }
    }
  } catch {
    // Ignore — process may have already exited
  }
}

module.exports = {
  activateBlocking,
  deactivateBlocking,
  startProcessMonitor,
  stopProcessMonitor,
  verifyOnStartup,
  setBlockingChangeHandler,
  isBlockingActive,
}
