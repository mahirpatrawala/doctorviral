import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

function StarRating({ value, onChange, label }) {
  return (
    <div className="mb-4">
      <label className="label">{label}</label>
      <div className="flex gap-2">
        {[1,2,3,4,5].map(s => (
          <button key={s} type="button" onClick={() => onChange(s)}
            className={`text-3xl transition ${s <= value ? 'text-yellow-400' : 'text-gray-200'}`}>
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  const { practiceId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    patient_name: searchParams.get('name') || '',
    rating: 0,
    wait_time_rating: 0,
    doctor_rating: 0,
    comment: '',
    source: 'app',
  })
  const [submitted, setSubmitted] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!form.rating) return setError('Please rate your overall experience')
    setLoading(true)
    try {
      const res = await axios.post('/api/feedback', { ...form, practice_id: practiceId })
      setSubmitted(res.data)
    } catch {
      setError('Failed to submit. Please try again.')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center py-10">
          <div className="text-5xl mb-4">{submitted.is_public ? '🌟' : '🙏'}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
          <p className="text-gray-600 mb-6">{submitted.message}</p>
          <button onClick={() => navigate(`/patient/${practiceId}`)} className="btn-primary w-full">Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="font-bold text-gray-900">Leave a Review</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={submit} className="card space-y-2">
          <div className="mb-4">
            <label className="label">Your Name</label>
            <input className="input" placeholder="Name (optional)" value={form.patient_name}
              onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} />
          </div>

          <StarRating label="Overall Experience *" value={form.rating}
            onChange={v => setForm(f => ({ ...f, rating: v }))} />

          <StarRating label="Wait Time" value={form.wait_time_rating}
            onChange={v => setForm(f => ({ ...f, wait_time_rating: v }))} />

          <StarRating label="Doctor" value={form.doctor_rating}
            onChange={v => setForm(f => ({ ...f, doctor_rating: v }))} />

          <div>
            <label className="label">Comment</label>
            <textarea className="input" rows={4} placeholder="Tell us about your experience..."
              value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
          </div>

          <div>
            <label className="label">How did you come to us?</label>
            <select className="input" value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              <option value="app">Waitwell App</option>
              <option value="walk-in">Walk-in</option>
              <option value="digital">Social media / Digital</option>
              <option value="referral">Referral</option>
            </select>
          </div>

          {form.rating > 0 && form.rating < 4 && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-orange-800">
              We're sorry to hear about your experience. Your feedback will be reviewed by our team privately so we can improve.
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  )
}
