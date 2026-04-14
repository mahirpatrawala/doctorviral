const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'waitwell.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS practices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    pin_code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_id INTEGER REFERENCES practices(id),
    name TEXT NOT NULL,
    specialty TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visit_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_id INTEGER REFERENCES practices(id),
    name TEXT NOT NULL,
    base_duration_minutes INTEGER DEFAULT 15
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    practice_id INTEGER REFERENCES practices(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS queue_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_id INTEGER NOT NULL REFERENCES practices(id),
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    doctor_id INTEGER REFERENCES doctors(id),
    visit_type_id INTEGER REFERENCES visit_types(id),
    status TEXT DEFAULT 'waiting',
    position INTEGER,
    token TEXT UNIQUE NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    estimated_wait_minutes INTEGER,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_id INTEGER NOT NULL REFERENCES practices(id),
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    doctor_id INTEGER REFERENCES doctors(id),
    visit_type_id INTEGER REFERENCES visit_types(id),
    scheduled_at DATETIME NOT NULL,
    duration_minutes INTEGER DEFAULT 15,
    status TEXT DEFAULT 'scheduled',
    reminder_24h_sent INTEGER DEFAULT 0,
    reminder_2h_sent INTEGER DEFAULT 0,
    reminder_30m_sent INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_id INTEGER REFERENCES practices(id),
    doctor_id INTEGER REFERENCES doctors(id),
    visit_type_id INTEGER REFERENCES visit_types(id),
    actual_duration_minutes INTEGER NOT NULL,
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_id INTEGER REFERENCES practices(id),
    patient_name TEXT,
    rating INTEGER,
    wait_time_rating INTEGER,
    doctor_rating INTEGER,
    comment TEXT,
    is_public INTEGER DEFAULT 0,
    source TEXT DEFAULT 'app',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
