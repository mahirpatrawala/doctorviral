import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const { id } = req.query

  const { data: practice } = await supabase
    .from('practices').select('id, name, address, phone').eq('id', id).single()
  if (!practice) return res.status(404).json({ error: 'Not found' })

  const { data: doctors } = await supabase
    .from('doctors').select('id, name, specialty').eq('practice_id', id).eq('is_active', true)

  const { data: visitTypes } = await supabase
    .from('visit_types').select('*').eq('practice_id', id)

  res.json({ ...practice, doctors: doctors || [], visitTypes: visitTypes || [] })
}
