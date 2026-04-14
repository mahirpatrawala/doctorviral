import supabase from '../../_lib/supabase.js'
import { handleCors } from '../../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const { practiceId } = req.query

  const { data: feedback } = await supabase
    .from('feedback')
    .select('id, patient_name, rating, wait_time_rating, doctor_rating, comment, created_at')
    .eq('practice_id', practiceId).eq('is_public', true)
    .order('created_at', { ascending: false }).limit(20)

  const { data: all } = await supabase
    .from('feedback').select('rating, wait_time_rating, doctor_rating')
    .eq('practice_id', practiceId).eq('is_public', true)

  const stats = {
    avg_rating: avg(all, 'rating'),
    avg_wait_rating: avg(all, 'wait_time_rating'),
    avg_doctor_rating: avg(all, 'doctor_rating'),
    total_reviews: all?.length || 0,
  }

  res.json({ feedback: feedback || [], stats })
}

function avg(rows, field) {
  if (!rows?.length) return null
  const valid = rows.filter(r => r[field] != null)
  if (!valid.length) return null
  return valid.reduce((s, r) => s + r[field], 0) / valid.length
}
