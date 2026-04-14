import supabase from '../../_lib/supabase.js'
import { handleCors } from '../../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'PATCH') return res.status(405).end()

  const { id } = req.query
  const { scheduled_at } = req.body
  if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at required' })

  await supabase.from('appointments').update({
    scheduled_at, status: 'scheduled',
    reminder_24h_sent: false, reminder_2h_sent: false, reminder_30m_sent: false,
  }).eq('id', id)

  const { data } = await supabase.from('appointments').select('*').eq('id', id).single()
  res.json(data)
}
