// Local smoke test: generates a sample certificate PNG using the OSWS template
// Does not upload or touch the database.

const path = require('path');
const os = require('os');
const fs = require('fs');
const { generateCertificate } = require('../utils/certificateGenerator');

async function main() {
  try {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(os.tmpdir(), `certificate_sample_${timestamp}.png`);
  // Hint: set USE_REMOTE_FONTS=true to download Great Vibes/Merriweather on first run
  process.env.USE_REMOTE_FONTS = process.env.USE_REMOTE_FONTS ?? 'true';
  // Optional: enable font debug logs
  // process.env.DEBUG_FONTS = 'true';
    await generateCertificate({
      studentName: 'Juan M. Dela Cruz Jr.',
      eventTitle: 'Sample Orientation and Student Success Workshop',
      eventStartDate: '2025-08-20',
      eventEndDate: '2025-08-20',
  eventLocation: 'Gordon College Main Campus, AVR',
      certificatePath: outPath,
    });
    console.log('Sample certificate generated at:', outPath);
    if (fs.existsSync(outPath)) {
      const stats = fs.statSync(outPath);
      console.log('File size:', stats.size, 'bytes');
    }
  } catch (err) {
    console.error('Failed to generate sample certificate:', err);
    process.exitCode = 1;
  }
}

main();
