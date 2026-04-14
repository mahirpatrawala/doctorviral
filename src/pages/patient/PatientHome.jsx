import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function PatientHome() {
  const { practiceId } = useParams()
  const navigate = useNavigate()
  const [practice, setPractice] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    axios.get(`/api/practices/${practiceId}`).then(r => {
      if (r.data?.name) setPractice(r.data)
      else setError(r.data?.error || 'Practice not found')
    }).catch(e => setError(e.message))
    axios.get(`/api/feedback/${practiceId}?public=true`).then(r => setFeedback(r.data)).catch(() => {})
  }, [practiceId])

  if (error) return <div className="flex items-center justify-center h-screen"><div className="text-center text-gray-500"><p className="text-lg font-medium">Could not load practice</p><p className="text-sm mt-1 text-red-500">{error}</p></div></div>
  if (!practice) return <div className="flex items-center justify-center h-screen"><div className="text-gray-400">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
              {practice.name?.[0] || "?"}
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{practice.name}</h1>
              <p className="text-xs text-gray-500">{practice.address}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Main actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate(`/patient/${practiceId}/queue`)}
            className="card hover:shadow-md transition cursor-pointer flex flex-col items-center gap-3 py-8"
          >
            <div className="text-4xl">🚶</div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Walk In</div>
              <div className="text-xs text-gray-500 mt-1">Join virtual queue now</div>
            </div>
          </button>
          <button
            onClick={() => navigate(`/patient/${practiceId}/book`)}
            className="card hover:shadow-md transition cursor-pointer flex flex-col items-center gap-3 py-8"
          >
            <div className="text-4xl">📅</div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Book Slot</div>
              <div className="text-xs text-gray-500 mt-1">Reserve a time in advance</div>
            </div>
          </button>
        </div>

        {/* Reviews summary */}
        {feedback?.stats?.total_reviews > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Patient Reviews</h2>
              <button onClick={() => navigate(`/feedback/${practiceId}`)} className="text-xs text-blue-600">Leave review →</button>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold text-gray-900">{feedback.stats.avg_rating?.toFixed(1)}</div>
              <div>
                <div className="flex gap-0.5 text-yellow-400">
                  {[1,2,3,4,5].map(s => (
                    <span key={s}>{s <= Math.round(feedback.stats.avg_rating) ? '★' : '☆'}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-500">{feedback.stats.total_reviews} reviews</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Wait time</span>
                <span className="font-medium">{feedback.stats.avg_wait_rating?.toFixed(1) || '—'} / 5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Doctor</span>
                <span className="font-medium">{feedback.stats.avg_doctor_rating?.toFixed(1) || '—'} / 5</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent reviews */}
        {feedback?.feedback?.slice(0, 3).map(f => (
          <div key={f.id} className="card">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{f.patient_name}</span>
              <div className="flex gap-0.5 text-yellow-400 text-sm">
                {[1,2,3,4,5].map(s => <span key={s}>{s <= f.rating ? '★' : '☆'}</span>)}
              </div>
            </div>
            {f.comment && <p className="text-sm text-gray-600">{f.comment}</p>}
          </div>
        ))}

        {/* Doctors */}
        {practice.doctors?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Our Doctors</h2>
            <div className="space-y-2">
              {practice.doctors.map(d => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-sm font-bold">
                    {d.name.split(' ').pop()[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-gray-500">{d.specialty}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-2">Contact</h2>
          <p className="text-sm text-gray-600">📞 {practice.phone}</p>
          <p className="text-sm text-gray-600 mt-1">📍 {practice.address}</p>
        </div>
      </div>
    </div>
  )
}
