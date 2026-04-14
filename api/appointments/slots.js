import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'
import { estimateDuration } from '../_lib/aiScheduler.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const { practiceId, doctor_id, date, visit_type_id } = req.query
  if (!doctor_id || !date) return res.status(400).json({ error: 'doctor_id and date required' })

  const duration = await estimateDuration(doctor_id, visit_type_id, practiceId)

  const { data: booked } = await supabase
    .from('appointments')
    .select('scheduled_at, duration_minutes')
    .eq('practice_id', practiceId)
    .eq('doctor_id', doctor_id)
    .gte('scheduled_at', `${date}T00:00:00`)
    .lte('scheduled_at', `${date}T23:59:59`)
    .not('status', 'in', '("cancelled","no_show")')

  const slots = []
  const start = new Date(`${date}T09:00:00`)
  const end = new Date(`${date}T14:00:00`) // 9am–2pm

  for (let t = new Date(start); t < end; t = new Date(t.getTime() + duration * 60000)) {
    const slotEnd = new Date(t.getTime() + duration * 60000)
    const isBooked = (booked || []).some(b => {
      const bStart = new Date(b.scheduled_at)
      const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000)
      return t < bEnd && slotEnd > bStart
    })
    if (!isBooked && slotEnd <= end) {
      slots.push({ time: t.toISOString(), duration_minutes: duration, available: true })
    }
  }

  res.json(slots)
}
