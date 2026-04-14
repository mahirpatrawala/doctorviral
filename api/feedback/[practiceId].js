import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'

function avg(rows, field) {
  if (!rows?.length) return null
  const valid = rows.filter(r => r[field] != null)
  if (!valid.length) return null
  return valid.reduce((s, r) => s + r[field], 0) / valid.length
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const { practiceId, public: isPublic } = req.query

  if (isPublic === 'true') {
    // GET /api/feedback/:practiceId?public=true — patient-facing public reviews
    const { data: feedback } = await supabase
      .from('feedback')
      .select('id, patient_name, rating, wait_time_rating, doctor_rating, comment, created_at')
      .eq('practice_id', practiceId).eq('is_public', true)
      .order('created_at', { ascending: false }).limit(20)

    const { data: all } = await supabase
      .from('feedback').select('rating, wait_time_rating, doctor_rating')
      .eq('practice_id', practiceId).eq('is_public', true)

    return res.json({
      feedback: feedback || [],
      stats: {
        avg_rating: avg(all, 'rating'),
        avg_wait_rating: avg(all, 'wait_time_rating'),
        avg_doctor_rating: avg(all, 'doctor_rating'),
        total_reviews: all?.length || 0,
      }
    })
  }

  // GET /api/feedback/:practiceId — practice dashboard (all feedback)
  const { data: feedback } = await supabase
    .from('feedback').select('*').eq('practice_id', practiceId)
    .order('created_at', { ascending: false }).limit(50)

  const { data: all } = await supabase
    .from('feedback').select('rating, wait_time_rating, doctor_rating, is_public')
    .eq('practice_id', practiceId)

  res.json({
    feedback: feedback || [],
    stats: {
      avg_rating: avg(all, 'rating'),
      avg_wait_rating: avg(all, 'wait_time_rating'),
      avg_doctor_rating: avg(all, 'doctor_rating'),
      total: all?.length || 0,
      public_count: all?.filter(r => r.is_public).length || 0,
      negative_count: all?.filter(r => r.rating < 4).length || 0,
    }
  })
}
