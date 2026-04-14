// Bolna voice call webhook — temporarily disabled
// To re-enable: uncomment the handler logic below and configure Bolna webhook URL

import { handleCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  res.json({ ok: true, message: 'Bolna webhook disabled' })
}
