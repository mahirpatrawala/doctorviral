const BOLNA_API_KEY = process.env.BOLNA_API_KEY || '';
const BOLNA_AGENT_ID = process.env.BOLNA_AGENT_ID || '';
const BOLNA_BASE_URL = 'https://api.bolna.dev';

/**
 * Trigger an outbound reminder call via Bolna for a 2h-before appointment.
 * Patient hears: "Press 1 to confirm, 2 to reschedule, 3 to cancel."
 * Bolna webhook → POST /api/appointments/bolna-webhook with their keypress.
 */
async function makeReminderCall(appointment) {
  if (!appointment.patient_phone) {
    console.log(`[BOLNA] Skipping call for appt #${appointment.id} — no phone number`);
    return null;
  }

  if (!BOLNA_API_KEY || !BOLNA_AGENT_ID) {
    // Graceful fallback when keys aren't configured — log and continue
    console.log(`[BOLNA] API keys not configured. Would have called ${appointment.patient_phone} for appt #${appointment.id}`);
    return null;
  }

  const scheduledTime = new Date(appointment.scheduled_at).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true
  });

  const payload = {
    agent_id: BOLNA_AGENT_ID,
    recipient_phone_number: appointment.patient_phone,
    user_data: {
      appointment_id: appointment.id,
      patient_name: appointment.patient_name,
      doctor_name: appointment.doctor_name || 'your doctor',
      clinic_name: appointment.practice_name || 'the clinic',
      appointment_time: scheduledTime,
    },
  };

  try {
    const res = await fetch(`${BOLNA_BASE_URL}/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BOLNA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[BOLNA] Call failed for appt #${appointment.id}: ${err}`);
      return null;
    }

    const data = await res.json();
    console.log(`[BOLNA] Call initiated for ${appointment.patient_name} (appt #${appointment.id}), call_id: ${data.call_id}`);
    return data.call_id;
  } catch (err) {
    console.error(`[BOLNA] Network error for appt #${appointment.id}:`, err.message);
    return null;
  }
}

module.exports = { makeReminderCall };
