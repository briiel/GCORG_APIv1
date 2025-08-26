const eventService = require('./eventService');
const { sendReminderEmail } = require('../utils/mailer');

// Run reminder sweep for a given lead window (in minutes)
async function runReminderSweep(leadMinutes) {
  const lead = parseInt(leadMinutes, 10);
  if (!lead || lead <= 0) return { attempted: 0, sent: 0 };

  // Ensure table exists (idempotent)
  try { await eventService.ensureEmailRemindersTable(); } catch (_) {}

  const pending = await eventService.getUpcomingRegistrationsForReminder(lead);
  let sent = 0;
  for (const row of pending) {
    const event = {
      title: row.title,
      location: row.location,
      start_date: row.start_date,
      start_time: row.start_time,
      end_date: row.end_date,
      end_time: row.end_time,
    };
    const student = { first_name: row.first_name, last_name: row.last_name };
    const to = row.email;
    try {
      await sendReminderEmail({ to, event, student, windowLabel: `Starts in about ${lead} minute(s)`, qrUrl: row.qr_code });
      await eventService.markReminderSent({ event_id: row.event_id, student_id: row.student_id, leadMinutes: lead });
      sent++;
    } catch (e) {
      // swallow to continue others
      // console.error('Reminder send failed:', e?.message || e);
    }
  }
  return { attempted: pending.length, sent };
}

module.exports = { runReminderSweep };
