const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, Notification, session,
} = require('electron')
const path = require('path')
const db = require('./database')
const blocker = require('./blocker')
const scheduler = require('./scheduler')
const { registerHandlers } = require('./ipc')

const isDev = !app.isPackaged

let mainWindow = null
let widgetWindow = null
let reminderWindow = null
let videoWindow = null
let planningModalWindow = null
let tray = null

// ── WINDOW HELPERS ─────────────────────────────────────────────────────────

function devUrl(hash = '') {
  return `http://localhost:5173${hash}`
}

function prodFile(hash = '') {
  const base = `file://${path.join(__dirname, '../renderer/dist/index.html')}`
  return hash ? `${base}${hash}` : base
}

function load(win, hash = '') {
  isDev ? win.loadURL(devUrl(hash)) : win.loadURL(prodFile(hash))
}

function makeWindow(opts, hash) {
  const defaults = {
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }
  const win = new BrowserWindow({ ...defaults, ...opts })
  load(win, hash)
  if (isDev) win.webContents.openDevTools({ mode: 'detach' })
  return win
}

// ── MAIN WINDOW ────────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = makeWindow({
    width: 740,
    height: 680,
    minWidth: 680,
    minHeight: 580,
    title: 'Koliko',
    backgroundColor: '#0e0820',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  }, '#/')

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('close', (e) => {
    const strictMode = db.getSetting('strict_mode')
    if (strictMode === true || strictMode === 'true') {
      e.preventDefault()
      mainWindow.minimize()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── WIDGET WINDOW ──────────────────────────────────────────────────────────

function createWidgetWindow() {
  if (widgetWindow) { widgetWindow.show(); return }

  widgetWindow = makeWindow({
    width: 320,
    height: 420,
    x: 40,
    y: 40,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'Koliko — Widget',
  }, '#/widget')

  // Position bottom-right on startup
  const { screen } = require('electron')
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  widgetWindow.setPosition(sw - 340, sh - 440)

  widgetWindow.on('closed', () => { widgetWindow = null })
}

// ── REMINDER WINDOW ────────────────────────────────────────────────────────

function createReminderWindow(data) {
  if (reminderWindow) { reminderWindow.close() }

  reminderWindow = makeWindow({
    width: 480,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    skipTaskbar: false,
    title: 'Koliko — Rappel',
  }, `#/reminder?id=${data.obligationId}&label=${encodeURIComponent(data.label)}&time=${data.time}&reportCount=${data.reportCount}`)

  // Auto-close after 5 min → mark as ignored (no action = obligation stays unchecked)
  const autoClose = setTimeout(() => {
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.close()
    }
  }, 5 * 60 * 1000)

  reminderWindow.on('closed', () => {
    clearTimeout(autoClose)
    reminderWindow = null
  })
}

// ── VIDEO WINDOW ───────────────────────────────────────────────────────────

function createVideoWindow(attemptId, target) {
  if (videoWindow) return

  videoWindow = makeWindow({
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    title: 'Koliko — Rappelle-toi pourquoi tu as commencé',
  }, `#/video?attemptId=${attemptId}&target=${encodeURIComponent(target)}`)

  // Prevent closing — restart video instead
  videoWindow.on('close', (e) => {
    if (videoWindow && !videoWindow.isDestroyed()) {
      e.preventDefault()
      videoWindow.webContents.send('video:restart')
    }
  })

  videoWindow.on('closed', () => { videoWindow = null })
}

// ── PLANNING MODAL ─────────────────────────────────────────────────────────

function createPlanningModal() {
  if (planningModalWindow) return

  planningModalWindow = makeWindow({
    width: 600,
    height: 600,
    frame: false,
    modal: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    title: 'Koliko — Planifie ta journée',
  }, '#/plan')

  // Unclosable until plan has obligations
  planningModalWindow.on('close', (e) => {
    const plan = db.getTomorrowPlan()
    if (!plan || !plan.obligations || plan.obligations.length === 0) {
      e.preventDefault()
    }
  })

  planningModalWindow.on('closed', () => { planningModalWindow = null })
}

// ── WINDOW FACTORY ─────────────────────────────────────────────────────────

function windowFactory(type, data) {
  switch (type) {
    case 'widget':          return createWidgetWindow()
    case 'reminder':        return createReminderWindow(data)
    case 'video':           return createVideoWindow(data?.attemptId, data?.target)
    case 'planning-modal':  return createPlanningModal()
  }
}

// ── TRAY ───────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Koliko')

  const menu = Menu.buildFromTemplate([
    { label: 'Ouvrir Koliko',  click: () => mainWindow ? mainWindow.show() : createMainWindow() },
    { label: 'Widget compact', click: () => createWidgetWindow() },
    { type: 'separator' },
    { label: 'Quitter',        click: () => { app.quit() } },
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', () => mainWindow ? mainWindow.show() : createMainWindow())
}

// ── DISTRACTION INTERCEPTION ───────────────────────────────────────────────

function setupSessionInterception() {
  const domains = db.getSetting('blocked_domains') || []
  const patterns = domains.flatMap(d => [`*://${d}/*`, `*://*.${d}/*`])

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: patterns },
    (details, callback) => {
      if (!db.hasPendingObligations()) return callback({ cancel: false })

      // Log attempt
      const url = new URL(details.url)
      const attemptId = db.logDistractionAttempt('site', url.hostname)

      // Open confrontation video
      windowFactory('video', { attemptId, target: url.hostname })
      callback({ cancel: true })
    }
  )
}

// ── IPC WINDOW CONTROL ─────────────────────────────────────────────────────

function setupWindowIpc() {
  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.minimize()
  })
  ipcMain.on('video:close-allowed', () => {
    if (videoWindow && !videoWindow.isDestroyed()) {
      videoWindow.removeAllListeners('close')
      videoWindow.close()
    }
  })
}

// ── AUTO LAUNCH ────────────────────────────────────────────────────────────

function setupAutoLaunch() {
  try {
    const AutoLaunch = require('electron-auto-launch')
    const launcher = new AutoLaunch({ name: 'Koliko', isHidden: true })
    if (app.isPackaged) launcher.enable()
  } catch (err) {
    console.warn('[autolaunch]', err.message)
  }
}

// ── BLOCKING CHANGE BROADCAST ──────────────────────────────────────────────

function broadcastBlockingChange(active) {
  ;[mainWindow, widgetWindow].forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('blocking:changed', active)
    }
  })
}

// ── APP LIFECYCLE ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Init DB
  db.init()

  // Register IPC
  registerHandlers()
  setupWindowIpc()

  // Blocking
  blocker.setBlockingChangeHandler(broadcastBlockingChange)
  await blocker.verifyOnStartup()

  // Start process monitor if blocking active
  if (blocker.isBlockingActive()) blocker.startProcessMonitor()

  // Scheduler
  scheduler.setWindowFactory(windowFactory)
  const reminderTime = db.getSetting('reminder_time') || '21:30'
  scheduler.schedulePlanningReminder(reminderTime)

  const today = db.getTodayPlan()
  if (today) scheduler.scheduleObligationReminders(today.obligations)

  // Session interception
  setupSessionInterception()

  // UI
  createMainWindow()
  createTray()
  setupAutoLaunch()
})

app.on('window-all-closed', () => {
  const strictMode = db.getSetting('strict_mode')
  if (strictMode === true || strictMode === 'true') return
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
  else mainWindow.show()
})

app.on('before-quit', async () => {
  scheduler.stopPlanningReminder()
  scheduler.stopObligationReminders()
  blocker.stopProcessMonitor()
})
