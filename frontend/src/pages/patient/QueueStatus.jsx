import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useSocket } from '../../contexts/SocketContext'

const STATUS_INFO = {
  waiting:     { icon: '⏳', label: 'Waiting', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  called:      { icon: '📣', label: 'It\'s your turn!', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  in_progress: { icon: '👨‍⚕️', label: 'With the doctor', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  done:        { icon: '✅', label: 'Visit complete', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
  left:        { icon: '👋', label: 'Left queue', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
}

export default function QueueStatus() {
  const { token } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()
  const [entry, setEntry] = useState(null)
  const [leaving, setLeaving] = useState(false)

  const fetchStatus = useCallback(() => {
    axios.get(`/api/queue/status/${token}`).then(r => setEntry(r.data)).catch(() => {})
  }, [token])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // poll every 30s as fallback
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    if (!socket) return
    socket.emit('join_patient', token)
    socket.on('status_update', (data) => {
      if (data.token === token) setEntry(prev => ({ ...prev, ...data }))
    })
    return () => socket.off('status_update')
  }, [socket, token])

  const leaveQueue = async () => {
    setLeaving(true)
    await axios.delete(`/api/queue/leave/${token}`)
    fetchStatus()
    setLeaving(false)
  }

  if (!entry) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>

  const info = STATUS_INFO[entry.status] || STATUS_INFO.waiting

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="font-bold text-gray-900">{entry.practice_name}</h1>
          <p className="text-xs text-gray-500">Queue Status</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Status card */}
        <div className={`card border-2 ${info.bg}`}>
          <div className="text-center py-4">
            <div className="text-5xl mb-3">{info.icon}</div>
            <div className={`text-xl font-bold ${info.color}`}>{info.label}</div>
            <div className="text-sm text-gray-500 mt-1">{entry.patient_name}</div>
          </div>

          {entry.status === 'waiting' && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">#{entry.position}</div>
                <div className="text-xs text-gray-500">Position in queue</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {entry.estimated_wait_minutes != null ? `~${entry.estimated_wait_minutes}` : '—'}
                </div>
                <div className="text-xs text-gray-500">Minutes wait</div>
              </div>
            </div>
          )}

          {entry.status === 'called' && (
            <div className="mt-4 bg-blue-100 rounded-lg p-3 text-center">
              <p className="text-blue-800 font-medium">Please proceed to the clinic now!</p>
              <p className="text-blue-600 text-sm mt-1">Go to reception and check in.</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="card space-y-3">
          {entry.doctor_name && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Doctor</span>
              <span className="font-medium">{entry.doctor_name}</span>
            </div>
          )}
          {entry.visit_type_name && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Visit type</span>
              <span className="font-medium">{entry.visit_type_name}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Joined at</span>
            <span className="font-medium">{new Date(entry.joined_at).toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Queue token</span>
            <span className="font-mono text-xs text-gray-400">{token.slice(0, 8)}...</span>
          </div>
        </div>

        {/* People ahead */}
        {entry.status === 'waiting' && entry.people_ahead > 0 && (
          <div className="card">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{entry.people_ahead}</span> {entry.people_ahead === 1 ? 'person' : 'people'} ahead of you.
              You can stay here — we'll update this page automatically.
            </p>
          </div>
        )}

        {/* Reminder tip */}
        {entry.status === 'waiting' && (
          <div className="card bg-amber-50 border border-amber-100">
            <p className="text-sm text-amber-800">
              💡 <strong>Tip:</strong> Stay nearby! When you're called, please arrive at the clinic within 5 minutes or your slot may be given to the next patient.
            </p>
          </div>
        )}

        {/* Actions */}
        {['waiting', 'called'].includes(entry.status) && (
          <button
            onClick={leaveQueue}
            disabled={leaving}
            className="btn-danger w-full"
          >
            {leaving ? 'Leaving...' : 'Leave Queue'}
          </button>
        )}

        {entry.status === 'done' && (
          <button
            onClick={() => navigate(`/feedback/${entry.practice_id}?name=${encodeURIComponent(entry.patient_name)}`)}
            className="btn-primary w-full"
          >
            ⭐ Leave a Review
          </button>
        )}
      </div>
    </div>
  )
}
