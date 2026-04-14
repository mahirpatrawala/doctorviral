import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import QueueManager from './QueueManager'
import AppointmentManager from './AppointmentManager'
import Analytics from './Analytics'
import QRSection from './QRSection'
import DoctorCalendar from './DoctorCalendar'

const TABS = ['Queue', 'Appointments', 'Calendar', 'Analytics', 'QR Code']

export default function Dashboard() {
  const { practiceId } = useParams()
  const navigate = useNavigate()
  const [practice, setPractice] = useState(null)
  const [tab, setTab] = useState('Queue')
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    const stored = sessionStorage.getItem('practice')
    if (!stored) { navigate('/practice'); return }
    const p = JSON.parse(stored)
    if (p.id != practiceId) { navigate('/practice'); return }
    setPractice(p)
  }, [practiceId, navigate])

  // Subscribe to notifications table for real-time dashboard alerts
  useEffect(() => {
    if (!practiceId) return
    const channel = supabase
      .channel(`notifications-${practiceId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `practice_id=eq.${practiceId}`,
      }, (payload) => {
        setAlerts(prev => [payload.new, ...prev].slice(0, 5))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [practiceId])

  if (!practice) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">{practice.name?.[0] || "?"}</div>
              <div>
                <h1 className="font-bold text-gray-900 text-sm">{practice.name}</h1>
                <p className="text-xs text-gray-500">Practice Dashboard</p>
              </div>
            </div>
            <button onClick={() => { sessionStorage.removeItem('practice'); navigate('/practice') }} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time notification alerts */}
      {alerts.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pt-4 space-y-2">
          {alerts.slice(0, 2).map((alert, i) => {
            const isReschedule = alert.type === 'reschedule_requested'
            const isVoice = alert.data?.voice_call
            return (
              <div key={i} className={`border rounded-lg px-4 py-2 text-sm flex justify-between items-center ${isReschedule ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className={isReschedule ? 'text-orange-800' : 'text-amber-800'}>
                  {isReschedule
                    ? <>📞 <strong>{alert.data?.patient_name}</strong> wants to reschedule — call {alert.data?.patient_phone}</>
                    : <>{isVoice ? '📞 Voice call placed' : '📩 Reminder sent'} to <strong>{alert.data?.patient_name}</strong></>
                  }
                </span>
                <button onClick={() => setAlerts(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600 ml-3">✕</button>
              </div>
            )
          })}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4">
        {tab === 'Queue' && <QueueManager practiceId={practiceId} />}
        {tab === 'Appointments' && <AppointmentManager practiceId={practiceId} />}
        {tab === 'Calendar' && <DoctorCalendar practiceId={practiceId} />}
        {tab === 'Analytics' && <Analytics practiceId={practiceId} />}
        {tab === 'QR Code' && <QRSection practiceId={practiceId} />}
      </div>
    </div>
  )
}
