import { useState, useEffect, useCallback } from 'react'

const api = window.koliko

function fmt(date) {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function Today() {
  const [plan, setPlan]               = useState(null)
  const [distractions, setDistractions] = useState(0)
  const [blocking, setBlocking]       = useState(false)
  const [loading, setLoading]         = useState(true)

  const refresh = useCallback(async () => {
    const [p, d, b] = await Promise.all([
      api.getToday(),
      api.getTodayDistractionCount(),
      api.getBlockingStatus(),
    ])
    setPlan(p)
    setDistractions(d)
    setBlocking(b)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const unsub = api.on('blocking:changed', (active) => {
      setBlocking(active)
      refresh()
    })
    return unsub
  }, [refresh])

  const toggle = async (id) => {
    await api.toggleObligation(id)
    refresh()
  }

  if (loading) return <Skeleton />

  const today = new Date().toISOString().split('T')[0]
  const obligations = plan?.obligations || []
  const done  = obligations.filter(o => o.completed).length
  const total = obligations.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  // Stats from plan
  const streak = plan?._streak ?? 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="lbl" style={{ marginBottom: 4 }}>{fmt(today)}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Bonne journée{' '}
            <span style={{ color: '#a78bfa' }}>
              {plan ? '✦' : ''}
            </span>
          </div>
        </div>
        {streak > 0 && (
          <span className="badge badge-purple">
            <i className="ti ti-flame" /> {streak} jour{streak > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Progress card */}
      {plan ? (
        <div className="clay-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <div className="lbl">Progression du jour</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                {done} sur {total} complétée{done > 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#a78bfa' }}>{pct}%</div>
          </div>
          <div className="prog-wrap">
            <div className="prog-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            {total - done > 0
              ? `${total - done} obligation${total - done > 1 ? 's' : ''} restante${total - done > 1 ? 's' : ''} avant déblocage`
              : '🎉 Toutes les obligations complétées — tu es libre !'}
          </div>
        </div>
      ) : (
        <div className="clay-card" style={{ marginBottom: 16, textAlign: 'center', padding: 28 }}>
          <i className="ti ti-calendar-off" style={{ fontSize: 32, color: '#374151', display: 'block', marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: '#6b7280' }}>Aucun plan pour aujourd'hui.</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>
            Va dans <strong style={{ color: '#a78bfa' }}>Planifier</strong> pour préparer demain.
          </div>
        </div>
      )}

      {/* Obligations list */}
      {obligations.length > 0 && (
        <>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="lbl">Obligations</div>
            <span className={`badge ${blocking ? 'badge-err' : 'badge-green'}`}>
              <i className={`ti ${blocking ? 'ti-shield-off' : 'ti-shield-check'}`} style={{ fontSize: 10 }} />
              {blocking ? 'Blocage actif' : 'Libre'}
            </span>
          </div>

          {obligations.map(o => (
            <ObligationRow key={o.id} obl={o} onToggle={() => toggle(o.id)} />
          ))}

          <div className="divider" />
        </>
      )}

      {/* Distraction counter */}
      <div className="glass-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-shield" style={{ fontSize: 16, color: '#ef4444' }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>Distractions interceptées</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: distractions > 0 ? '#ef4444' : '#6b7280' }}>
          {distractions}
        </span>
      </div>

      {/* Quick stats */}
      <QuickStats />
    </div>
  )
}

function ObligationRow({ obl, onToggle }) {
  const isDone    = obl.completed === 1
  const isReported = (obl.target_time || '').includes('·') || false

  return (
    <div className={`task-row${isDone ? ' done' : ''}`} onClick={onToggle}>
      <div className={`check${isDone ? ' on' : ''}`}>
        {isDone && <i className="ti ti-check" style={{ fontSize: 13, color: '#fff' }} />}
      </div>
      <span style={{ fontSize: 13, flex: 1, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#6b7280' : '#fff' }}>
        {obl.label}
      </span>
      {obl.target_time && (
        <span style={{ fontSize: 11, color: obl._reported ? '#f59e0b' : '#6b7280', whiteSpace: 'nowrap' }}>
          {obl.target_time}{obl._reportCount ? ` · reportée ${obl._reportCount}×` : ''}
        </span>
      )}
      {isDone && (
        <span className="badge badge-green" style={{ fontSize: 10, padding: '3px 8px' }}>fait</span>
      )}
      {!isDone && obl._reportCount > 0 && (
        <span className="badge badge-warn" style={{ fontSize: 10, padding: '3px 8px' }}>
          <i className="ti ti-clock" style={{ fontSize: 10 }} /> report
        </span>
      )}
    </div>
  )
}

function QuickStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.getStats().then(setStats)
  }, [])

  if (!stats) return null

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div className="stat-box">
        <div style={{ fontSize: 22, fontWeight: 700, color: '#a78bfa' }}>{stats.streak}</div>
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>streak jours</div>
      </div>
      <div className="stat-box">
        <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>{stats.rate30}%</div>
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>taux 30 jours</div>
      </div>
      <div className="stat-box">
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{stats.avgFirstTime || '--'}</div>
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>1re obligation</div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: 48, borderRadius: 12, background: 'rgba(255,255,255,.04)', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )
}
