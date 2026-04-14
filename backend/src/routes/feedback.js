const express = require('express');
const router = express.Router();
const db = require('../database');

// Submit feedback (patient)
router.post('/', (req, res) => {
  const { practice_id, patient_name, rating, wait_time_rating, doctor_rating, comment, source } = req.body;
  if (!practice_id || !rating) return res.status(400).json({ error: 'practice_id and rating required' });

  // If rating >= 4, make public; else keep private for practice to handle
  const is_public = rating >= 4 ? 1 : 0;

  const result = db.prepare(`
    INSERT INTO feedback (practice_id, patient_name, rating, wait_time_rating, doctor_rating, comment, is_public, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(practice_id, patient_name || 'Anonymous', rating, wait_time_rating || null, doctor_rating || null, comment || null, is_public, source || 'app');

  res.status(201).json({
    id: result.lastInsertRowid,
    is_public,
    message: is_public ? 'Thank you! Your review is published.' : 'Thank you for your feedback. Our team will review it.',
  });
});

// Get public feedback for a practice (patient view)
router.get('/:practiceId/public', (req, res) => {
  const feedback = db.prepare(`
    SELECT id, patient_name, rating, wait_time_rating, doctor_rating, comment, created_at
    FROM feedback WHERE practice_id = ? AND is_public = 1
    ORDER BY created_at DESC LIMIT 20
  `).all(req.params.practiceId);

  const stats = db.prepare(`
    SELECT AVG(rating) as avg_rating, AVG(wait_time_rating) as avg_wait_rating,
           AVG(doctor_rating) as avg_doctor_rating, COUNT(*) as total_reviews
    FROM feedback WHERE practice_id = ? AND is_public = 1
  `).get(req.params.practiceId);

  res.json({ feedback, stats });
});

// Get all feedback for a practice (practice dashboard)
router.get('/:practiceId', (req, res) => {
  const feedback = db.prepare(`
    SELECT * FROM feedback WHERE practice_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(req.params.practiceId);

  const stats = db.prepare(`
    SELECT AVG(rating) as avg_rating, AVG(wait_time_rating) as avg_wait_rating,
           AVG(doctor_rating) as avg_doctor_rating, COUNT(*) as total,
           SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_count,
           SUM(CASE WHEN rating < 4 THEN 1 ELSE 0 END) as negative_count
    FROM feedback WHERE practice_id = ?
  `).get(req.params.practiceId);

  res.json({ feedback, stats });
});

// Mark negative feedback as resolved (practice)
router.patch('/:id/resolve', (req, res) => {
  // Could add a 'resolved' column; for now just mark public
  db.prepare('UPDATE feedback SET is_public = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Resolved' });
});

module.exports = router;
