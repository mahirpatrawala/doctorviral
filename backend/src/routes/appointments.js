const express = require('express');
const router = express.Router();
const db = require('../database');
const { estimateDuration } = require('../services/aiScheduler');

// Get appointments for a practice (optionally filter by date)
router.get('/:practiceId', (req, res) => {
  const { date } = req.query;
  let query = `
    SELECT a.*, d.name as doctor_name, vt.name as visit_type_name
    FROM appointments a
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN visit_types vt ON a.visit_type_id = vt.id
    WHERE a.practice_id = ?
  `;
  const params = [req.params.practiceId];

  if (date) {
    query += ` AND DATE(a.scheduled_at) = ?`;
    params.push(date);
  } else {
    query += ` AND DATE(a.scheduled_at) >= DATE('now')`;
  }

  query += ` ORDER BY a.scheduled_at ASC`;
  res.json(db.prepare(query).all(...params));
});

// Get available slots for a doctor on a date
router.get('/:practiceId/slots', (req, res) => {
  const { doctor_id, date, visit_type_id } = req.query;
  if (!doctor_id || !date) return res.status(400).json({ error: 'doctor_id and date required' });

  const duration = estimateDuration(doctor_id, visit_type_id, req.params.practiceId);

  // Existing appointments for that doctor on that date
  const booked = db.prepare(`
    SELECT scheduled_at, duration_minutes FROM appointments
    WHERE practice_id = ? AND doctor_id = ? AND DATE(scheduled_at) = ?
    AND status NOT IN ('cancelled', 'no_show')
    ORDER BY scheduled_at ASC
  `).all(req.params.practiceId, doctor_id, date);

  // Generate slots 9am-5pm in duration increments
  const slots = [];
  const start = new Date(`${date}T09:00:00`);
  const end = new Date(`${date}T17:00:00`);

  for (let t = new Date(start); t < end; t = new Date(t.getTime() + duration * 60000)) {
    const slotEnd = new Date(t.getTime() + duration * 60000);
    const isBooked = booked.some(b => {
      const bStart = new Date(b.scheduled_at);
      const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000);
      return t < bEnd && slotEnd > bStart;
    });

    if (!isBooked && slotEnd <= end) {
      slots.push({
        time: t.toISOString(),
        duration_minutes: duration,
        available: true,
      });
    }
  }

  res.json(slots);
});

// Book appointment (patient)
router.post('/', (req, res) => {
  const { practice_id, patient_name, patient_phone, doctor_id, visit_type_id, scheduled_at } = req.body;
  if (!practice_id || !patient_name || !scheduled_at) {
    return res.status(400).json({ error: 'practice_id, patient_name, scheduled_at required' });
  }

  const duration = estimateDuration(doctor_id, visit_type_id, practice_id);

  const result = db.prepare(`
    INSERT INTO appointments (practice_id, patient_name, patient_phone, doctor_id, visit_type_id, scheduled_at, duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(practice_id, patient_name, patient_phone || null, doctor_id || null, visit_type_id || null, scheduled_at, duration);

  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(appt);
});

// Update appointment status (practice)
router.patch('/:id/status', (req, res) => {
  const { status, notes } = req.body;
  const valid = ['scheduled', 'confirmed', 'arrived', 'in_progress', 'done', 'no_show', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const io = req.app.get('io');
  db.prepare('UPDATE appointments SET status = ?, notes = COALESCE(?, notes) WHERE id = ?').run(status, notes || null, req.params.id);
  const appt = db.prepare(`
    SELECT a.*, d.name as doctor_name, vt.name as visit_type_name
    FROM appointments a
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN visit_types vt ON a.visit_type_id = vt.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (appt) io.to(`practice_${appt.practice_id}`).emit('appointment_updated', appt);
  res.json(appt);
});

// Reschedule appointment (patient-friendly)
router.patch('/:id/reschedule', (req, res) => {
  const { scheduled_at } = req.body;
  if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at required' });

  db.prepare(`
    UPDATE appointments SET scheduled_at = ?, status = 'scheduled',
    reminder_24h_sent = 0, reminder_2h_sent = 0, reminder_30m_sent = 0
    WHERE id = ?
  `).run(scheduled_at, req.params.id);

  res.json(db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id));
});

// Cancel appointment
router.delete('/:id', (req, res) => {
  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Cancelled' });
});

// Bolna webhook — called by Bolna after patient responds to reminder call
router.post('/bolna-webhook', (req, res) => {
  const io = req.app.get('io');
  const { digit_pressed, user_data } = req.body;
  const appointmentId = user_data?.appointment_id;

  if (!appointmentId) return res.status(400).json({ error: 'appointment_id missing in user_data' });

  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  let newStatus = null;
  let socketEvent = null;

  if (digit_pressed === '1') {
    newStatus = 'confirmed';
  } else if (digit_pressed === '2') {
    // Can't auto-reschedule without a new time — notify staff via socket
    socketEvent = 'reschedule_requested';
  } else if (digit_pressed === '3') {
    newStatus = 'cancelled';
  }

  if (newStatus) {
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(newStatus, appointmentId);
  }

  const updated = db.prepare(`
    SELECT a.*, d.name as doctor_name, vt.name as visit_type_name
    FROM appointments a
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN visit_types vt ON a.visit_type_id = vt.id
    WHERE a.id = ?
  `).get(appointmentId);

  io.to(`practice_${appt.practice_id}`).emit('appointment_updated', updated);

  if (socketEvent === 'reschedule_requested') {
    io.to(`practice_${appt.practice_id}`).emit('reschedule_requested', {
      appointment_id: appointmentId,
      patient_name: appt.patient_name,
      patient_phone: appt.patient_phone,
    });
  }

  console.log(`[BOLNA] Webhook: appt #${appointmentId}, digit=${digit_pressed}, status=${newStatus || 'reschedule requested'}`);
  res.json({ ok: true });
});

module.exports = router;
