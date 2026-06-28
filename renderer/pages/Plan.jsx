import { useState, useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const api = window.koliko

const MAX_OBLIGATIONS = 7
const MIN_OBLIGATIONS = 3

export default function Plan() {
  const [plan, setPlan]         = useState(null)
  const [label, setLabel]       = useState('')
  const [time, setTime]         = useState('')
  const [locked, setLocked]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const tomorrow = tomorrowLabel()

  useEffect(() => { api.getTomorrowPlan().then(p => { setPlan(p); setLocked(!!p?.locked) }) }, [])

  const obligations = plan?.obligations || []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const add = async () => {
    setError('')
    if (!label.trim()) return
    if (obligations.length >= MAX_OBLIGATIONS) {
      setError(`Maximum ${MAX_OBLIGATIONS} obligations par jour.`)
      return
    }
    const obl = await api.createObligation({
      planId: plan.id,
      label: label.trim(),
      targetTime: time || null,
      position: obligations.length,
    })
    setPlan(p => ({ ...p, obligations: [...p.obligations, obl] }))
    setLabel('')
    setTime('')
  }

  const remove = async (id) => {
    await api.deleteObligation(id)
    setPlan(p => ({ ...p, obligations: p.obligations.filter(o => o.id !== id) }))
  }

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = obligations.findIndex(o => o.id === active.id)
    const newIdx = obligations.findIndex(o => o.id === over.id)
    const reordered = arrayMove(obligations, oldIdx, newIdx)
    setPlan(p => ({ ...p, obligations: reordered }))
    await api.reorderObligations(reordered.map(o => o.id))
  }

  const lockPlan = async () => {
    if (obligations.length < MIN_OBLIGATIONS) {
      setError(`Minimum ${MIN_OBLIGATIONS} obligations requises.`)
      return
    }
    setSaving(true)
    await api.lockPlan(plan.id)
    setLocked(true)
    setSaving(false)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="lbl" style={{ marginBottom: 4 }}>Planification</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Prépare demain</div>
        </div>
        <span className="badge badge-purple">{tomorrow}</span>
      </div>

      {/* Add form */}
      {!locked && (
        <div className="clay-card" style={{ marginBottom: 16 }}>
          <div className="lbl" style={{ marginBottom: 10 }}>Nouvelle obligation</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="plan-input"
              placeholder="Ex : méditation, révision…"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              style={{ flex: 1 }}
              maxLength={80}
            />
            <input
              className="plan-input"
              placeholder="07h00"
              value={time}
              onChange={e => setTime(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              style={{ width: 80 }}
              pattern="[0-9]{2}h[0-9]{2}"
            />
          </div>
          <button className="btn-primary" onClick={add} style={{ padding: 10 }}
            disabled={!label.trim() || obligations.length >= MAX_OBLIGATIONS}>
            <i className="ti ti-plus" /> Ajouter
          </button>
          {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</div>}
        </div>
      )}

      {/* List */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="lbl">Obligations planifiées</div>
        <span style={{ fontSize: 10, color: '#6b7280' }}>
          {obligations.length} / {MAX_OBLIGATIONS} max
        </span>
      </div>

      {obligations.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#374151' }}>
          <i className="ti ti-list" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
          <div style={{ fontSize: 13 }}>Ajoute tes premières obligations</div>
        </div>
      )}

      {locked ? (
        <LockedList obligations={obligations} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={obligations.map(o => o.id)} strategy={verticalListSortingStrategy}>
            {obligations.map(o => (
              <SortableItem key={o.id} obl={o} onDelete={() => remove(o.id)} />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Lock button */}
      {!locked && obligations.length > 0 && (
        <button
          className="btn-primary"
          onClick={lockPlan}
          disabled={saving || obligations.length < MIN_OBLIGATIONS}
          style={{ marginTop: 8 }}
        >
          <i className="ti ti-lock" />
          {saving ? 'Validation…' : 'Valider le plan'}
        </button>
      )}

      {locked && (
        <div className="glass" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ti ti-lock-check" style={{ fontSize: 18, color: '#10b981' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6ee7b7' }}>Plan validé</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Ce plan sera actif demain au démarrage.</div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableItem({ obl, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: obl.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? .5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 14px',
        background: 'rgba(255,255,255,.04)',
        border: `1px solid ${isDragging ? 'rgba(124,58,237,.4)' : 'rgba(255,255,255,.07)'}`,
        borderRadius: 12,
        marginBottom: 8,
      }}
    >
      <span {...attributes} {...listeners} className="drag-handle" style={{ color: '#374151', fontSize: 16 }}>
        <i className="ti ti-grip-vertical" />
      </span>
      <span style={{ fontSize: 13, color: '#fff', flex: 1 }}>{obl.label}</span>
      {obl.target_time && (
        <span style={{ fontSize: 11, color: '#6b7280' }}>{obl.target_time}</span>
      )}
      <button
        onClick={onDelete}
        style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 15, padding: 0 }}
      >
        <i className="ti ti-trash" />
      </button>
    </div>
  )
}

function LockedList({ obligations }) {
  return (
    <>
      {obligations.map(o => (
        <div key={o.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px',
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 12, marginBottom: 8, opacity: .8,
        }}>
          <i className="ti ti-lock" style={{ color: '#374151', fontSize: 14 }} />
          <span style={{ fontSize: 13, color: '#fff', flex: 1 }}>{o.label}</span>
          {o.target_time && <span style={{ fontSize: 11, color: '#6b7280' }}>{o.target_time}</span>}
        </div>
      ))}
    </>
  )
}

function tomorrowLabel() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
