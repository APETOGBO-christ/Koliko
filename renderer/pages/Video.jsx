import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

const api = window.koliko

export default function Video() {
  const [params]      = useSearchParams()
  const [today, setToday] = useState(null)
  const [ended, setEnded] = useState(false)
  const [settings, setSettings] = useState(null)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef(null)

  const attemptId = Number(params.get('attemptId'))
  const target    = params.get('target') || ''

  useEffect(() => {
    Promise.all([api.getToday(), api.getSettings()]).then(([t, s]) => {
      setToday(t)
      setSettings(s)
    })
  }, [])

  // Listen for restart signal from main process
  useEffect(() => {
    const unsub = api.on('distraction:intercepted', () => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play()
        setEnded(false)
        setProgress(0)
      }
    })
    return unsub
  }, [])

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v || !v.duration) return
    setProgress((v.currentTime / v.duration) * 100)
  }

  const onEnded = () => setEnded(true)

  const returnToWork = async () => {
    if (attemptId) await api.videoEnded({ attemptId, returnedToWork: true })
    // Tell main process it's safe to close
    window.electron?.ipcRenderer?.send('video:close-allowed')
    api.closeWindow()
  }

  const videoSrc = settings?.motivation_video ? `file://${settings.motivation_video}` : null
  const pending = today?.obligations?.filter(o => !o.completed) || []

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0a0512',
      display: 'flex', flexDirection: 'column',
      userSelect: 'none',
    }}>
      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
          />
        ) : (
          <NoVideo />
        )}

        {/* Interception badge */}
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <span className="badge badge-err" style={{ fontSize: 11 }}>
            <i className="ti ti-shield-off" style={{ fontSize: 11 }} /> {target}
          </span>
        </div>
      </div>

      {/* Overlay bottom panel */}
      <div style={{
        background: 'linear-gradient(to top, rgba(10,5,30,.98) 0%, transparent 100%)',
        padding: '20px 24px 24px',
      }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 99, marginBottom: 16 }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            borderRadius: 99, transition: 'width .1s linear',
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          {/* Pending obligations */}
          <div style={{ flex: 1 }}>
            <div className="lbl" style={{ marginBottom: 8 }}>Obligations restantes</div>
            {pending.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <i className="ti ti-circle" style={{ fontSize: 14, color: '#f59e0b' }} />
                <span style={{ fontSize: 13, color: '#fff' }}>{o.label}</span>
                {o.target_time && (
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{o.target_time}</span>
                )}
              </div>
            ))}
            {pending.length === 0 && (
              <div style={{ fontSize: 13, color: '#6b7280' }}>Toutes les obligations sont terminées.</div>
            )}
          </div>

          {/* Quote */}
          <div style={{ textAlign: 'right', maxWidth: 200 }}>
            <div style={{ fontSize: 13, color: '#c4b5fd', fontStyle: 'italic', lineHeight: 1.5 }}>
              "Rappelle-toi pourquoi tu as commencé."
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          className="btn-primary"
          onClick={returnToWork}
          disabled={!ended && !!videoSrc}
          style={{ maxWidth: 320, margin: '0 auto', display: 'flex' }}
        >
          <i className="ti ti-arrow-left" />
          {ended || !videoSrc
            ? 'Retourner au travail'
            : 'Disponible à la fin de la vidéo…'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#374151' }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 12, verticalAlign: -2, color: '#ef4444' }} />
          {' '}Fermer cette fenêtre relance la vidéo depuis le début
        </div>
      </div>
    </div>
  )
}

function NoVideo() {
  return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <i className="ti ti-video-off" style={{ fontSize: 48, color: 'rgba(124,58,237,.3)', display: 'block', marginBottom: 16 }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: '#c4b5fd', marginBottom: 8 }}>
        Aucune vidéo configurée
      </div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        Ajoute ta vidéo de motivation dans les Réglages.
      </div>
    </div>
  )
}
