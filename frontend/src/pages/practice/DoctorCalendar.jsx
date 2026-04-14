import { useEffect, useState } from 'react'
import { format, addDays } from 'date-fns'
import axios from 'axios'
import { useSocket } from '../../contexts/SocketContext'

// 9:00 → 14:00 in 15-min slots
const SLOTS = Array.from({ length: 20 }, (_, i) => {
  const totalMins = 9 * 60 + i * 15
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const STATUS_COLORS = {
  scheduled:   'bg-blue-100 border-blue-300 text-blue-900',
  confirmed:   'bg-indigo-100 border-indigo-300 text-indigo-900',
  arrived:     'bg-teal-100 border-teal-300 text-teal-900',
  in_progress: 'bg-green-100 border-green-400 text-green-900',
  done:        'bg-gray-100 border-gray-300 text-gray-500',
  no_show:     'bg-red-100 border-red-300 text-red-700',
  cancelled:   'bg-gray-50 border-gray-200 text-gray-400 line-through',
}

function slotKey(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00`
}

// Build a map: doctorId → { "HH:MM": { appointment, spanRows } }
function buildGrid(appointments, dateStr) {
  const grid = {}
  appointments.forEach(appt => {
    if (!appt.doctor_id) return
    if (!grid[appt.doctor_id]) grid[appt.doctor_id] = {}

    const start = new Date(appt.scheduled_at)
    const startTime = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`
    const spanRows = Math.max(1, Math.round(appt.duration_minutes / 15))

    grid[appt.doctor_id][startTime] = { appt, spanRows }

    // Mark occupied follow-on slots so we skip rendering them
    for (let i = 1; i < spanRows; i++) {
      const mins = start.getHours() * 60 + start.getMinutes() + i * 15
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const key = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
      grid[appt.doctor_id][key] = { occupied: true }
    }
  })
  return grid
}

export default function DoctorCalendar({ practiceId }) {
  const socket = useSocket()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])

  const fetchData = () => {
    axios.get(`/api/appointments/${practiceId}`, { params: { date } }).then(r => setAppointments(r.data))
  }

  useEffect(() => {
    axios.get(`/api/practices/${practiceId}`).then(r => setDoctors(r.data.doctors || []))
  }, [practiceId])

  useEffect(() => { fetchData() }, [practiceId, date])

  useEffect(() => {
    if (!socket) return
    socket.on('appointment_updated', fetchData)
    return () => socket.off('appointment_updated', fetchData)
  }, [socket, date])

  const grid = buildGrid(appointments, date)

  const dateOptions = [-1, 0, 1, 2, 3].map(offset => {
    const d = addDays(new Date(), offset)
    return { value: format(d, 'yyyy-MM-dd'), label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : format(d, 'EEE d') }
  })

  const totalAppts = appointments.filter(a => !['cancelled', 'no_show'].includes(a.status)).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Doctor Calendar</h2>
          <p className="text-xs text-gray-500 mt-0.5">Working hours: 9:00 AM – 2:00 PM</p>
        </div>
        <div className="text-sm text-gray-500">
          {totalAppts} appointment{totalAppts !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Date picker */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dateOptions.map(d => (
          <button key={d.value} onClick={() => setDate(d.value)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap border transition ${
              date === d.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {d.label}
          </button>
        ))}
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap">
        {[['scheduled','Scheduled'],['confirmed','Confirmed'],['arrived','Arrived'],['in_progress','In Progress'],['done','Done'],['no_show','No-show']].map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${STATUS_COLORS[status]}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {doctors.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">No active doctors found.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm min-w-max">
            <thead>
              <tr className="border-b border-gray-100">
                {/* Time column header */}
                <th className="w-16 px-3 py-3 text-left text-xs font-semibold text-gray-400 bg-gray-50 border-r border-gray-100 sticky left-0">
                  Time
                </th>
                {doctors.map(doc => (
                  <th key={doc.id} className="px-4 py-3 text-left bg-gray-50 border-r border-gray-100 last:border-r-0 min-w-40">
                    <div className="font-semibold text-gray-800 text-sm">{doc.name}</div>
                    <div className="text-xs text-gray-400 font-normal">{doc.specialty}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot, rowIdx) => {
                const isHour = slot.endsWith(':00')
                return (
                  <tr key={slot} className={`border-b border-gray-50 ${isHour ? 'border-b-gray-200' : ''}`}>
                    {/* Time label */}
                    <td className={`px-3 py-0 text-xs sticky left-0 bg-white border-r border-gray-100 ${isHour ? 'font-semibold text-gray-600 pt-2' : 'text-gray-300'}`}
                      style={{ height: '36px', verticalAlign: 'top', paddingTop: isHour ? '6px' : '0' }}>
                      {isHour ? slot : ''}
                    </td>

                    {doctors.map(doc => {
                      const cell = grid[doc.id]?.[slot]
                      if (cell?.occupied) return null // spanned by previous row
                      if (!cell) {
                        return (
                          <td key={doc.id} className="border-r border-gray-50 last:border-r-0 px-1"
                            style={{ height: '36px' }}>
                            <div className="h-full w-full rounded border border-dashed border-gray-100" />
                          </td>
                        )
                      }

                      const { appt, spanRows } = cell
                      return (
                        <td key={doc.id}
                          rowSpan={spanRows}
                          className="border-r border-gray-100 last:border-r-0 px-1 py-0.5 align-top"
                          style={{ height: `${spanRows * 36}px` }}>
                          <div className={`h-full rounded border px-2 py-1 flex flex-col justify-between overflow-hidden ${STATUS_COLORS[appt.status]}`}
                            style={{ minHeight: `${spanRows * 36 - 4}px` }}>
                            <div>
                              <div className="font-semibold text-xs leading-tight truncate">{appt.patient_name}</div>
                              {spanRows >= 2 && appt.visit_type_name && (
                                <div className="text-xs opacity-70 truncate">{appt.visit_type_name}</div>
                              )}
                            </div>
                            {spanRows >= 3 && (
                              <div className="text-xs opacity-60">{appt.duration_minutes} min</div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reschedule request alerts are handled in Dashboard.jsx */}
    </div>
  )
}
