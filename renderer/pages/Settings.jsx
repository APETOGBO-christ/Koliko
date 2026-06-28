import { useState, useEffect, useRef } from 'react'

const api = window.koliko

export default function Settings() {
  const [settings, setSettings]   = useState(null)
  const [newDomain, setNewDomain] = useState('')
  const [pinInput, setPinInput]   = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinMsg, setPinMsg]       = useState('')
  const [videoPath, setVideoPath] = useState('')
  const [saved, setSaved]         = useState('')
  const videoRef = useRef(null)

  useEffect(() => {
    api.getSettings().then(s => {
      setSettings(s)
      setVideoPath(s.motivation_video || '')
    })
  }, [])

  if (!settings) return null

  const domains     = settings.blocked_domains || []
  const apps        = settings.blocked_apps || {}
  const platformApps = apps[window.navigator.platform?.toLowerCase().includes('win') ? 'win32'
                          : window.navigator.platform?.toLowerCase().includes('mac') ? 'darwin'
                          : 'linux'] || []
  const strictMode  = settings.strict_mode === true || settings.strict_mode === 'true'

  const save = async (key, value) => {
    await api.saveSetting(key, value)
    setSaved(key)
    setTimeout(() => setSaved(''), 1500)
    setSettings(s => ({ ...s, [key]: value }))
  }

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!d || domains.includes(d)) return
    const next = [...domains, d]
    save('blocked_domains', next)
    setNewDomain('')
  }

  const removeDomain = (d) => save('blocked_domains', domains.filter(x => x !== d))

  const pickVideo = async () => {
    const p = await api.pickVideoFile()
    if (p) {
      setVideoPath(p)
      save('motivation_video', p)
    }
  }

  const pickApp = async () => {
    const p = await api.pickAppFile()
    if (!p) return
    const name = p.split(/[/\\]/).pop()
    const allApps = { ...apps }
    const platform = process.platform
    allApps[platform] = [...(allApps[platform] || []), name]
    save('blocked_apps', allApps)
  }

  const removeApp = (appName) => {
    const allApps = { ...apps }
    const platform = process.platform
    allApps[platform] = (allApps[platform] || []).filter(a => a !== appName)
    save('blocked_apps', allApps)
  }

  const savePin = async () => {
    if (pinInput.length !== 6 || !/^\d{6}$/.test(pinInput)) {
      setPinMsg('Le PIN doit être 6 chiffres.')
      return
    }
    if (pinInput !== pinConfirm) {
      setPinMsg('Les PINs ne correspondent pas.')
      return
    }
    await save('pin', pinInput)
    setPinMsg('PIN sauvegardé ✓')
    setPinInput('')
    setPinConfirm('')
    setTimeout(() => setPinMsg(''), 2000)
  }

  return (
    <div>
      <div className="lbl" style={{ marginBottom: 4 }}>Configuration</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Réglages</div>

      {/* Reminder time */}
      <Section title="Rappel de planification" icon="ti-bell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="plan-input"
            type="time"
            defaultValue={settings.reminder_time || '21:30'}
            onBlur={e => save('reminder_time', e.target.value)}
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Heure de notification pour planifier le lendemain
          </span>
          {saved === 'reminder_time' && <Tick />}
        </div>
      </Section>

      {/* Strict mode */}
      <Section title="Mode strict" icon="ti-shield-lock">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#c4b5fd' }}>
            Empêche de fermer Koliko depuis la barre des tâches
          </span>
          <Switch checked={strictMode} onChange={v => save('strict_mode', v)} />
        </div>
      </Section>

      {/* Blocked domains */}
      <Section title="Sites bloqués" icon="ti-world-off">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="plan-input"
            placeholder="ex: netflix.com"
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDomain()}
            style={{ flex: 1 }}
          />
          <button className="btn-ghost" onClick={addDomain} style={{ padding: '10px 14px' }}>
            <i className="ti ti-plus" />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {domains.map(d => (
            <span key={d} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', background: 'rgba(124,58,237,.15)',
              border: '1px solid rgba(124,58,237,.25)', borderRadius: 20, fontSize: 11, color: '#c4b5fd',
            }}>
              {d}
              <button onClick={() => removeDomain(d)}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>
                <i className="ti ti-x" />
              </button>
            </span>
          ))}
        </div>
      </Section>

      {/* Blocked apps */}
      <Section title="Applications bloquées" icon="ti-app-window-filled">
        <button className="btn-ghost" onClick={pickApp} style={{ marginBottom: 10, width: '100%' }}>
          <i className="ti ti-file-plus" /> Ajouter une application
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {platformApps.map(a => (
            <div key={a} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.07)', borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ti ti-device-desktop" style={{ fontSize: 14, color: '#374151' }} />
                <span style={{ fontSize: 13, color: '#fff' }}>{a}</span>
              </div>
              <button onClick={() => removeApp(a)}
                style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 14 }}>
                <i className="ti ti-trash" />
              </button>
            </div>
          ))}
          {platformApps.length === 0 && (
            <div style={{ fontSize: 12, color: '#374151', textAlign: 'center', padding: 12 }}>
              Aucune application bloquée
            </div>
          )}
        </div>
      </Section>

      {/* Motivation video */}
      <Section title="Vidéo de motivation" icon="ti-video">
        <div style={{ marginBottom: 10 }}>
          <button className="btn-ghost" onClick={pickVideo} style={{ width: '100%', marginBottom: 8 }}>
            <i className="ti ti-file-upload" /> Choisir un fichier vidéo
          </button>
          {videoPath && (
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, wordBreak: 'break-all' }}>
              <i className="ti ti-check" style={{ color: '#10b981', marginRight: 4 }} />
              {videoPath.split(/[/\\]/).pop()}
            </div>
          )}
        </div>
        {videoPath && (
          <video
            ref={videoRef}
            src={`file://${videoPath}`}
            controls
            style={{ width: '100%', borderRadius: 10, background: '#0a0512', maxHeight: 200 }}
          />
        )}
        <div style={{ fontSize: 11, color: '#374151', marginTop: 8 }}>
          Durée recommandée : 45 sec minimum. Parle de tes objectifs à la caméra.
        </div>
      </Section>

      {/* PIN */}
      <Section title="PIN de secours" icon="ti-lock">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="plan-input"
            type="password"
            inputMode="numeric"
            placeholder="Nouveau PIN (6 chiffres)"
            value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
          />
          <input
            className="plan-input"
            type="password"
            inputMode="numeric"
            placeholder="Confirmer le PIN"
            value={pinConfirm}
            onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
          />
          <button className="btn-primary" onClick={savePin} style={{ padding: 10 }}
            disabled={pinInput.length !== 6 || pinConfirm.length !== 6}>
            <i className="ti ti-lock" /> Sauvegarder le PIN
          </button>
          {pinMsg && (
            <div style={{ fontSize: 12, color: pinMsg.includes('✓') ? '#10b981' : '#ef4444' }}>{pinMsg}</div>
          )}
          <div style={{ fontSize: 11, color: '#374151' }}>
            Ce PIN permet de déverrouiller manuellement en cas d'urgence. Chaque utilisation est loggée.
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 16, color: '#7c3aed' }} />
        <div className="lbl" style={{ margin: 0 }}>{title}</div>
      </div>
      <div className="glass">{children}</div>
    </div>
  )
}

function Switch({ checked, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="switch-track" />
      <span className="switch-thumb" />
    </label>
  )
}

function Tick() {
  return <i className="ti ti-check" style={{ color: '#10b981', fontSize: 16 }} />
}
