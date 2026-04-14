const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./database');
const { makeReminderCall } = require('./services/bolnaService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.set('io', io);

// Routes
app.use('/api/practices', require('./routes/practices'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/analytics', require('./routes/analytics'));

// Serve generated QR files (HTML signs + PNG images)
const QR_DIR = path.join(__dirname, '..', '..', 'printable-qr');
app.use('/qr-files', express.static(QR_DIR));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Socket.io rooms
io.on('connection', (socket) => {
  // Practice dashboard joins practice room
  socket.on('join_practice', (practiceId) => {
    socket.join(`practice_${practiceId}`);
  });

  // Patient joins their personal token room for status updates
  socket.on('join_patient', (token) => {
    socket.join(`patient_${token}`);
  });

  socket.on('disconnect', () => {});
});

// Reminder cron: runs every minute, checks appointments needing reminders
cron.schedule('* * * * *', () => {
  const now = new Date();

  const check = (hours, field) => {
    const target = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const windowStart = new Date(target.getTime() - 30000); // 30s window
    const windowEnd = new Date(target.getTime() + 30000);

    const appts = db.prepare(`
      SELECT a.*, p.name as practice_name, d.name as doctor_name
      FROM appointments a
      JOIN practices p ON a.practice_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.status IN ('scheduled', 'confirmed')
      AND a.${field} = 0
      AND a.scheduled_at BETWEEN ? AND ?
    `).all(windowStart.toISOString(), windowEnd.toISOString());

    appts.forEach(appt => {
      db.prepare(`UPDATE appointments SET ${field} = 1 WHERE id = ?`).run(appt.id);

      console.log(`[REMINDER] ${appt.patient_name} — ${Math.round(hours)}h reminder for ${appt.scheduled_at}`);

      // 2h reminder → trigger Bolna voice call
      if (field === 'reminder_2h_sent') {
        makeReminderCall(appt);
      }

      io.to(`practice_${appt.practice_id}`).emit('reminder_sent', {
        appointment_id: appt.id,
        patient_name: appt.patient_name,
        reminder_type: field,
        scheduled_at: appt.scheduled_at,
        voice_call: field === 'reminder_2h_sent',
      });
    });
  };

  check(24, 'reminder_24h_sent');
  check(2, 'reminder_2h_sent');
  check(0.5, 'reminder_30m_sent');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Waitwell backend running on port ${PORT}`);
});
