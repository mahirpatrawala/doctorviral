import supabase from '../../_lib/supabase.js'
import { handleCors } from '../../_lib/cors.js'
import QRCode from 'qrcode'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const { id } = req.query
  const { data: practice } = await supabase
    .from('practices').select('id, name, address, phone').eq('id', id).single()
  if (!practice) return res.status(404).json({ error: 'Not found' })

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const patientUrl = `${frontendUrl}/patient/${practice.id}`

  const qrDataUrl = await QRCode.toDataURL(patientUrl, {
    width: 400, margin: 2,
    color: { dark: '#1e3a5f', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })

  const bucket = supabase.storage.from('qr-codes')
  const { data: pngData } = bucket.getPublicUrl(`qr-${id}.png`)
  const { data: signData } = bucket.getPublicUrl(`queue-sign-${id}.html`)

  res.json({ qrDataUrl, patientUrl, pngUrl: pngData.publicUrl, signUrl: signData.publicUrl })
}
