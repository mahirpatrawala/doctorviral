import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { format, addDays, startOfDay } from 'date-fns'

export default function BookAppointment() {
  const { practiceId } = useParams()
  const navigate = useNavigate()
  const [practice, setPractice] = useState(null)
  const [step, setStep] = useState(1) // 1: details, 2: pick slot, 3: confirm
  const [form, setForm] = useState({ patient_name: '', patient_phone: '', doctor_id: '', visit_type_id: '' })
  const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get(`/api/practices/${practiceId}`).then(r => setPractice(r.data))
  }, [practiceId])

  useEffect(() => {
    if (step === 2 && form.doctor_id) {
      setSlots([])
      setSelectedSlot(null)
      axios.get(`/api/appointments/${practiceId}/slots`, {
        params: { doctor_id: form.doctor_id, date: selectedDate, visit_type_id: form.visit_type_id }
      }).then(r => setSlots(r.data))
    }
  }, [step, form.doctor_id, selectedDate, form.visit_type_id, practiceId])

  const goToSlots = (e) => {
    e.preventDefault()
    if (!form.patient_name.trim()) return setError('Name is required')
    if (!form.doctor_id) return setError('Please select a doctor')
    setError('')
    setStep(2)
  }

  const confirm = async () => {
    if (!selectedSlot) return
    setLoading(true)
    try {
      const res = await axios.post('/api/appointments', {
        ...form,
        practice_id: practiceId,
        scheduled_at: selectedSlot.time,
      })
      setSuccess(res.data)
      setStep(3)
    } catch {
      setError('Booking failed. Please try again.')
    }
    setLoading(false)
  }

  if (!practice) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>

  // Date options: next 7 days
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i + 1)
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE, MMM d') }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <div>
            <h1 className="font-bold text-gray-900">Book Appointment</h1>
            <p className="text-xs text-gray-500">{practice.name}</p>
          </div>
        </div>
        {/* Steps */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="flex gap-2">
            {['Details', 'Pick Time', 'Confirm'].map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full ${step > i ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {step === 1 && (
          <form onSubmit={goToSlots} className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Your Details</h2>
            <div>
              <label className="label">Name *</label>
              <input className="input" placeholder="Full name" value={form.patient_name}
                onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="+91 99999 99999" value={form.patient_phone}
                onChange={e => setForm(f => ({ ...f, patient_phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Doctor *</label>
              <select className="input" value={form.doctor_id}
                onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
                <option value="">Select doctor</option>
                {practice.doctors?.map(d => (
                  <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Visit Reason</label>
              <select className="input" value={form.visit_type_id}
                onChange={e => setForm(f => ({ ...f, visit_type_id: e.target.value }))}>
                <option value="">Select reason</option>
                {practice.visitTypes?.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (~{t.base_duration_minutes} min)</option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full py-3">Pick a Time →</button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="card">
              <label className="label">Date</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dateOptions.map(d => (
                  <button key={d.value}
                    onClick={() => setSelectedDate(d.value)}
                    className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border transition ${selectedDate === d.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Available Slots</h2>
              {slots.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No slots available for this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map(slot => (
                    <button key={slot.time}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2 rounded-lg text-sm border transition ${selectedSlot?.time === slot.time ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}>
                      {format(new Date(slot.time), 'h:mm a')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSlot && (
              <div className="card bg-blue-50 border border-blue-100">
                <p className="text-sm text-blue-800">
                  Selected: <strong>{format(new Date(selectedSlot.time), 'EEE MMM d, h:mm a')}</strong>
                  <span className="text-blue-600"> ({selectedSlot.duration_minutes} min)</span>
                </p>
              </div>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button onClick={confirm} disabled={!selectedSlot || loading} className="btn-primary w-full py-3">
              {loading ? 'Booking...' : 'Confirm Booking →'}
            </button>
          </div>
        )}

        {step === 3 && success && (
          <div className="card text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
            <p className="text-gray-600 mb-1">{success.patient_name}</p>
            <p className="text-blue-600 font-semibold text-lg mb-6">
              {format(new Date(success.scheduled_at), 'EEEE, MMMM d')} at {format(new Date(success.scheduled_at), 'h:mm a')}
            </p>
            <div className="bg-amber-50 rounded-lg p-4 text-sm text-amber-800 mb-6">
              <p className="font-medium mb-1">Reminders will be sent at:</p>
              <p>• 24 hours before</p>
              <p>• 2 hours before</p>
              <p>• 30 minutes before</p>
            </div>
            <button onClick={() => navigate(`/patient/${practiceId}`)} className="btn-secondary w-full">Back to Home</button>
          </div>
        )}
      </div>
    </div>
  )
}
