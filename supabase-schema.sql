-- =============================================================
-- Waitwell — Supabase PostgreSQL Schema
-- Run this entire file in the Supabase SQL Editor once.
-- =============================================================

-- ── Practices ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practices (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  pin_code    TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  qr_url      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Doctors ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id          SERIAL PRIMARY KEY,
  practice_id INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  specialty   TEXT,
  is_active   BOOLEAN DEFAULT TRUE
);

-- ── Visit Types ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visit_types (
  id                    SERIAL PRIMARY KEY,
  practice_id           INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  base_duration_minutes INTEGER DEFAULT 15
);

-- ── Queue Entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_entries (
  id                      SERIAL PRIMARY KEY,
  practice_id             INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  patient_name            TEXT NOT NULL,
  patient_phone           TEXT,
  doctor_id               INTEGER REFERENCES doctors(id),
  visit_type_id           INTEGER REFERENCES visit_types(id),
  status                  TEXT NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting','called','in_progress','done','left')),
  position                INTEGER,
  estimated_wait_minutes  INTEGER,
  token                   TEXT UNIQUE NOT NULL,
  joined_at               TIMESTAMPTZ DEFAULT NOW(),
  called_at               TIMESTAMPTZ,
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ
);

-- ── Appointments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id                  SERIAL PRIMARY KEY,
  practice_id         INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  doctor_id           INTEGER REFERENCES doctors(id),
  visit_type_id       INTEGER REFERENCES visit_types(id),
  patient_name        TEXT NOT NULL,
  patient_phone       TEXT,
  scheduled_at        TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER DEFAULT 15,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','confirmed','arrived','in_progress','done','no_show','cancelled')),
  reminder_24h_sent   BOOLEAN DEFAULT FALSE,
  reminder_2h_sent    BOOLEAN DEFAULT FALSE,
  reminder_30m_sent   BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Visit History (for AI duration estimation) ────────────────
CREATE TABLE IF NOT EXISTS visit_history (
  id               SERIAL PRIMARY KEY,
  practice_id      INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  doctor_id        INTEGER REFERENCES doctors(id),
  visit_type_id    INTEGER REFERENCES visit_types(id),
  actual_duration  INTEGER NOT NULL,
  recorded_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Feedback ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id           SERIAL PRIMARY KEY,
  practice_id  INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  patient_name TEXT,
  rating       INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  is_public    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications (bridges cron → Supabase Realtime) ──────────
CREATE TABLE IF NOT EXISTS notifications (
  id           SERIAL PRIMARY KEY,
  practice_id  INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,   -- 'reminder_sent' | 'reschedule_requested'
  data         JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- Enable Realtime for live-updating tables
-- (Run each line individually if the full block errors)
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================================
-- Seed data — one demo practice with two doctors + visit types
-- (Optional — delete this block if you don't want demo data)
-- =============================================================
INSERT INTO practices (name, pin_code, address, phone)
VALUES ('Demo Clinic', '1234', '123 Main St', '+91 98765 43210')
ON CONFLICT DO NOTHING;

INSERT INTO doctors (practice_id, name, specialty)
VALUES
  (1, 'Dr. Priya Sharma', 'General Physician'),
  (1, 'Dr. Rohan Mehta', 'Pediatrics')
ON CONFLICT DO NOTHING;

INSERT INTO visit_types (practice_id, name, base_duration_minutes)
VALUES
  (1, 'General Checkup', 15),
  (1, 'Follow-up', 10),
  (1, 'Consultation', 20),
  (1, 'Vaccination', 10)
ON CONFLICT DO NOTHING;
