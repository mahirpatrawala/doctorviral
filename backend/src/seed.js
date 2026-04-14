const db = require('./database');

console.log('Seeding database...');

// Create a demo practice
const practice = db.prepare(
  'INSERT OR IGNORE INTO practices (name, address, phone, pin_code) VALUES (?, ?, ?, ?)'
).run('City Health Clinic', '42 Main Street, Mumbai', '+91 98765 43210', '1234');

const practiceId = practice.lastInsertRowid || db.prepare("SELECT id FROM practices WHERE pin_code = '1234'").get().id;

// Doctors
const doctors = [
  { name: 'Dr. Priya Sharma', specialty: 'General Physician' },
  { name: 'Dr. Rohan Mehta', specialty: 'Pediatrician' },
];

const insertDoctor = db.prepare('INSERT OR IGNORE INTO doctors (practice_id, name, specialty) VALUES (?, ?, ?)');
doctors.forEach(d => insertDoctor.run(practiceId, d.name, d.specialty));

// Visit types
const visitTypes = [
  { name: 'General Checkup', base_duration_minutes: 15 },
  { name: 'Follow-up', base_duration_minutes: 10 },
  { name: 'Acute / Urgent', base_duration_minutes: 20 },
  { name: 'Procedure', base_duration_minutes: 30 },
  { name: 'Consultation', base_duration_minutes: 25 },
];

const insertType = db.prepare('INSERT OR IGNORE INTO visit_types (practice_id, name, base_duration_minutes) VALUES (?, ?, ?)');
visitTypes.forEach(t => insertType.run(practiceId, t.name, t.base_duration_minutes));

// Seed some visit history for AI duration estimation
const doctorRows = db.prepare('SELECT id FROM doctors WHERE practice_id = ?').all(practiceId);
const typeRows = db.prepare('SELECT id FROM visit_types WHERE practice_id = ?').all(practiceId);

const insertHistory = db.prepare('INSERT INTO visit_history (practice_id, doctor_id, visit_type_id, actual_duration_minutes) VALUES (?, ?, ?, ?)');
const durations = [12, 14, 16, 11, 18, 13, 15, 22, 19, 25];
doctorRows.forEach(doc => {
  typeRows.forEach(type => {
    durations.slice(0, 5).forEach(d => {
      insertHistory.run(practiceId, doc.id, type.id, d + Math.floor(Math.random() * 5));
    });
  });
});

// Seed some feedback
const insertFeedback = db.prepare('INSERT INTO feedback (practice_id, patient_name, rating, wait_time_rating, doctor_rating, comment, is_public, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const feedbackData = [
  ['Anita Desai', 5, 5, 5, 'Very smooth experience, minimal wait!', 1, 'app'],
  ['Ravi Kumar', 4, 3, 5, 'Doctor was excellent. Wait was a bit long.', 1, 'walk-in'],
  ['Sunita Patel', 2, 1, 4, 'Waited 45 minutes without any update.', 0, 'digital'],
  ['Arjun Nair', 5, 4, 5, 'Great service and friendly staff.', 1, 'app'],
  ['Meena Joshi', 3, 2, 4, 'The queue system helped but still waited long.', 0, 'app'],
];
feedbackData.forEach(([name, r, wr, dr, comment, pub, source]) => {
  insertFeedback.run(practiceId, name, r, wr, dr, comment, pub, source);
});

// Seed some historical queue entries for analytics
const insertQueue = db.prepare(`
  INSERT INTO queue_entries (practice_id, patient_name, doctor_id, visit_type_id, status, position, token, joined_at, started_at, completed_at, estimated_wait_minutes)
  VALUES (?, ?, ?, ?, 'done', 1, ?, ?, ?, ?, ?)
`);
const { v4: uuidv4 } = require('uuid');
for (let i = 0; i < 20; i++) {
  const joinedAt = new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000);
  const startedAt = new Date(joinedAt.getTime() + (10 + Math.random() * 20) * 60000);
  const completedAt = new Date(startedAt.getTime() + (10 + Math.random() * 20) * 60000);
  insertQueue.run(
    practiceId, `Patient ${i + 1}`,
    doctorRows[i % doctorRows.length].id,
    typeRows[i % typeRows.length].id,
    uuidv4(),
    joinedAt.toISOString(), startedAt.toISOString(), completedAt.toISOString(),
    15
  );
}

// Seed appointments
const insertAppt = db.prepare(`
  INSERT INTO appointments (practice_id, patient_name, patient_phone, doctor_id, visit_type_id, scheduled_at, duration_minutes, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
const apptPatients = ['Vikram Singh', 'Kavya Reddy', 'Deepak Gupta', 'Pooja Iyer', 'Amit Shah'];
apptPatients.forEach((name, i) => {
  const time = new Date(tomorrow);
  time.setHours(9 + i, 0, 0, 0);
  insertAppt.run(
    practiceId, name, `+91 9${Math.floor(Math.random() * 1e9)}`,
    doctorRows[i % doctorRows.length].id,
    typeRows[i % typeRows.length].id,
    time.toISOString(), 15, 'scheduled'
  );
});

console.log(`
✅ Seed complete!

Practice: City Health Clinic
Practice ID: ${practiceId}
Practice PIN: 1234 (use this to log into dashboard)

Patient URL: http://localhost:5173/patient/${practiceId}
Practice Dashboard: http://localhost:5173/practice
`);
