import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const api = window.koliko

export default function Stats() {
  const [stats, setStats] = useState(null)

  useEffect(() => { api.getStats().then(setStats) }, [])

  if (!stats) return <LoadingState />

  const { dailyRates, streak, avgFirstTime, ignored, rate30, todayDistractions } = stats

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="lbl" style={{ marginBottom: 4 }}>Tableau de bord</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Ton historique</div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div className="stat-box">
          <div style={{ fontSize: 26, fontWeight: 700, color: '#a78bfa' }}>{streak}</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>streak jours</div>
        </div>
        <div className="stat-box">
          <div style={{ fontSize: 26, fontWeight: 700, color: '#10b981' }}>{rate30}%</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>taux 30 jours</div>
        </div>
        <div className="stat-box">
          <div style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b' }}>{avgFirstTime || '--'}</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>1re obligation</div>
        </div>
        <div className="stat-box">
          <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444' }}>{todayDistractions}</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>interceptées</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="clay-card" style={{ marginBottom: 16 }}>
        <div className="lbl" style={{ marginBottom: 12 }}>Complétion — 30 derniers jours</div>
        {dailyRates.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dailyRates} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={d => d.slice(8)}
                tick={{ fill: '#6b7280', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fill: '#6b7280', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#160d30', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#c4b5fd' }}
                formatter={v => [`${v}%`, 'Complétion']}
              />
              <Bar dataKey="rate" radius={[3, 3, 0, 0]}>
                {dailyRates.map((entry, i) => (
                  <Cell key={i} fill={entry.rate === 100 ? '#10b981' : entry.rate > 0 ? '#7c3aed' : '#374151'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </div>

      {/* Most ignored */}
      {ignored.length > 0 && (
        <div className="glass" style={{ marginBottom: 16 }}>
          <div className="lbl" style={{ marginBottom: 10 }}>Obligations les plus ignorées</div>
          {ignored.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: i < ignored.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#374151', fontWeight: 700, width: 16, textAlign: 'center' }}>#{i + 1}</span>
                <span style={{ fontSize: 13, color: '#fff' }}>{item.label}</span>
              </div>
              <span className="badge badge-err" style={{ fontSize: 10, padding: '2px 8px' }}>
                {item.count}× ignorée{item.count > 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Streak visualization */}
      <StreakDisplay streak={streak} />
    </div>
  )
}

function StreakDisplay({ streak }) {
  if (streak === 0) return null
  return (
    <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: 'rgba(124,58,237,.2)', border: '1px solid rgba(124,58,237,.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className="ti ti-flame" style={{ fontSize: 24, color: '#f59e0b' }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
          {streak} jour{streak > 1 ? 's' : ''} d'affilée 🔥
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          Continue sur ta lancée — chaque jour compte.
        </div>
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: '#374151' }}>
      <i className="ti ti-chart-bar" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
      <div style={{ fontSize: 12 }}>Pas encore de données.</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 60, borderRadius: 12, background: 'rgba(255,255,255,.04)' }} />
      ))}
    </div>
  )
}
