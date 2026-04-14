import supabase from '../_lib/supabase.js'
import { makeReminderCall } from '../_lib/bolnaService.js'

export default async function handler(req, res) {
  // Vercel calls this via cron — also allow manual GET for testing
  if (req.method !== 'GET') return res.status(405).end()

  const now = new Date()

  const check = async (hours, field) => {
    const target = new Date(now.getTime() + hours * 60 * 60 * 1000)
    const windowStart = new Date(target.getTime() - 30000).toISOString()
    const windowEnd = new Date(target.getTime() + 30000).toISOString()

    const { data: appts } = await supabase
      .from('appointments')
      .select('*, practices(name), doctors(name)')
      .in('status', ['scheduled', 'confirmed'])
      .eq(field, false)
      .gte('scheduled_at', windowStart)
      .lte('scheduled_at', windowEnd)

    for (const appt of (appts || [])) {
      // Mark reminder sent
      await supabase.from('appointments').update({ [field]: true }).eq('id', appt.id)

      const enriched = {
        ...appt,
        practice_name: appt.practices?.name,
        doctor_name: appt.doctors?.name,
      }

      // 2h reminder → Bolna voice call
      if (field === 'reminder_2h_sent') {
        await makeReminderCall(enriched)
      }

      // Notify practice dashboard via Supabase Realtime (insert to notifications table)
      await supabase.from('notifications').insert({
        practice_id: appt.practice_id,
        type: field,
        data: {
          appointment_id: appt.id,
          patient_name: appt.patient_name,
          scheduled_at: appt.scheduled_at,
          voice_call: field === 'reminder_2h_sent',
        },
      })

      console.log(`[REMINDER] ${appt.patient_name} — ${field} for ${appt.scheduled_at}`)
    }

    return appts?.length || 0
  }

  const [r24, r2, r30] = await Promise.all([
    check(24, 'reminder_24h_sent'),
    check(2, 'reminder_2h_sent'),
    check(0.5, 'reminder_30m_sent'),
  ])

  res.json({ ok: true, processed: { '24h': r24, '2h': r2, '30m': r30 } })
}
