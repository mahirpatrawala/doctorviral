import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { useSocket } from '../../contexts/SocketContext'
import { formatDistanceToNow } from 'date-fns'

const STATUS_BADGE = {
  waiting: 'badge-waiting',
  called: 'badge-called',
  in_progress: 'badge-in_progress',
  done: 'badge-done',
  left: 'badge-left',
}

const STATUS_LABEL = {
  waiting: 'Waiting',
  called: 'Called',
  in_progress: 'In Progress',
  done: 'Done',
  left: 'Left',
}

export default function QueueManager({ practiceId }) {
  const socket = useSocket()
  const [queue, setQueue] = useState([])
  const [addForm, setAddForm] = useState({ patient_name: '', patient_phone: '', doctor_id: '', visit_type_id: '' })
  const [practice, setPractice] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchQueue = useCallback(() => {
    axios.get(`/api/queue/${practiceId}`).then(r => setQueue(r.data))
  }, [practiceId])

  useEffect(() => {
    fetchQueue()
    axios.get(`/api/practices/${practiceId}`).then(r => setPractice(r.data))
  }, [practiceId, fetchQueue])

  useEffect(() => {
    if (!socket) return
    socket.on('queue_updated', (data) => setQueue(data))
    return () => socket.off('queue_updated')
  }, [socket])

  const action = async (id, act) => {
    await axios.patch(`/api/queue/${id}/action`, { action: act })
    fetchQueue()
  }

  const addWalkIn = async (e) => {
    e.preventDefault()
    if (!addForm.patient_name.trim()) return
    setLoading(true)
    await axios.post('/api/queue/join', { ...addForm, practice_id: practiceId })
    setAddForm({ patient_name: '', patient_phone: '', doctor_id: '', visit_type_id: '' })
    setShowAdd(false)
    fetchQueue()
    setLoading(false)
  }

  const active = queue.filter(e => ['waiting', 'called', 'in_progress'].includes(e.status))
  const current = active.find(e => e.status === 'in_progress')
  const next = active.find(e => e.status === 'called') || active.find(e => e.status === 'waiting')

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-yellow-600">{active.filter(e => e.status === 'waiting').length}</div>
          <div className="text-xs text-gray-500">Waiting</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{current ? 1 : 0}</div>
          <div className="text-xs text-gray-500">In Progress</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-600">{queue.filter(e => e.status === 'done').length}</div>
          <div className="text-xs text-gray-500">Done Today</div>
        </div>
      </div>

      {/* Add walk-in */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Live Queue</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm px-3 py-1.5">
          + Add Walk-in
        </button>
      </div>

      {showAdd && practice && (
        <form onSubmit={addWalkIn} className="card border border-blue-100 bg-blue-50 space-y-3">
          <h3 className="font-medium text-blue-900">Add patient to queue</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name *</label>
              <input className="input" placeholder="Patient name" value={addForm.patient_name}
                onChange={e => setAddForm(f => ({ ...f, patient_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="Phone number" value={addForm.patient_phone}
                onChange={e => setAddForm(f => ({ ...f, patient_phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Doctor</label>
              <select className="input" value={addForm.doctor_id}
                onChange={e => setAddForm(f => ({ ...f, doctor_id: e.target.value }))}>
                <option value="">Any</option>
                {practice.doctors?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Visit Type</label>
              <select className="input" value={addForm.visit_type_id}
                onChange={e => setAddForm(f => ({ ...f, visit_type_id: e.target.value }))}>
                <option value="">Select</option>
                {practice.visitTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary text-sm">Add to Queue</button>
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Queue list */}
      {active.length === 0 && (
        <div className="card text-center py-10 text-gray-400">
          <div className="text-3xl mb-2">🎉</div>
          <p>Queue is empty</p>
        </div>
      )}

      {active.map(entry => (
        <div key={entry.id} className={`card border-l-4 ${
          entry.status === 'in_progress' ? 'border-l-green-500' :
          entry.status === 'called' ? 'border-l-blue-500' : 'border-l-yellow-400'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">
                #{entry.position}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{entry.patient_name}</div>
                <div className="text-xs text-gray-500 space-x-2">
                  {entry.patient_phone && <span>📞 {entry.patient_phone}</span>}
                  {entry.doctor_name && <span>👨‍⚕️ {entry.doctor_name}</span>}
                  {entry.visit_type_name && <span>🏷 {entry.visit_type_name}</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Joined {formatDistanceToNow(new Date(entry.joined_at), { addSuffix: true })}
                  {entry.estimated_wait_minutes != null && ` · ~${entry.estimated_wait_minutes} min est.`}
                </div>
              </div>
            </div>
            <span className={STATUS_BADGE[entry.status]}>{STATUS_LABEL[entry.status]}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {entry.status === 'waiting' && (
              <button onClick={() => action(entry.id, 'call')} className="btn-primary text-xs px-3 py-1">
                📣 Call Patient
              </button>
            )}
            {entry.status === 'called' && (
              <button onClick={() => action(entry.id, 'start')} className="btn-success text-xs px-3 py-1">
                ▶ Start Consultation
              </button>
            )}
            {entry.status === 'in_progress' && (
              <button onClick={() => action(entry.id, 'complete')} className="btn-success text-xs px-3 py-1">
                ✓ Mark Complete
              </button>
            )}
            {['waiting', 'called'].includes(entry.status) && (
              <button onClick={() => action(entry.id, 'skip')} className="btn-danger text-xs px-3 py-1">
                Skip / Left
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
