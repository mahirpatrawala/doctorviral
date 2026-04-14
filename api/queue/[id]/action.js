import supabase from '../../_lib/supabase.js'
import { handleCors } from '../../_lib/cors.js'
import { recalculateQueue } from '../../_lib/aiScheduler.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'PATCH') return res.status(405).end()

  const { id } = req.query
  const { action, notes } = req.body

  const { data: entry } = await supabase.from('queue_entries').select('*').eq('id', id).single()
  if (!entry) return res.status(404).json({ error: 'Not found' })

  const now = new Date().toISOString()
  let update = {}

  if (action === 'call') update = { status: 'called', called_at: now }
  else if (action === 'start') update = { status: 'in_progress', started_at: now }
  else if (action === 'complete') {
    update = { status: 'done', completed_at: now }
    if (entry.started_at) {
      const mins = Math.round((new Date(now) - new Date(entry.started_at)) / 60000)
      if (mins > 0 && mins < 180) {
        await supabase.from('visit_history').insert({
          practice_id: entry.practice_id,
          doctor_id: entry.doctor_id,
          visit_type_id: entry.visit_type_id,
          actual_duration_minutes: mins,
        })
      }
    }
  } else if (action === 'skip' || action === 'left') {
    update = { status: 'left', completed_at: now }
  } else {
    return res.status(400).json({ error: 'Invalid action' })
  }

  if (notes) update.notes = notes

  await supabase.from('queue_entries').update(update).eq('id', id)
  await recalculateQueue(entry.practice_id)

  const { data: updated } = await supabase.from('queue_entries').select('*').eq('id', id).single()
  res.json(updated)
}
