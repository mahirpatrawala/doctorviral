// Reminders & Bolna voice calls — temporarily disabled
// To re-enable: uncomment everything below and set up a cron at cron-job.org
// hitting GET /api/cron/reminders every minute

export default async function handler(req, res) {
  res.json({ ok: true, message: 'Reminders disabled' })
}
