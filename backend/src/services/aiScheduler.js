const db = require('../database');

// Estimate visit duration based on historical data for doctor + visit type
function estimateDuration(doctorId, visitTypeId, practiceId) {
  doctorId = doctorId || null;
  visitTypeId = visitTypeId || null;
  practiceId = practiceId || null;

  const history = db.prepare(`
    SELECT AVG(actual_duration_minutes) as avg_duration, COUNT(*) as sample_count
    FROM visit_history
    WHERE practice_id = ? AND doctor_id IS ? AND visit_type_id IS ?
  `).get(practiceId, doctorId, visitTypeId);

  if (history && history.sample_count >= 3) {
    return Math.ceil(history.avg_duration);
  }

  // Fall back to visit type base duration
  const visitType = db.prepare('SELECT base_duration_minutes FROM visit_types WHERE id = ?').get(visitTypeId);
  return visitType ? visitType.base_duration_minutes : 15;
}

// Calculate estimated wait time for a new patient joining the queue
function calculateWaitTime(practiceId, doctorId) {
  practiceId = practiceId || null;
  doctorId = doctorId || null;

  const activeEntries = doctorId
    ? db.prepare(`
        SELECT qe.*, vt.base_duration_minutes
        FROM queue_entries qe
        LEFT JOIN visit_types vt ON qe.visit_type_id = vt.id
        WHERE qe.practice_id = ? AND qe.status IN ('waiting', 'called', 'in_progress')
        AND qe.doctor_id = ?
        ORDER BY qe.position ASC
      `).all(practiceId, doctorId)
    : db.prepare(`
        SELECT qe.*, vt.base_duration_minutes
        FROM queue_entries qe
        LEFT JOIN visit_types vt ON qe.visit_type_id = vt.id
        WHERE qe.practice_id = ? AND qe.status IN ('waiting', 'called', 'in_progress')
        ORDER BY qe.position ASC
      `).all(practiceId);

  let totalMinutes = 0;
  for (const entry of activeEntries) {
    if (entry.status === 'in_progress') {
      // Already consuming time — assume half done
      const est = entry.estimated_wait_minutes || entry.base_duration_minutes || 15;
      totalMinutes += Math.ceil(est / 2);
    } else {
      const est = entry.estimated_wait_minutes ||
        estimateDuration(entry.doctor_id, entry.visit_type_id, practiceId);
      totalMinutes += est;
    }
  }

  return totalMinutes;
}

// Recalculate and update all queue positions + wait times
function recalculateQueue(practiceId, io) {
  const entries = db.prepare(`
    SELECT * FROM queue_entries
    WHERE practice_id = ? AND status IN ('waiting', 'called')
    ORDER BY joined_at ASC
  `).all(practiceId);

  let cumulativeWait = 0;

  // Factor in currently in-progress patient
  const inProgress = db.prepare(`
    SELECT *, estimated_wait_minutes FROM queue_entries
    WHERE practice_id = ? AND status = 'in_progress'
    LIMIT 1
  `).get(practiceId);

  if (inProgress) {
    cumulativeWait += Math.ceil((inProgress.estimated_wait_minutes || 15) / 2);
  }

  const update = db.prepare(`
    UPDATE queue_entries SET position = ?, estimated_wait_minutes = ? WHERE id = ?
  `);

  entries.forEach((entry, idx) => {
    const duration = estimateDuration(entry.doctor_id, entry.visit_type_id, practiceId);
    update.run(idx + 1, cumulativeWait, entry.id);
    cumulativeWait += duration;
  });

  if (io) {
    const updatedQueue = db.prepare(`
      SELECT qe.*, d.name as doctor_name, vt.name as visit_type_name
      FROM queue_entries qe
      LEFT JOIN doctors d ON qe.doctor_id = d.id
      LEFT JOIN visit_types vt ON qe.visit_type_id = vt.id
      WHERE qe.practice_id = ? AND qe.status NOT IN ('done', 'left')
      ORDER BY qe.position ASC, qe.joined_at ASC
    `).all(practiceId);
    io.to(`practice_${practiceId}`).emit('queue_updated', updatedQueue);
  }
}

module.exports = { estimateDuration, calculateWaitTime, recalculateQueue };
