const path = require('path')
const { app } = require('electron')
const Database = require('better-sqlite3')

let db

function init() {
  const dbPath = path.join(app.getPath('userData'), 'koliko.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      locked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS obligations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      target_time TEXT,
      position INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pin_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reason TEXT,
      unlocked_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      obligation_id INTEGER REFERENCES obligations(id) ON DELETE CASCADE,
      original_time TEXT NOT NULL,
      rescheduled_to TEXT NOT NULL,
      report_count INTEGER DEFAULT 1,
      reported_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS distraction_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      video_watched INTEGER DEFAULT 0,
      returned_to_work INTEGER DEFAULT 0,
      attempted_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Seed default settings
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  const seed = db.transaction(() => {
    ins.run('reminder_time', '21:30')
    ins.run('blocked_domains', JSON.stringify([
      'youtube.com', 'www.youtube.com',
      'netflix.com', 'www.netflix.com',
      'twitter.com', 'www.twitter.com',
      'x.com', 'www.x.com',
      'instagram.com', 'www.instagram.com',
      'tiktok.com', 'www.tiktok.com',
      'facebook.com', 'www.facebook.com',
      'twitch.tv', 'www.twitch.tv',
      'reddit.com', 'www.reddit.com',
    ]))
    ins.run('blocked_apps', JSON.stringify({
      win32:  ['vlc.exe', 'spotify.exe', 'steam.exe', 'epicgameslauncher.exe'],
      darwin: ['VLC', 'Spotify', 'Steam'],
      linux:  ['vlc', 'spotify', 'steam'],
    }))
    ins.run('strict_mode', 'false')
    ins.run('pin', '')
    ins.run('motivation_video', '')
  })
  seed()

  return db
}

function getDb() {
  if (!db) throw new Error('DB not initialized')
  return db
}

// ── PLANS ──────────────────────────────────────────────────────────────────

function getTodayPlan() {
  const today = todayDate()
  const plan = db.prepare('SELECT * FROM plans WHERE date = ?').get(today)
  if (!plan) return null
  return withObligations(plan)
}

function getTomorrowPlan() {
  const date = offsetDate(1)
  let plan = db.prepare('SELECT * FROM plans WHERE date = ?').get(date)
  if (!plan) {
    const r = db.prepare('INSERT INTO plans (date) VALUES (?)').run(date)
    plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(r.lastInsertRowid)
  }
  return withObligations(plan)
}

function lockPlan(planId) {
  db.prepare('UPDATE plans SET locked = 1 WHERE id = ?').run(planId)
}

function withObligations(plan) {
  const obligations = db.prepare(
    'SELECT * FROM obligations WHERE plan_id = ? ORDER BY position ASC'
  ).all(plan.id)
  return { ...plan, obligations }
}

// ── OBLIGATIONS ────────────────────────────────────────────────────────────

function createObligation(planId, label, targetTime, position) {
  const r = db.prepare(
    'INSERT INTO obligations (plan_id, label, target_time, position) VALUES (?, ?, ?, ?)'
  ).run(planId, label, targetTime || null, position)
  return db.prepare('SELECT * FROM obligations WHERE id = ?').get(r.lastInsertRowid)
}

function deleteObligation(id) {
  db.prepare('DELETE FROM obligations WHERE id = ?').run(id)
}

function reorderObligations(orderedIds) {
  const upd = db.prepare('UPDATE obligations SET position = ? WHERE id = ?')
  db.transaction(() => orderedIds.forEach((id, i) => upd.run(i, id)))()
}

function toggleObligation(id) {
  const obl = db.prepare('SELECT * FROM obligations WHERE id = ?').get(id)
  if (!obl) throw new Error('Obligation not found')
  const now = new Date().toISOString()
  if (obl.completed) {
    db.prepare('UPDATE obligations SET completed = 0, completed_at = NULL WHERE id = ?').run(id)
    return { ...obl, completed: 0, completed_at: null }
  } else {
    db.prepare('UPDATE obligations SET completed = 1, completed_at = ? WHERE id = ?').run(now, id)
    return { ...obl, completed: 1, completed_at: now }
  }
}

// ── SETTINGS ───────────────────────────────────────────────────────────────

function getSettings() {
  const rows = db.prepare('SELECT * FROM settings').all()
  return Object.fromEntries(rows.map(r => [r.key, tryParse(r.value)]))
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? tryParse(row.value) : null
}

function saveSetting(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value)
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, v)
}

// ── STATS ──────────────────────────────────────────────────────────────────

function getStats() {
  const from = offsetDate(-30)
  const today = todayDate()

  const plans = db.prepare(`
    SELECT p.date,
      COUNT(o.id)    AS total,
      SUM(o.completed) AS done
    FROM plans p
    LEFT JOIN obligations o ON o.plan_id = p.id
    WHERE p.date >= ?
    GROUP BY p.date
    ORDER BY p.date ASC
  `).all(from)

  const dailyRates = plans.map(p => ({
    date: p.date,
    rate: p.total > 0 ? Math.round((p.done / p.total) * 100) : 0,
    done: p.done || 0,
    total: p.total || 0,
  }))

  // Streak
  const allDays = db.prepare(`
    SELECT p.date, COUNT(o.id) AS total, SUM(o.completed) AS done
    FROM plans p LEFT JOIN obligations o ON o.plan_id = p.id
    GROUP BY p.date ORDER BY p.date DESC
  `).all()

  let streak = 0
  for (const day of allDays) {
    if (day.date > today) continue
    if (day.total > 0 && day.done === day.total) streak++
    else break
  }

  // Average first obligation completion time
  const firstTimes = db.prepare(`
    SELECT MIN(completed_at) AS first_at
    FROM obligations o JOIN plans p ON o.plan_id = p.id
    WHERE o.completed = 1 AND p.date >= ? AND p.date < ?
    GROUP BY p.date
  `).all(from, today)

  let avgFirstTime = null
  const minutes = firstTimes
    .map(r => r.first_at ? toMinutes(r.first_at) : null)
    .filter(Boolean)
  if (minutes.length > 0) {
    const avg = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)
    avgFirstTime = `${String(Math.floor(avg / 60)).padStart(2, '0')}h${String(avg % 60).padStart(2, '0')}`
  }

  // Most ignored
  const ignored = db.prepare(`
    SELECT label, COUNT(*) AS count
    FROM obligations o JOIN plans p ON o.plan_id = p.id
    WHERE o.completed = 0 AND p.date < ? AND p.date >= ?
    GROUP BY label ORDER BY count DESC LIMIT 5
  `).all(today, from)

  const rate30 = dailyRates.length > 0
    ? Math.round(dailyRates.filter(d => d.rate === 100).length / dailyRates.length * 100)
    : 0

  const todayDistractions = getTodayDistractionCount()

  return { dailyRates, streak, avgFirstTime, ignored, rate30, todayDistractions }
}

// ── REPORTS ────────────────────────────────────────────────────────────────

function reportObligation(obligationId, originalTime, newTime) {
  const { count } = db.prepare(`
    SELECT COUNT(*) AS count FROM reports
    WHERE obligation_id = ? AND date(reported_at) = date('now')
  `).get(obligationId)

  const reportCount = count + 1
  db.prepare(`
    INSERT INTO reports (obligation_id, original_time, rescheduled_to, report_count)
    VALUES (?, ?, ?, ?)
  `).run(obligationId, originalTime, newTime, reportCount)
  db.prepare('UPDATE obligations SET target_time = ? WHERE id = ?').run(newTime, obligationId)

  return reportCount
}

function getReportCount(obligationId) {
  const { count } = db.prepare(`
    SELECT COUNT(*) AS count FROM reports
    WHERE obligation_id = ? AND date(reported_at) = date('now')
  `).get(obligationId)
  return count
}

// ── DISTRACTIONS ───────────────────────────────────────────────────────────

function logDistractionAttempt(type, target) {
  const r = db.prepare(
    'INSERT INTO distraction_attempts (type, target) VALUES (?, ?)'
  ).run(type, target)
  return r.lastInsertRowid
}

function updateDistractionAttempt(id, videoWatched, returnedToWork) {
  db.prepare(
    'UPDATE distraction_attempts SET video_watched = ?, returned_to_work = ? WHERE id = ?'
  ).run(videoWatched ? 1 : 0, returnedToWork ? 1 : 0, id)
}

function getTodayDistractionCount() {
  const { count } = db.prepare(
    `SELECT COUNT(*) AS count FROM distraction_attempts WHERE date(attempted_at) = date('now')`
  ).get()
  return count
}

// ── PIN ────────────────────────────────────────────────────────────────────

function logPinUnlock(reason) {
  db.prepare('INSERT INTO pin_unlocks (reason) VALUES (?)').run(reason || '')
}

// ── BLOCKING STATE ─────────────────────────────────────────────────────────

function hasPendingObligations() {
  const today = todayDate()
  const plan = db.prepare('SELECT id FROM plans WHERE date = ?').get(today)
  if (!plan) return false
  const { n } = db.prepare(
    'SELECT COUNT(*) AS n FROM obligations WHERE plan_id = ? AND completed = 0'
  ).get(plan.id)
  return n > 0
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().split('T')[0]
}

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function toMinutes(iso) {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function tryParse(v) {
  try { return JSON.parse(v) } catch { return v }
}

module.exports = {
  init, getDb,
  getTodayPlan, getTomorrowPlan, lockPlan,
  createObligation, deleteObligation, reorderObligations, toggleObligation,
  getSettings, getSetting, saveSetting,
  getStats,
  reportObligation, getReportCount,
  logDistractionAttempt, updateDistractionAttempt, getTodayDistractionCount,
  logPinUnlock,
  hasPendingObligations,
}
