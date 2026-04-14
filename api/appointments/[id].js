import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'
import { estimateDuration } from '../_lib/aiScheduler.js'

const VALID_STATUS = ['scheduled', 'confirmed', 'arrived', 'in_progress', 'done', 'no_show', 'cancelled']

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  const { id, action } = req.query

  // GET /api/appointments/slots?practiceId=&doctor_id=&date=&visit_type_id=
  if (id === 'slots') {
    if (req.method !== 'GET') return res.status(405).end()
    const { practiceId, doctor_id, date, visit_type_id } = req.query
    if (!doctor_id || !date) return res.status(400).json({ error: 'doctor_id and date required' })

    const duration = await estimateDuration(doctor_id, visit_type_id, practiceId)
    const { data: booked } = await supabase
      .from('appointments').select('scheduled_at, duration_minutes')
      .eq('practice_id', practiceId).eq('doctor_id', doctor_id)
      .gte('scheduled_at', `${date}T00:00:00`).lte('scheduled_at', `${date}T23:59:59`)
      .not('status', 'in', '("cancelled","no_show")')

    const slots = []
    const end = new Date(`${date}T14:00:00`)
    for (let t = new Date(`${date}T09:00:00`); t < end; t = new Date(t.getTime() + duration * 60000)) {
      const slotEnd = new Date(t.getTime() + duration * 60000)
      const isBooked = (booked || []).some(b => {
        const bStart = new Date(b.scheduled_at)
        const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000)
        return t < bEnd && slotEnd > bStart
      })
      if (!isBooked && slotEnd <= end) slots.push({ time: t.toISOString(), duration_minutes: duration, available: true })
    }
    return res.json(slots)
  }

  // POST /api/appointments/bolna-webhook (disabled)
  if (id === 'bolna-webhook') {
    return res.json({ ok: true, message: 'Bolna webhook disabled' })
  }

  // PATCH /api/appointments/:id?action=status
  if (action === 'status') {
    if (req.method !== 'PATCH') return res.status(405).end()
    const { status, notes } = req.body
    if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    const update = { status }
    if (notes) update.notes = notes
    await supabase.from('appointments').update(update).eq('id', id)
    const { data } = await supabase.from('appointments')
      .select('*, doctors(name), visit_types(name)').eq('id', id).single()
    return res.json({ ...data, doctor_name: data?.doctors?.name, visit_type_name: data?.visit_types?.name })
  }

  // PATCH /api/appointments/:id?action=reschedule
  if (action === 'reschedule') {
    if (req.method !== 'PATCH') return res.status(405).end()
    const { scheduled_at } = req.body
    if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at required' })
    await supabase.from('appointments').update({
      scheduled_at, status: 'scheduled',
      reminder_24h_sent: false, reminder_2h_sent: false, reminder_30m_sent: false,
    }).eq('id', id)
    const { data } = await supabase.from('appointments').select('*').eq('id', id).single()
    return res.json(data)
  }

  res.status(404).end()
}
