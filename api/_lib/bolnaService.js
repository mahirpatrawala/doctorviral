export async function makeReminderCall(appointment) {
  if (!appointment.patient_phone) return null

  const apiKey = process.env.BOLNA_API_KEY
  const agentId = process.env.BOLNA_AGENT_ID

  if (!apiKey || !agentId) {
    console.log(`[BOLNA] Keys not configured — would have called ${appointment.patient_phone} for appt #${appointment.id}`)
    return null
  }

  const scheduledTime = new Date(appointment.scheduled_at).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true
  })

  try {
    const res = await fetch('https://api.bolna.dev/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: appointment.patient_phone,
        user_data: {
          appointment_id: appointment.id,
          patient_name: appointment.patient_name,
          doctor_name: appointment.doctor_name || 'your doctor',
          clinic_name: appointment.practice_name || 'the clinic',
          appointment_time: scheduledTime,
        },
      }),
    })

    if (!res.ok) {
      console.error(`[BOLNA] Failed for appt #${appointment.id}:`, await res.text())
      return null
    }

    const data = await res.json()
    console.log(`[BOLNA] Called ${appointment.patient_name} (appt #${appointment.id}), call_id: ${data.call_id}`)
    return data.call_id
  } catch (err) {
    console.error(`[BOLNA] Error for appt #${appointment.id}:`, err.message)
    return null
  }
}
