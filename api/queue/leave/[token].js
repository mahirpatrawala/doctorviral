import supabase from '../../_lib/supabase.js'
import { handleCors } from '../../_lib/cors.js'
import { recalculateQueue } from '../../_lib/aiScheduler.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'DELETE') return res.status(405).end()

  const { token } = req.query
  const { data: entry } = await supabase
    .from('queue_entries').select('*').eq('token', token)
    .in('status', ['waiting', 'called']).single()

  if (!entry) return res.status(404).json({ error: 'Not found or already processed' })

  await supabase.from('queue_entries')
    .update({ status: 'left', completed_at: new Date().toISOString() })
    .eq('id', entry.id)

  await recalculateQueue(entry.practice_id)
  res.json({ message: 'Left queue' })
}
