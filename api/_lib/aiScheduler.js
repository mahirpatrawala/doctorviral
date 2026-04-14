import supabase from './supabase.js'

export async function estimateDuration(doctorId, visitTypeId, practiceId) {
  const { data } = await supabase
    .from('visit_history')
    .select('actual_duration_minutes')
    .eq('practice_id', practiceId || 0)
    .eq('doctor_id', doctorId || 0)
    .eq('visit_type_id', visitTypeId || 0)

  if (data && data.length >= 3) {
    const avg = data.reduce((s, r) => s + r.actual_duration_minutes, 0) / data.length
    return Math.ceil(avg)
  }

  if (visitTypeId) {
    const { data: vt } = await supabase
      .from('visit_types')
      .select('base_duration_minutes')
      .eq('id', visitTypeId)
      .single()
    if (vt) return vt.base_duration_minutes
  }

  return 15
}

export async function calculateWaitTime(practiceId, doctorId) {
  let query = supabase
    .from('queue_entries')
    .select('*, visit_types(base_duration_minutes)')
    .eq('practice_id', practiceId)
    .in('status', ['waiting', 'called', 'in_progress'])
    .order('position', { ascending: true })

  if (doctorId) query = query.eq('doctor_id', doctorId)

  const { data: entries } = await query

  let total = 0
  for (const entry of (entries || [])) {
    const base = entry.visit_types?.base_duration_minutes || 15
    if (entry.status === 'in_progress') {
      total += Math.ceil((entry.estimated_wait_minutes || base) / 2)
    } else {
      total += entry.estimated_wait_minutes || base
    }
  }
  return total
}

export async function recalculateQueue(practiceId) {
  const { data: entries } = await supabase
    .from('queue_entries')
    .select('*, visit_types(base_duration_minutes)')
    .eq('practice_id', practiceId)
    .in('status', ['waiting', 'called'])
    .order('joined_at', { ascending: true })

  const { data: inProgress } = await supabase
    .from('queue_entries')
    .select('estimated_wait_minutes')
    .eq('practice_id', practiceId)
    .eq('status', 'in_progress')
    .limit(1)
    .single()

  let cumulative = inProgress
    ? Math.ceil((inProgress.estimated_wait_minutes || 15) / 2)
    : 0

  for (let i = 0; i < (entries || []).length; i++) {
    const entry = entries[i]
    const duration = await estimateDuration(entry.doctor_id, entry.visit_type_id, practiceId)
    await supabase
      .from('queue_entries')
      .update({ position: i + 1, estimated_wait_minutes: cumulative })
      .eq('id', entry.id)
    cumulative += duration
  }
}
