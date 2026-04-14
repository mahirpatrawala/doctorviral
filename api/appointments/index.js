import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'
import { estimateDuration } from '../_lib/aiScheduler.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  // GET /api/appointments?practiceId=1&date=2026-04-15
  if (req.method === 'GET') {
    const { practiceId, date } = req.query
    let query = supabase
      .from('appointments')
      .select('*, doctors(name), visit_types(name)')
      .eq('practice_id', practiceId)
      .order('scheduled_at', { ascending: true })

    if (date) {
      query = query.gte('scheduled_at', `${date}T00:00:00`).lte('scheduled_at', `${date}T23:59:59`)
    } else {
      query = query.gte('scheduled_at', new Date().toISOString().split('T')[0] + 'T00:00:00')
    }

    const { data } = await query
    return res.json((data || []).map(a => ({
      ...a,
      doctor_name: a.doctors?.name || null,
      visit_type_name: a.visit_types?.name || null,
    })))
  }

  // POST /api/appointments — book appointment
  if (req.method === 'POST') {
    const { practice_id, patient_name, patient_phone, doctor_id, visit_type_id, scheduled_at } = req.body
    if (!practice_id || !patient_name || !scheduled_at)
      return res.status(400).json({ error: 'practice_id, patient_name, scheduled_at required' })

    const duration = await estimateDuration(doctor_id, visit_type_id, practice_id)

    const { data, error } = await supabase.from('appointments').insert({
      practice_id: Number(practice_id),
      patient_name,
      patient_phone: patient_phone || null,
      doctor_id: doctor_id ? Number(doctor_id) : null,
      visit_type_id: visit_type_id ? Number(visit_type_id) : null,
      scheduled_at,
      duration_minutes: duration,
    }).select().single()

    if (error) return res.status(400).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.status(405).end()
}
