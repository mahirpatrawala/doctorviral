const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/:practiceId', (req, res) => {
  const { practiceId } = req.params;
  const { days = 30 } = req.query;

  // Queue stats
  const queueStats = db.prepare(`
    SELECT
      COUNT(*) as total_patients,
      AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
        THEN (strftime('%s', completed_at) - strftime('%s', started_at)) / 60.0 END) as avg_consult_minutes,
      AVG(CASE WHEN started_at IS NOT NULL AND joined_at IS NOT NULL
        THEN (strftime('%s', started_at) - strftime('%s', joined_at)) / 60.0 END) as avg_actual_wait_minutes,
      SUM(CASE WHEN status = 'left' THEN 1 ELSE 0 END) as walkouts,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
    FROM queue_entries
    WHERE practice_id = ? AND joined_at >= datetime('now', ?)
  `).get(practiceId, `-${days} days`);

  // Appointment stats
  const apptStats = db.prepare(`
    SELECT
      COUNT(*) as total_appointments,
      SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_shows,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancellations,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
      ROUND(100.0 * SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as no_show_rate
    FROM appointments
    WHERE practice_id = ? AND created_at >= datetime('now', ?)
  `).get(practiceId, `-${days} days`);

  // Busy hours (queue joins by hour)
  const busyHours = db.prepare(`
    SELECT strftime('%H', joined_at) as hour, COUNT(*) as count
    FROM queue_entries
    WHERE practice_id = ? AND joined_at >= datetime('now', ?)
    GROUP BY hour ORDER BY hour
  `).all(practiceId, `-${days} days`);

  // Daily patient volume (last 14 days)
  const dailyVolume = db.prepare(`
    SELECT DATE(joined_at) as date, COUNT(*) as queue_count
    FROM queue_entries
    WHERE practice_id = ? AND joined_at >= datetime('now', '-14 days')
    GROUP BY date ORDER BY date
  `).all(practiceId);

  const dailyAppts = db.prepare(`
    SELECT DATE(scheduled_at) as date, COUNT(*) as appt_count
    FROM appointments
    WHERE practice_id = ? AND scheduled_at >= datetime('now', '-14 days')
    AND status NOT IN ('cancelled')
    GROUP BY date ORDER BY date
  `).all(practiceId);

  // Avg duration by visit type
  const durationByType = db.prepare(`
    SELECT vt.name as visit_type, AVG(vh.actual_duration_minutes) as avg_duration, COUNT(*) as sample_count
    FROM visit_history vh
    JOIN visit_types vt ON vh.visit_type_id = vt.id
    WHERE vh.practice_id = ?
    GROUP BY vh.visit_type_id
    ORDER BY avg_duration DESC
  `).all(practiceId);

  // Feedback summary
  const feedbackSummary = db.prepare(`
    SELECT AVG(rating) as avg_rating, AVG(wait_time_rating) as avg_wait_rating,
           AVG(doctor_rating) as avg_doctor_rating, COUNT(*) as total_reviews,
           SUM(CASE WHEN rating < 4 THEN 1 ELSE 0 END) as negative_count
    FROM feedback WHERE practice_id = ?
  `).get(practiceId);

  res.json({
    queue: queueStats,
    appointments: apptStats,
    busyHours,
    dailyVolume,
    dailyAppts,
    durationByType,
    feedback: feedbackSummary,
  });
});

module.exports = router;
