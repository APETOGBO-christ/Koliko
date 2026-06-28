import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

const api = window.koliko

const MAX_REPORTS = 2

export default function Reminder() {
  const [params]       = useSearchParams()
  const [reportCount, setReportCount] = useState(0)
  const [done, setDone] = useState(false)

  const id         = Number(params.get('id'))
  const label      = params.get('label') || 'Obligation'
  const time       = params.get('time') || ''
  const initReports = Number(params.get('reportCount') || 0)

  useEffect(() => { setReportCount(initReports) }, [initReports])

  const start = async () => {
    await api.toggleObligation(id)
    setDone(true)
    setTimeout(() => api.closeWindow(), 600)
  }

  const report = async (minutes) => {
    if (reportCount >= MAX_REPORTS) return
    const [h, m] = time.split(':').map(Number)
    const base = new Date()
    base.setHours(h, m, 0, 0)
    base.setMinutes(base.getMinutes() + minutes)
    const newTime = `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`
    await api.reportObligation({ obligationId: id, originalTime: time, newTime })
    setReportCount(c => c + 1)
    setTimeout(() => api.closeWindow(), 600)
  }

  const remaining = MAX_REPORTS - reportCount
  const canReport = reportCount < MAX_REPORTS

  if (done) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0820' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="ti ti-circle-check" style={{ fontSize: 48, color: '#10b981', display: 'block', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#6ee7b7' }}>C'est parti !</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      background: 'rgba(10,5,30,.95)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(124,58,237,.2)',
          border: '1px solid rgba(124,58,237,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}>
          <i className="ti ti-book" style={{ fontSize: 24, color: '#a78bfa' }} />
        </div>

        {/* Time */}
        <div className="lbl" style={{ marginBottom: 6 }}>
          Il est {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Title */}
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          Tu es sur quelque chose d'important ?
        </div>

        {/* Start button */}
        <button className="btn-primary" onClick={start} style={{ marginBottom: 10, maxWidth: 280 }}>
          <i className="ti ti-player-play" /> Je commence maintenant
        </button>

        {/* Report buttons */}
        {canReport ? (
          <div style={{ display: 'flex', gap: 8, maxWidth: 280, width: '100%' }}>
            <button
              className="btn-ghost"
              onClick={() => report(30)}
              style={{ flex: 1, fontSize: 12, position: 'relative' }}
            >
              Reporter 30 min
              {reportCount === MAX_REPORTS - 1 && (
                <span className="badge badge-warn" style={{
                  fontSize: 9, padding: '2px 6px',
                  position: 'absolute', top: -8, right: -4,
                }}>dernier</span>
              )}
            </button>
            <button
              className="btn-ghost"
              onClick={() => report(60)}
              style={{ flex: 1, fontSize: 12, position: 'relative' }}
            >
              Reporter 1h
              {reportCount === MAX_REPORTS - 1 && (
                <span className="badge badge-warn" style={{
                  fontSize: 9, padding: '2px 6px',
                  position: 'absolute', top: -8, right: -4,
                }}>dernier</span>
              )}
            </button>
          </div>
        ) : (
          <div style={{
            padding: '10px 16px', background: 'rgba(239,68,68,.1)',
            border: '1px solid rgba(239,68,68,.25)', borderRadius: 10,
            fontSize: 12, color: '#fca5a5',
          }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />
            Plus de report possible — c'est maintenant ou jamais.
          </div>
        )}

        {/* Info */}
        {canReport && (
          <div style={{ marginTop: 14, fontSize: 11, color: '#6b7280' }}>
            <i className="ti ti-info-circle" style={{ fontSize: 12, verticalAlign: -2 }} />
            {' '}Report {reportCount + 1} sur {MAX_REPORTS} — disparaît à la prochaine tentative
          </div>
        )}
      </div>
    </div>
  )
}
