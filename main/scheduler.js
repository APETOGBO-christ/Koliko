const cron = require('node-cron')
const { Notification, BrowserWindow } = require('electron')
const db = require('./database')

let planningReminderTask = null
let obligationTasks = []
let planningModalTimeout = null
let createWindowFn = null

function setWindowFactory(fn) {
  createWindowFn = fn
}

// ── PLANNING REMINDER ──────────────────────────────────────────────────────

function schedulePlanningReminder(time = '21:30') {
  if (planningReminderTask) {
    planningReminderTask.destroy()
    planningReminderTask = null
  }

  const [h, m] = time.split(':')
  const expr = `${m} ${h} * * *`

  planningReminderTask = cron.schedule(expr, () => {
    const tomorrow = getTomorrowDate()
    const plan = db.getTomorrowPlan()

    // If plan already has obligations, skip
    if (plan && plan.obligations && plan.obligations.length > 0) return

    new Notification({
      title: 'Koliko — Planifie ta journée',
      body: 'Prépare tes obligations pour demain avant de dormir.',
    }).show()

    // After 10 minutes, open blocking modal if still no plan
    if (planningModalTimeout) clearTimeout(planningModalTimeout)
    planningModalTimeout = setTimeout(() => {
      const current = db.getTomorrowPlan()
      if (!current || !current.obligations || current.obligations.length === 0) {
        createWindowFn && createWindowFn('planning-modal')
      }
    }, 10 * 60 * 1000)
  })
}

function stopPlanningReminder() {
  if (planningReminderTask) {
    planningReminderTask.destroy()
    planningReminderTask = null
  }
  if (planningModalTimeout) {
    clearTimeout(planningModalTimeout)
    planningModalTimeout = null
  }
}

// ── OBLIGATION REMINDERS ───────────────────────────────────────────────────

function scheduleObligationReminders(obligations) {
  // Clear previous tasks
  obligationTasks.forEach(t => t.destroy())
  obligationTasks = []

  for (const obl of obligations) {
    if (!obl.target_time || obl.completed) continue
    const [h, m] = obl.target_time.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) continue

    // 15-min early notification
    const earlyMin = m - 15 < 0 ? 60 + (m - 15) : m - 15
    const earlyHour = m - 15 < 0 ? h - 1 : h
    if (earlyHour >= 0) {
      const earlyExpr = `${earlyMin} ${earlyHour} * * *`
      const earlyTask = cron.schedule(earlyExpr, () => {
        if (!isOblCompleted(obl.id)) {
          new Notification({
            title: `Koliko — ${obl.label} dans 15 min`,
            body: `Prépare-toi pour ton obligation à ${obl.target_time}.`,
          }).show()
        }
      })
      obligationTasks.push(earlyTask)
    }

    // At-time overlay
    const atExpr = `${m} ${h} * * *`
    const atTask = cron.schedule(atExpr, () => {
      if (!isOblCompleted(obl.id)) {
        const reportCount = db.getReportCount(obl.id)
        createWindowFn && createWindowFn('reminder', {
          obligationId: obl.id,
          label: obl.label,
          time: obl.target_time,
          reportCount,
        })
      }
    })
    obligationTasks.push(atTask)
  }
}

function stopObligationReminders() {
  obligationTasks.forEach(t => t.destroy())
  obligationTasks = []
}

function isOblCompleted(id) {
  const today = db.getTodayPlan()
  if (!today) return false
  const obl = today.obligations.find(o => o.id === id)
  return obl ? obl.completed === 1 : false
}

function getTomorrowDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

module.exports = {
  setWindowFactory,
  schedulePlanningReminder,
  stopPlanningReminder,
  scheduleObligationReminders,
  stopObligationReminders,
}
