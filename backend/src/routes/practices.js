const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateForPractice } = require('../services/qrService');
const QRCode = require('qrcode');

// Login / authenticate a practice by PIN
router.post('/login', (req, res) => {
  const { pin_code } = req.body;
  if (!pin_code) return res.status(400).json({ error: 'PIN required' });

  const practice = db.prepare('SELECT * FROM practices WHERE pin_code = ?').get(pin_code);
  if (!practice) return res.status(401).json({ error: 'Invalid PIN' });

  res.json({ practice });
});

// Get QR data for a practice (dashboard)
router.get('/:id/qr', async (req, res) => {
  const practice = db.prepare('SELECT id, name, address, phone FROM practices WHERE id = ?').get(req.params.id);
  if (!practice) return res.status(404).json({ error: 'Not found' });

  const patientUrl = `http://localhost:5173/patient/${practice.id}`;
  const qrDataUrl = await QRCode.toDataURL(patientUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#1e3a5f', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

  res.json({
    qrDataUrl,
    patientUrl,
    pngUrl: `/qr-files/qr-${practice.id}.png`,
    signUrl: `/qr-files/queue-sign-${practice.id}.html`,
  });
});

// Get practice info (public — for patients)
router.get('/:id', (req, res) => {
  const practice = db.prepare('SELECT id, name, address, phone FROM practices WHERE id = ?').get(req.params.id);
  if (!practice) return res.status(404).json({ error: 'Not found' });

  const doctors = db.prepare('SELECT id, name, specialty FROM doctors WHERE practice_id = ? AND is_active = 1').all(practice.id);
  const visitTypes = db.prepare('SELECT * FROM visit_types WHERE practice_id = ?').all(practice.id);

  res.json({ ...practice, doctors, visitTypes });
});

// Get all practices (for patient landing page)
router.get('/', (req, res) => {
  const practices = db.prepare('SELECT id, name, address, phone FROM practices').all();
  res.json(practices);
});

// Create a practice (admin/setup)
router.post('/', (req, res) => {
  const { name, address, phone, pin_code, doctors = [], visitTypes = [] } = req.body;
  if (!name || !pin_code) return res.status(400).json({ error: 'name and pin_code required' });

  const result = db.prepare(
    'INSERT INTO practices (name, address, phone, pin_code) VALUES (?, ?, ?, ?)'
  ).run(name, address, phone, pin_code);

  const practiceId = result.lastInsertRowid;

  const insertDoctor = db.prepare('INSERT INTO doctors (practice_id, name, specialty) VALUES (?, ?, ?)');
  doctors.forEach(d => insertDoctor.run(practiceId, d.name, d.specialty || null));

  const defaultTypes = visitTypes.length ? visitTypes : [
    { name: 'General Checkup', base_duration_minutes: 15 },
    { name: 'Follow-up', base_duration_minutes: 10 },
    { name: 'Acute / Urgent', base_duration_minutes: 20 },
    { name: 'Procedure', base_duration_minutes: 30 },
    { name: 'Consultation', base_duration_minutes: 25 },
  ];

  const insertType = db.prepare('INSERT INTO visit_types (practice_id, name, base_duration_minutes) VALUES (?, ?, ?)');
  defaultTypes.forEach(t => insertType.run(practiceId, t.name, t.base_duration_minutes));

  // Auto-generate QR code files
  generateForPractice({ id: practiceId, name, address, phone }).catch(err =>
    console.error('[QR] Generation failed:', err.message)
  );

  res.status(201).json({ id: practiceId, name });
});

module.exports = router;
