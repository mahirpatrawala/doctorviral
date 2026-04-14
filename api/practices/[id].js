import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'
import QRCode from 'qrcode'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  const { id, action } = req.query

  // POST /api/practices/login
  if (id === 'login') {
    if (req.method !== 'POST') return res.status(405).end()
    const { pin_code } = req.body
    if (!pin_code) return res.status(400).json({ error: 'PIN required' })
    const { data } = await supabase
      .from('practices').select('id, name, address, phone, created_at')
      .eq('pin_code', pin_code).single()
    if (!data) return res.status(401).json({ error: 'Invalid PIN' })
    return res.json({ practice: data })
  }

  // GET /api/practices/:id?action=qr
  if (action === 'qr') {
    if (req.method !== 'GET') return res.status(405).end()
    const { data: practice } = await supabase
      .from('practices').select('id, name, address, phone').eq('id', id).single()
    if (!practice) return res.status(404).json({ error: 'Not found' })

    const frontendUrl = process.env.FRONTEND_URL || 'https://doctorviral.vercel.app'
    const patientUrl = `${frontendUrl}/patient/${practice.id}`
    const qrDataUrl = await QRCode.toDataURL(patientUrl, {
      width: 400, margin: 2,
      color: { dark: '#1e3a5f', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })
    const bucket = supabase.storage.from('qr-codes')
    const { data: pngData } = bucket.getPublicUrl(`qr-${id}.png`)
    const { data: signData } = bucket.getPublicUrl(`queue-sign-${id}.html`)
    return res.json({ qrDataUrl, patientUrl, pngUrl: pngData.publicUrl, signUrl: signData.publicUrl })
  }

  // GET /api/practices/:id
  if (req.method !== 'GET') return res.status(405).end()

  const { data: practice } = await supabase
    .from('practices').select('id, name, address, phone').eq('id', id).single()
  if (!practice) return res.status(404).json({ error: 'Not found' })

  const { data: doctors } = await supabase
    .from('doctors').select('id, name, specialty').eq('practice_id', id).eq('is_active', true)
  const { data: visitTypes } = await supabase
    .from('visit_types').select('*').eq('practice_id', id)

  res.json({ ...practice, doctors: doctors || [], visitTypes: visitTypes || [] })
}
