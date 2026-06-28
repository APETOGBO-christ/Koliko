import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const api = window.koliko

export default function Widget() {
  const [plan, setPlan]           = useState(null)
  const [blocking, setBlocking]   = useState(false)
  const navigate                  = useNavigate()

  const refresh = useCallback(async () => {
    const [p, b] = await Promise.all([api.getToday(), api.getBlockingStatus()])
    setPlan(p)
    setBlocking(b)
  }, [])

  useEffect(() => {
    refresh()
    const unsub = api.on('blocking:changed', (active) => { setBlocking(active); refresh() })
    return unsub
  }, [refresh])

  const toggle = async (id) => { await api.toggleObligation(id); refresh() }

  const obligations = plan?.obligations || []
  const done  = obligations.filter(o => o.completed).length
  const total = obligations.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{
      background: '#160d30',
      border: '1px solid rgba(124,58,237,.2)',
      borderRadius: 16,
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Titlebar */}
      <div style={{
        height: 34, background: 'rgba(0,0,0,.3)',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8,
        borderBottom: '1px solid rgba(255,255,255,.05)',
        WebkitAppRegion: 'drag',
        flexShrink: 0,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }}
          onClick={() => api.closeWindow()} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4, flex: 1, textAlign: 'center' }}>Koliko</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: blocking ? '#ef4444' : '#10b981' }} />
      </div>

      {/* Content */}
      <div style={{ padding: '14px 12px', flex: 1, overflow: 'auto' }}>
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="lbl" style={{ fontSize: 9 }}>Aujourd'hui</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>{done}/{total}</div>
        </div>
        <div className="prog-wrap" style={{ marginBottom: 12 }}>
          <div className="prog-fill" style={{ width: `${pct}%` }} />
        </div>

        {/* Obligations */}
        {obligations.slice(0, 5).map(o => (
          <div key={o.id}
            onClick={() => toggle(o.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px',
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${o.completed ? 'rgba(255,255,255,.07)' : 'rgba(124,58,237,.3)'}`,
              borderRadius: 8, marginBottom: 6,
              opacity: o.completed ? .55 : 1,
              cursor: 'pointer',
            }}>
            <div style={{
              width: 18, height: 18, borderRadius: 6, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: o.completed ? 'none' : '2px solid rgba(124,58,237,.5)',
              background: o.completed ? '#7c3aed' : 'transparent',
              boxShadow: o.completed ? 'var(--glow)' : 'none',
            }}>
              {o.completed && <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />}
            </div>
            <span style={{
              fontSize: 11, flex: 1, color: o.completed ? '#6b7280' : '#fff',
              textDecoration: o.completed ? 'line-through' : 'none',
            }}>
              {o.label}
            </span>
            {o.target_time && (
              <span style={{ fontSize: 10, color: '#6b7280' }}>{o.target_time}</span>
            )}
          </div>
        ))}

        {obligations.length === 0 && (
          <div style={{ fontSize: 11, color: '#374151', textAlign: 'center', padding: 16 }}>
            Aucun plan pour aujourd'hui
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '12px 0' }} />

        <button
          className="btn-primary"
          style={{ fontSize: 12, padding: 10 }}
          onClick={() => navigate('/plan')}
        >
          <i className="ti ti-calendar-plus" /> Planifier demain
        </button>
      </div>
    </div>
  )
}
