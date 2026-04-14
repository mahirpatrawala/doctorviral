import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method === 'POST') {
    const { practice_id, patient_name, rating, wait_time_rating, doctor_rating, comment, source } = req.body
    if (!practice_id || !rating) return res.status(400).json({ error: 'practice_id and rating required' })

    const is_public = rating >= 4

    const { data } = await supabase.from('feedback').insert({
      practice_id: Number(practice_id),
      patient_name: patient_name || 'Anonymous',
      rating, wait_time_rating: wait_time_rating || null,
      doctor_rating: doctor_rating || null,
      comment: comment || null, is_public, source: source || 'app',
    }).select().single()

    return res.status(201).json({
      id: data.id, is_public,
      message: is_public ? 'Thank you! Your review is published.' : 'Thank you for your feedback. Our team will review it.',
    })
  }

  res.status(405).end()
}
