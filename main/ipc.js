const { ipcMain, dialog, BrowserWindow } = require('electron')
const db = require('./database')
const blocker = require('./blocker')
const scheduler = require('./scheduler')

function registerHandlers() {

  // ── TODAY ──────────────────────────────────────────────────────────────

  ipcMain.handle('db:getToday', () => db.getTodayPlan())

  ipcMain.handle('db:toggleObligation', (_, id) => {
    const updated = db.toggleObligation(id)

    // After toggle, recalculate blocking state
    const pending = db.hasPendingObligations()
    const settings = db.getSettings()
    const domains = settings.blocked_domains || []

    if (pending && !blocker.isBlockingActive()) {
      blocker.activateBlocking(domains)
      blocker.startProcessMonitor()
    } else if (!pending && blocker.isBlockingActive()) {
      blocker.deactivateBlocking()
      blocker.stopProcessMonitor()
    }

    // Refresh today's obligations for scheduler
    const today = db.getTodayPlan()
    if (today) scheduler.scheduleObligationReminders(today.obligations)

    return updated
  })

  ipcMain.handle('db:getTodayDistractionCount', () => db.getTodayDistractionCount())

  // ── PLAN ───────────────────────────────────────────────────────────────

  ipcMain.handle('db:getTomorrowPlan', () => db.getTomorrowPlan())

  ipcMain.handle('db:createObligation', (_, { planId, label, targetTime, position }) => {
    return db.createObligation(planId, label, targetTime, position)
  })

  ipcMain.handle('db:deleteObligation', (_, id) => {
    db.deleteObligation(id)
    return true
  })

  ipcMain.handle('db:reorderObligations', (_, orderedIds) => {
    db.reorderObligations(orderedIds)
    return true
  })

  ipcMain.handle('db:lockPlan', (_, planId) => {
    db.lockPlan(planId)
    return true
  })

  // ── STATS ──────────────────────────────────────────────────────────────

  ipcMain.handle('db:getStats', () => db.getStats())

  // ── SETTINGS ───────────────────────────────────────────────────────────

  ipcMain.handle('db:getSettings', () => db.getSettings())

  ipcMain.handle('db:saveSetting', (_, { key, value }) => {
    db.saveSetting(key, value)

    // Side-effects
    if (key === 'reminder_time') {
      scheduler.schedulePlanningReminder(value)
    }
    if (key === 'blocked_domains' && blocker.isBlockingActive()) {
      blocker.deactivateBlocking().then(() => blocker.activateBlocking(value))
    }
    return true
  })

  // ── BLOCKER ────────────────────────────────────────────────────────────

  ipcMain.handle('blocker:getStatus', () => blocker.isBlockingActive())

  // ── REPORTS ────────────────────────────────────────────────────────────

  ipcMain.handle('db:reportObligation', (_, { obligationId, originalTime, newTime }) => {
    return db.reportObligation(obligationId, originalTime, newTime)
  })

  ipcMain.handle('db:getReportCount', (_, id) => db.getReportCount(id))

  // ── PIN ────────────────────────────────────────────────────────────────

  ipcMain.handle('pin:verify', (_, pin) => {
    const stored = db.getSetting('pin')
    return stored && stored === pin
  })

  ipcMain.handle('pin:unlock', (_, { pin, reason }) => {
    const stored = db.getSetting('pin')
    if (!stored || stored !== pin) return { ok: false, error: 'PIN incorrect' }
    db.logPinUnlock(reason || 'Urgence')
    return { ok: true }
  })

  // ── VIDEO ──────────────────────────────────────────────────────────────

  ipcMain.handle('video:pickFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choisir ta vidéo de motivation',
      filters: [{ name: 'Vidéo', extensions: ['mp4', 'mov', 'webm', 'mkv'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return null
    return filePaths[0]
  })

  ipcMain.handle('video:ended', (event, { attemptId, returnedToWork }) => {
    if (attemptId) {
      db.updateDistractionAttempt(attemptId, true, returnedToWork)
    }
    return true
  })

  // ── APP PICKER ─────────────────────────────────────────────────────────

  ipcMain.handle('app:pickFile', async () => {
    const filters = process.platform === 'win32'
      ? [{ name: 'Exécutables', extensions: ['exe'] }]
      : [{ name: 'Applications', extensions: ['app', '*'] }]

    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Sélectionner une application à bloquer',
      filters,
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return null
    return filePaths[0]
  })
}

module.exports = { registerHandlers }
