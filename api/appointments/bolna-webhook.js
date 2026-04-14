import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()

  const { digit_pressed, user_data } = req.body
  const appointmentId = user_data?.appointment_id
  if (!appointmentId) return res.status(400).json({ error: 'appointment_id missing' })

  const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single()
  if (!appt) return res.status(404).json({ error: 'Appointment not found' })

  let newStatus = null

  if (digit_pressed === '1') newStatus = 'confirmed'
  else if (digit_pressed === '3') newStatus = 'cancelled'
  else if (digit_pressed === '2') {
    // Reschedule request — notify practice via notifications table (Supabase Realtime picks it up)
    await supabase.from('notifications').insert({
      practice_id: appt.practice_id,
      type: 'reschedule_requested',
      data: { appointment_id: appointmentId, patient_name: appt.patient_name, patient_phone: appt.patient_phone },
    })
  }

  if (newStatus) {
    await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId)
  }

  console.log(`[BOLNA] appt #${appointmentId}, digit=${digit_pressed}, status=${newStatus || 'reschedule'}`)
  res.json({ ok: true })
}
