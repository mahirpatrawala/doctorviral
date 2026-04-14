import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'
import { generateForPractice } from '../_lib/qrService.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method === 'GET') {
    // ?debug=1 — check env vars and DB connection
    if (req.query.debug) {
      const { data, error } = await supabase.from('practices').select('id, name').limit(3)
      return res.json({
        env: {
          SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
          SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING',
        },
        data,
        error: error?.message || null,
      })
    }
    const { data } = await supabase.from('practices').select('id, name, address, phone')
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    const { name, address, phone, pin_code, doctors = [], visitTypes = [] } = req.body
    if (!name || !pin_code) return res.status(400).json({ error: 'name and pin_code required' })

    const { data: practice, error } = await supabase
      .from('practices').insert({ name, address, phone, pin_code }).select().single()
    if (error) return res.status(400).json({ error: error.message })

    const defaultDoctors = doctors.length ? doctors : []
    if (defaultDoctors.length) {
      await supabase.from('doctors').insert(defaultDoctors.map(d => ({ practice_id: practice.id, name: d.name, specialty: d.specialty || null })))
    }

    const defaultTypes = visitTypes.length ? visitTypes : [
      { name: 'General Checkup', base_duration_minutes: 15 },
      { name: 'Follow-up', base_duration_minutes: 10 },
      { name: 'Acute / Urgent', base_duration_minutes: 20 },
      { name: 'Procedure', base_duration_minutes: 30 },
      { name: 'Consultation', base_duration_minutes: 25 },
    ]
    await supabase.from('visit_types').insert(defaultTypes.map(t => ({ practice_id: practice.id, ...t })))

    // Auto-generate QR
    generateForPractice(practice).catch(e => console.error('[QR]', e.message))

    return res.status(201).json({ id: practice.id, name })
  }

  res.status(405).end()
}
