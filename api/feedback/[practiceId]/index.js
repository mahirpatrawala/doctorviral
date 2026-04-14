import supabase from '../../_lib/supabase.js'
import { handleCors } from '../../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const { practiceId } = req.query

  const { data: feedback } = await supabase
    .from('feedback').select('*').eq('practice_id', practiceId)
    .order('created_at', { ascending: false }).limit(50)

  const { data: all } = await supabase
    .from('feedback').select('rating, wait_time_rating, doctor_rating, is_public')
    .eq('practice_id', practiceId)

  const stats = {
    avg_rating: avg(all, 'rating'),
    avg_wait_rating: avg(all, 'wait_time_rating'),
    avg_doctor_rating: avg(all, 'doctor_rating'),
    total: all?.length || 0,
    public_count: all?.filter(r => r.is_public).length || 0,
    negative_count: all?.filter(r => r.rating < 4).length || 0,
  }

  res.json({ feedback: feedback || [], stats })
}

function avg(rows, field) {
  if (!rows?.length) return null
  const valid = rows.filter(r => r[field] != null)
  if (!valid.length) return null
  return valid.reduce((s, r) => s + r[field], 0) / valid.length
}
