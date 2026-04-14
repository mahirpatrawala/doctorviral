import { useEffect, useState } from 'react'
import { format, addDays } from 'date-fns'
import axios from 'axios'
import { supabase } from '../../lib/supabase'

const STATUS_COLOR = {
  scheduled: 'badge-scheduled',
  confirmed: 'bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full',
  arrived: 'bg-teal-100 text-teal-700 text-xs font-medium px-2 py-0.5 rounded-full',
  in_progress: 'badge-in_progress', done: 'badge-done', no_show: 'badge-no_show', cancelled: 'badge-cancelled',
}

export default function AppointmentManager({ practiceId }) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [appointments, setAppointments] = useState([])
  const [noShowRate, setNoShowRate] = useState(null)

  const fetchAppts = () => {
    axios.get(`/api/appointments?practiceId=${practiceId}&date=${date}`).then(r => setAppointments(r.data))
  }

  useEffect(() => { fetchAppts() }, [practiceId, date])
  useEffect(() => {
    axios.get(`/api/analytics/${practiceId}`).then(r => setNoShowRate(r.data.appointments?.no_show_rate))
  }, [practiceId])

  useEffect(() => {
    const channel = supabase
      .channel(`appts-${practiceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `practice_id=eq.${practiceId}` }, fetchAppts)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [practiceId, date])

  const updateStatus = async (id, status) => {
    await axios.patch(`/api/appointments/${id}?action=status`, { status })
    fetchAppts()
  }

  const dateOptions = [-1, 0, 1, 2, 3].map(offset => {
    const d = addDays(new Date(), offset)
    return { value: format(d, 'yyyy-MM-dd'), label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : format(d, 'EEE MMM d') }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Appointments</h2>
        {noShowRate != null && (
          <div className={`text-sm font-medium px-3 py-1 rounded-full ${noShowRate > 20 ? 'bg-red-100 text-red-700' : noShowRate > 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
            {noShowRate}% no-show rate
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {dateOptions.map(d => (
          <button key={d.value} onClick={() => setDate(d.value)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap border transition ${date === d.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {d.label}
          </button>
        ))}
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {appointments.length === 0 && <div className="card text-center py-10 text-gray-400"><div className="text-3xl mb-2">📅</div><p>No appointments for this date</p></div>}

      <div className="space-y-3">
        {appointments.map(appt => (
          <div key={appt.id} className={`card border-l-4 ${appt.status === 'in_progress' ? 'border-l-green-500' : appt.status === 'arrived' ? 'border-l-teal-500' : appt.status === 'no_show' ? 'border-l-red-400' : appt.status === 'cancelled' ? 'border-l-gray-300' : appt.status === 'done' ? 'border-l-gray-400' : 'border-l-blue-400'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{appt.patient_name}</span>
                  <span className={STATUS_COLOR[appt.status] || 'badge-scheduled'}>{appt.status.replace('_', ' ')}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">🕐 {format(new Date(appt.scheduled_at), 'h:mm a')} · {appt.duration_minutes} min</div>
                <div className="text-xs text-gray-400 mt-0.5 space-x-2">
                  {appt.doctor_name && <span>👨‍⚕️ {appt.doctor_name}</span>}
                  {appt.visit_type_name && <span>🏷 {appt.visit_type_name}</span>}
                  {appt.patient_phone && <span>📞 {appt.patient_phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              {[['24h', appt.reminder_24h_sent], ['2h', appt.reminder_2h_sent], ['30m', appt.reminder_30m_sent]].map(([label, sent]) => (
                <span key={label} className={`text-xs px-1.5 py-0.5 rounded ${sent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {sent ? '✓' : '○'} {label}
                </span>
              ))}
              <span className="text-xs text-gray-400 ml-1">reminders</span>
            </div>
            {!['done', 'cancelled'].includes(appt.status) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {appt.status === 'scheduled' && <button onClick={() => updateStatus(appt.id, 'confirmed')} className="btn-secondary text-xs px-2 py-1">✓ Confirm</button>}
                {['scheduled', 'confirmed'].includes(appt.status) && <button onClick={() => updateStatus(appt.id, 'arrived')} className="bg-teal-600 text-white text-xs px-2 py-1 rounded-lg hover:bg-teal-700">🚶 Arrived</button>}
                {appt.status === 'arrived' && <button onClick={() => updateStatus(appt.id, 'in_progress')} className="btn-success text-xs px-2 py-1">▶ Start</button>}
                {appt.status === 'in_progress' && <button onClick={() => updateStatus(appt.id, 'done')} className="btn-success text-xs px-2 py-1">✓ Done</button>}
                {!['done', 'no_show', 'arrived', 'in_progress'].includes(appt.status) && <button onClick={() => updateStatus(appt.id, 'no_show')} className="btn-danger text-xs px-2 py-1">✗ No-show</button>}
                {!['done', 'cancelled', 'in_progress'].includes(appt.status) && <button onClick={() => updateStatus(appt.id, 'cancelled')} className="text-gray-400 text-xs px-2 py-1 hover:text-gray-600">Cancel</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
