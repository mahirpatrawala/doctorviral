const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { calculateWaitTime, recalculateQueue, estimateDuration } = require('../services/aiScheduler');

// Get current queue for a practice (practice dashboard)
router.get('/:practiceId', (req, res) => {
  const { practiceId } = req.params;
  const entries = db.prepare(`
    SELECT qe.*, d.name as doctor_name, vt.name as visit_type_name
    FROM queue_entries qe
    LEFT JOIN doctors d ON qe.doctor_id = d.id
    LEFT JOIN visit_types vt ON qe.visit_type_id = vt.id
    WHERE qe.practice_id = ? AND qe.status NOT IN ('done', 'left')
    ORDER BY qe.position ASC, qe.joined_at ASC
  `).all(practiceId);
  res.json(entries);
});

// Get queue status by token (patient polling)
router.get('/status/:token', (req, res) => {
  const entry = db.prepare(`
    SELECT qe.*, d.name as doctor_name, vt.name as visit_type_name, p.name as practice_name
    FROM queue_entries qe
    LEFT JOIN doctors d ON qe.doctor_id = d.id
    LEFT JOIN visit_types vt ON qe.visit_type_id = vt.id
    LEFT JOIN practices p ON qe.practice_id = p.id
    WHERE qe.token = ?
  `).get(req.params.token);

  if (!entry) return res.status(404).json({ error: 'Token not found' });

  // Count people ahead
  let ahead = 0;
  if (entry.status === 'waiting') {
    ahead = db.prepare(`
      SELECT COUNT(*) as cnt FROM queue_entries
      WHERE practice_id = ? AND status IN ('waiting', 'called', 'in_progress')
      AND position < ?
    `).get(entry.practice_id, entry.position)?.cnt || 0;
  }

  res.json({ ...entry, people_ahead: ahead });
});

// Join queue (patient)
router.post('/join', (req, res) => {
  const { practice_id, patient_name, patient_phone, doctor_id, visit_type_id } = req.body;
  if (!practice_id || !patient_name) return res.status(400).json({ error: 'practice_id and patient_name required' });

  const io = req.app.get('io');
  const token = uuidv4();
  const docId = doctor_id ? Number(doctor_id) : null;
  const typeId = visit_type_id ? Number(visit_type_id) : null;
  const pid = Number(practice_id);

  // Calculate next position
  const maxPos = db.prepare(`
    SELECT COALESCE(MAX(position), 0) as max_pos FROM queue_entries
    WHERE practice_id = ? AND status IN ('waiting', 'called', 'in_progress')
  `).get(pid);

  const position = maxPos.max_pos + 1;
  const estimatedWait = calculateWaitTime(pid, docId);
  const duration = estimateDuration(docId, typeId, pid);

  db.prepare(`
    INSERT INTO queue_entries (practice_id, patient_name, patient_phone, doctor_id, visit_type_id, status, position, token, estimated_wait_minutes)
    VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, ?)
  `).run(pid, patient_name, patient_phone || null, docId, typeId, position, token, estimatedWait + duration);

  recalculateQueue(practice_id, io);

  res.status(201).json({ token, position, estimated_wait_minutes: estimatedWait + duration });
});

// Practice actions: call next, start, complete, skip
router.patch('/:id/action', (req, res) => {
  const { action, notes } = req.body;
  const io = req.app.get('io');

  const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  let update = {};

  if (action === 'call') {
    update = { status: 'called', called_at: now };
  } else if (action === 'start') {
    update = { status: 'in_progress', started_at: now };
  } else if (action === 'complete') {
    update = { status: 'done', completed_at: now };

    // Record actual duration to history
    if (entry.started_at) {
      const durationMinutes = Math.round((new Date(now) - new Date(entry.started_at)) / 60000);
      if (durationMinutes > 0 && durationMinutes < 180) {
        db.prepare(`
          INSERT INTO visit_history (practice_id, doctor_id, visit_type_id, actual_duration_minutes)
          VALUES (?, ?, ?, ?)
        `).run(entry.practice_id, entry.doctor_id, entry.visit_type_id, durationMinutes);
      }
    }
  } else if (action === 'skip' || action === 'left') {
    update = { status: 'left', completed_at: now };
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }

  if (notes) update.notes = notes;

  const fields = Object.keys(update).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(update), req.params.id];
  db.prepare(`UPDATE queue_entries SET ${fields} WHERE id = ?`).run(...values);

  recalculateQueue(entry.practice_id, io);

  // Notify the patient via socket
  const updated = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(req.params.id);
  io.to(`patient_${entry.token}`).emit('status_update', updated);

  res.json(updated);
});

// Leave queue (patient)
router.delete('/leave/:token', (req, res) => {
  const io = req.app.get('io');
  const entry = db.prepare("SELECT * FROM queue_entries WHERE token = ? AND status IN ('waiting', 'called')").get(req.params.token);
  if (!entry) return res.status(404).json({ error: 'Not found or already processed' });

  db.prepare("UPDATE queue_entries SET status = 'left', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(entry.id);
  recalculateQueue(entry.practice_id, io);

  res.json({ message: 'Left queue' });
});

module.exports = router;
