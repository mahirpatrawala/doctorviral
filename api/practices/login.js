import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()

  const { pin_code } = req.body
  if (!pin_code) return res.status(400).json({ error: 'PIN required' })

  const { data } = await supabase
    .from('practices')
    .select('id, name, address, phone, created_at')
    .eq('pin_code', pin_code)
    .single()

  if (!data) return res.status(401).json({ error: 'Invalid PIN' })

  res.json({ practice: data })
}
