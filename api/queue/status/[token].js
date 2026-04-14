import supabase from '../../_lib/supabase.js'
import { handleCors } from '../../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const { token } = req.query
  const { data: entry } = await supabase
    .from('queue_entries')
    .select('*, doctors(name), visit_types(name), practices(name)')
    .eq('token', token)
    .single()

  if (!entry) return res.status(404).json({ error: 'Token not found' })

  let ahead = 0
  if (entry.status === 'waiting' && entry.position) {
    const { count } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('practice_id', entry.practice_id)
      .in('status', ['waiting', 'called', 'in_progress'])
      .lt('position', entry.position)
    ahead = count || 0
  }

  res.json({
    ...entry,
    doctor_name: entry.doctors?.name || null,
    visit_type_name: entry.visit_types?.name || null,
    practice_name: entry.practices?.name || null,
    people_ahead: ahead,
  })
}
