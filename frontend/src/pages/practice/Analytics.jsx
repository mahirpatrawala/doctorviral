import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts'

function StatCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="card text-center">
      <div className={`text-3xl font-bold ${color}`}>{value ?? '—'}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Analytics({ practiceId }) {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    axios.get(`/api/analytics/${practiceId}`, { params: { days } }).then(r => setData(r.data))
  }, [practiceId, days])

  if (!data) return <div className="text-center py-10 text-gray-400">Loading analytics...</div>

  const hourlyData = data.busyHours.map(h => ({
    hour: `${h.hour}:00`,
    patients: h.count,
  }))

  // Merge daily queue + appointments
  const allDates = new Set([
    ...data.dailyVolume.map(d => d.date),
    ...data.dailyAppts.map(d => d.date),
  ])
  const volumeData = Array.from(allDates).sort().map(date => ({
    date: date.slice(5), // MM-DD
    'Walk-ins': data.dailyVolume.find(d => d.date === date)?.queue_count || 0,
    'Appointments': data.dailyAppts.find(d => d.date === date)?.appt_count || 0,
  }))

  const feedbackRadar = data.feedback && [
    { metric: 'Overall', value: data.feedback.avg_rating || 0 },
    { metric: 'Wait Time', value: data.feedback.avg_wait_rating || 0 },
    { metric: 'Doctor', value: data.feedback.avg_doctor_rating || 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Analytics</h2>
        <div className="flex gap-1">
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-sm border transition ${days === d ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Patients" value={data.queue?.total_patients || 0} sub={`Last ${days} days`} />
        <StatCard label="No-show Rate" value={`${data.appointments?.no_show_rate || 0}%`}
          color={data.appointments?.no_show_rate > 20 ? 'text-red-600' : 'text-green-600'} />
        <StatCard label="Avg Consult" value={data.queue?.avg_consult_minutes ? `${Math.round(data.queue.avg_consult_minutes)}m` : '—'} sub="per patient" />
        <StatCard label="Avg Wait" value={data.queue?.avg_actual_wait_minutes ? `${Math.round(data.queue.avg_actual_wait_minutes)}m` : '—'} sub="actual wait time" />
        <StatCard label="Walk-outs" value={data.queue?.walkouts || 0}
          color={data.queue?.walkouts > 5 ? 'text-red-600' : 'text-gray-900'} sub="left queue" />
        <StatCard label="Reviews" value={data.feedback?.total_reviews || 0}
          sub={data.feedback?.avg_rating ? `⭐ ${Number(data.feedback.avg_rating).toFixed(1)} avg` : ''} />
      </div>

      {/* Busy hours */}
      {hourlyData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Busy Hours (Walk-ins)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="patients" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2">Use this to staff up or promote off-peak slots</p>
        </div>
      )}

      {/* Daily volume trend */}
      {volumeData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Daily Patient Volume (Last 14 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={volumeData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Walk-ins" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Appointments" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Duration by visit type */}
      {data.durationByType.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Avg Duration by Visit Type</h3>
          <div className="space-y-2">
            {data.durationByType.map(d => (
              <div key={d.visit_type} className="flex items-center gap-3">
                <div className="w-28 text-sm text-gray-600 truncate">{d.visit_type}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (d.avg_duration / 45) * 100)}%` }} />
                </div>
                <div className="text-sm font-medium text-gray-700 w-14 text-right">{Math.round(d.avg_duration)} min</div>
                <div className="text-xs text-gray-400 w-16">({d.sample_count} visits)</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">AI uses this to estimate durations when scheduling</p>
        </div>
      )}

      {/* Feedback summary */}
      {data.feedback && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Feedback Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-yellow-500">{Number(data.feedback.avg_rating || 0).toFixed(1)}</div>
              <div className="text-xs text-gray-500">Overall</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">{Number(data.feedback.avg_wait_rating || 0).toFixed(1)}</div>
              <div className="text-xs text-gray-500">Wait Time</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{Number(data.feedback.avg_doctor_rating || 0).toFixed(1)}</div>
              <div className="text-xs text-gray-500">Doctor</div>
            </div>
          </div>
          {data.feedback.negative_count > 0 && (
            <div className="mt-4 bg-red-50 rounded-lg p-3 text-sm text-red-800">
              ⚠️ {data.feedback.negative_count} negative review{data.feedback.negative_count > 1 ? 's' : ''} need attention.
              These are kept private and visible only to you.
            </div>
          )}
        </div>
      )}

      {/* Appointment breakdown */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Appointment Stats ({days}d)</h3>
        <div className="space-y-2 text-sm">
          {[
            ['Total booked', data.appointments?.total_appointments],
            ['Completed', data.appointments?.completed, 'text-green-600'],
            ['No-shows', data.appointments?.no_shows, 'text-red-600'],
            ['Cancellations', data.appointments?.cancellations, 'text-yellow-600'],
          ].map(([label, val, color]) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-500">{label}</span>
              <span className={`font-medium ${color || 'text-gray-900'}`}>{val ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
