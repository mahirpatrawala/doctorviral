import supabase from '../../_lib/supabase.js'
import { handleCors } from '../../_lib/cors.js'

const VALID = ['scheduled', 'confirmed', 'arrived', 'in_progress', 'done', 'no_show', 'cancelled']

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'PATCH') return res.status(405).end()

  const { id } = req.query
  const { status, notes } = req.body
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status' })

  const update = { status }
  if (notes) update.notes = notes

  await supabase.from('appointments').update(update).eq('id', id)

  const { data } = await supabase
    .from('appointments')
    .select('*, doctors(name), visit_types(name)')
    .eq('id', id).single()

  res.json({ ...data, doctor_name: data?.doctors?.name, visit_type_name: data?.visit_types?.name })
}
