import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const { practiceId } = req.query
  const days = Number(req.query.days) || 30
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [queueRows, apptRows, historyRows, feedbackRows] = await Promise.all([
    supabase.from('queue_entries').select('status, started_at, completed_at, joined_at, estimated_wait_minutes').eq('practice_id', practiceId).gte('joined_at', since),
    supabase.from('appointments').select('status, scheduled_at, created_at').eq('practice_id', practiceId).gte('created_at', since),
    supabase.from('visit_history').select('actual_duration_minutes, visit_type_id, doctor_id, visited_at').eq('practice_id', practiceId),
    supabase.from('feedback').select('rating, wait_time_rating, doctor_rating, is_public').eq('practice_id', practiceId),
  ])

  const queue = queueRows.data || []
  const appts = apptRows.data || []
  const history = historyRows.data || []
  const feedback = feedbackRows.data || []

  // Queue stats
  const done = queue.filter(e => e.status === 'done')
  const consultDurations = done.filter(e => e.started_at && e.completed_at)
    .map(e => (new Date(e.completed_at) - new Date(e.started_at)) / 60000)
  const waitDurations = done.filter(e => e.started_at && e.joined_at)
    .map(e => (new Date(e.started_at) - new Date(e.joined_at)) / 60000)

  const queueStats = {
    total_patients: queue.length,
    avg_consult_minutes: avg(consultDurations),
    avg_actual_wait_minutes: avg(waitDurations),
    walkouts: queue.filter(e => e.status === 'left').length,
    completed: done.length,
  }

  // Appointment stats
  const noShows = appts.filter(a => a.status === 'no_show').length
  const apptStats = {
    total_appointments: appts.length,
    no_shows: noShows,
    cancellations: appts.filter(a => a.status === 'cancelled').length,
    completed: appts.filter(a => a.status === 'done').length,
    no_show_rate: appts.length ? Math.round(10 * noShows / appts.length * 100) / 10 : 0,
  }

  // Busy hours (walk-ins)
  const hourMap = {}
  queue.forEach(e => {
    const h = new Date(e.joined_at).getHours()
    const key = String(h).padStart(2, '0')
    hourMap[key] = (hourMap[key] || 0) + 1
  })
  const busyHours = Object.entries(hourMap).sort().map(([hour, count]) => ({ hour, count }))

  // Daily volume (last 14 days)
  const recent14Queue = queue.filter(e => e.joined_at >= since14)
  const recent14Appts = appts.filter(a => a.scheduled_at >= since14)
  const dayMapQ = {}, dayMapA = {}
  recent14Queue.forEach(e => { const d = e.joined_at.split('T')[0]; dayMapQ[d] = (dayMapQ[d] || 0) + 1 })
  recent14Appts.forEach(a => { const d = a.scheduled_at.split('T')[0]; dayMapA[d] = (dayMapA[d] || 0) + 1 })
  const allDates = [...new Set([...Object.keys(dayMapQ), ...Object.keys(dayMapA)])].sort()
  const dailyVolume = allDates.map(date => ({ date, queue_count: dayMapQ[date] || 0 }))
  const dailyAppts = allDates.map(date => ({ date, appt_count: dayMapA[date] || 0 }))

  // Duration by visit type
  const typeMap = {}
  history.forEach(h => {
    const k = h.visit_type_id
    if (!typeMap[k]) typeMap[k] = []
    typeMap[k].push(h.actual_duration_minutes)
  })
  const { data: vtRows } = await supabase.from('visit_types').select('id, name').eq('practice_id', practiceId)
  const vtLookup = Object.fromEntries((vtRows || []).map(v => [v.id, v.name]))
  const durationByType = Object.entries(typeMap).map(([id, vals]) => ({
    visit_type: vtLookup[id] || `Type ${id}`,
    avg_duration: avg(vals),
    sample_count: vals.length,
  })).sort((a, b) => b.avg_duration - a.avg_duration)

  // Feedback
  const feedbackStats = {
    avg_rating: avg(feedback.map(f => f.rating)),
    avg_wait_rating: avg(feedback.filter(f => f.wait_time_rating).map(f => f.wait_time_rating)),
    avg_doctor_rating: avg(feedback.filter(f => f.doctor_rating).map(f => f.doctor_rating)),
    total_reviews: feedback.length,
    negative_count: feedback.filter(f => f.rating < 4).length,
  }

  res.json({ queue: queueStats, appointments: apptStats, busyHours, dailyVolume, dailyAppts, durationByType, feedback: feedbackStats })
}

function avg(arr) {
  if (!arr?.length) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
