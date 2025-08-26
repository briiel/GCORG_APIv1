#!/usr/bin/env node
require('dotenv').config();

(async () => {
  try {
    const { runReminderSweep } = require('../services/reminderService');
  const lead = parseInt(process.argv[2] || process.env.TEST_REMINDER_MINUTES || '10', 10);
    const res = await runReminderSweep(lead);
    console.log(`Reminder sweep (${lead}m): attempted=${res.attempted}, sent=${res.sent}`);
    process.exit(0);
  } catch (e) {
    console.error('Reminder sweep failed:', e?.message || e);
    process.exit(1);
  }
})();
