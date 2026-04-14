import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function JoinQueue() {
  const { practiceId } = useParams()
  const navigate = useNavigate()
  const [practice, setPractice] = useState(null)
  const [form, setForm] = useState({ patient_name: '', patient_phone: '', doctor_id: '', visit_type_id: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get(`/api/practices/${practiceId}`).then(r => setPractice(r.data))
  }, [practiceId])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.patient_name.trim()) return setError('Name is required')
    setLoading(true)
    try {
      const res = await axios.post('/api/queue', { ...form, practice_id: practiceId })
      navigate(`/queue/status/${res.data.token}`)
    } catch {
      setError('Failed to join queue. Please try again.')
      setLoading(false)
    }
  }

  if (!practice) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="font-bold text-gray-900">Join Queue — {practice.name}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="card">
          <div className="bg-blue-50 rounded-lg p-4 mb-6 flex gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-sm font-medium text-blue-900">Virtual Queue</p>
              <p className="text-sm text-blue-700">You don't need to wait at the clinic. We'll notify you when your turn is near.</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Your Name *</label>
              <input className="input" placeholder="Full name" value={form.patient_name}
                onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} />
            </div>

            <div>
              <label className="label">Phone Number</label>
              <input className="input" placeholder="+91 99999 99999" value={form.patient_phone}
                onChange={e => setForm(f => ({ ...f, patient_phone: e.target.value }))} />
            </div>

            <div>
              <label className="label">Doctor (optional)</label>
              <select className="input" value={form.doctor_id}
                onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
                <option value="">Any available doctor</option>
                {practice.doctors?.map(d => (
                  <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Reason for Visit</label>
              <select className="input" value={form.visit_type_id}
                onChange={e => setForm(f => ({ ...f, visit_type_id: e.target.value }))}>
                <option value="">Select reason</option>
                {practice.visitTypes?.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (~{t.base_duration_minutes} min)</option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Joining...' : '→ Join Queue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
