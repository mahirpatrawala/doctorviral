import supabase from '../_lib/supabase.js'
import { handleCors } from '../_lib/cors.js'
import { calculateWaitTime, estimateDuration, recalculateQueue } from '../_lib/aiScheduler.js'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  // GET /api/queue?practiceId=1
  if (req.method === 'GET') {
    const { practiceId } = req.query
    const { data } = await supabase
      .from('queue_entries')
      .select('*, doctors(name), visit_types(name)')
      .eq('practice_id', practiceId)
      .not('status', 'in', '("done","left")')
      .order('position', { ascending: true })
      .order('joined_at', { ascending: true })

    return res.json((data || []).map(e => ({
      ...e,
      doctor_name: e.doctors?.name || null,
      visit_type_name: e.visit_types?.name || null,
    })))
  }

  // POST /api/queue — join queue
  if (req.method === 'POST') {
    const { practice_id, patient_name, patient_phone, doctor_id, visit_type_id } = req.body
    if (!practice_id || !patient_name) return res.status(400).json({ error: 'practice_id and patient_name required' })

    const docId = doctor_id ? Number(doctor_id) : null
    const typeId = visit_type_id ? Number(visit_type_id) : null
    const pid = Number(practice_id)
    const token = uuidv4()

    const { data: maxRow } = await supabase
      .from('queue_entries')
      .select('position')
      .eq('practice_id', pid)
      .in('status', ['waiting', 'called', 'in_progress'])
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const position = (maxRow?.position || 0) + 1
    const waitTime = await calculateWaitTime(pid, docId)
    const duration = await estimateDuration(docId, typeId, pid)

    const { data: entry } = await supabase.from('queue_entries').insert({
      practice_id: pid, patient_name, patient_phone: patient_phone || null,
      doctor_id: docId, visit_type_id: typeId, status: 'waiting',
      position, token, estimated_wait_minutes: waitTime + duration
    }).select().single()

    await recalculateQueue(pid)
    return res.status(201).json({ token, position, estimated_wait_minutes: entry.estimated_wait_minutes })
  }

  res.status(405).end()
}
