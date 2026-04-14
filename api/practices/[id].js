import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  const { id, action } = req.query

  try {
    // POST /api/practices/login
    if (id === 'login') {
      if (req.method !== 'POST') return res.status(405).end()
      const { pin_code } = req.body || {}
      if (!pin_code) return res.status(400).json({ error: 'PIN required' })
      const { data, error } = await supabase
        .from('practices').select('id, name, address, phone, created_at')
        .eq('pin_code', pin_code).single()
      if (error || !data) return res.status(401).json({ error: 'Invalid PIN' })
      return res.json({ practice: data })
    }

    // GET /api/practices/:id?action=qr
    if (action === 'qr') {
      if (req.method !== 'GET') return res.status(405).end()
      const { data: practice } = await supabase
        .from('practices').select('id, name').eq('id', id).single()
      if (!practice) return res.status(404).json({ error: 'Not found' })
      const frontendUrl = process.env.FRONTEND_URL || 'https://doctorviralfinal.vercel.app'
      const patientUrl = `${frontendUrl}/patient/${id}`
      // Return data URL generated client-side instead (avoid qrcode dep in serverless)
      return res.json({ patientUrl, qrDataUrl: null, pngUrl: null, signUrl: null })
    }

    // GET /api/practices/:id
    if (req.method !== 'GET') return res.status(405).end()

    const { data: practice, error: pe } = await supabase
      .from('practices').select('id, name, address, phone').eq('id', id).single()
    if (pe || !practice) return res.status(404).json({ error: 'Not found' })

    const [{ data: doctors }, { data: visitTypes }] = await Promise.all([
      supabase.from('doctors').select('id, name, specialty').eq('practice_id', id).eq('is_active', true),
      supabase.from('visit_types').select('*').eq('practice_id', id),
    ])

    return res.json({ ...practice, doctors: doctors || [], visitTypes: visitTypes || [] })

  } catch (err) {
    console.error('[practices/[id]]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
