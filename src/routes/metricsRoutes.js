const express = require('express');
const router = express.Router();
const db = require('../config/db');
const rateLimit = require('../middleware/rateLimit');

// Metrics rate limiters
const metricsLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 }); // 120 requests per minute

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      page_key VARCHAR(100) DEFAULT NULL,
      total BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_page_key (page_key)
    ) ENGINE=InnoDB;
  `);
  // Ensure the global singleton row exists (upsert so it's idempotent)
  await db.execute(`
    INSERT INTO site_visits (page_key, total)
    VALUES ('global', 0)
    ON DUPLICATE KEY UPDATE total = total
  `);
}

router.get('/visits', metricsLimiter, async (req, res) => {
  try {
    await ensureTable();
    const [rows] = await db.execute(`SELECT total FROM site_visits WHERE page_key = 'global'`);
    const total = rows && rows[0] ? Number(rows[0].total) : 0;
    res.json({ success: true, total });
  } catch (err) {
    console.error('[metrics] GET /visits error:', err.message || err);
    res.status(500).json({ success: false, message: 'Failed to get visits' });
  }
});

router.post('/visits', metricsLimiter, async (req, res) => {
  try {
    await ensureTable();
    // Atomic upsert: increment total, or insert if not yet in the table
    await db.execute(`
      INSERT INTO site_visits (page_key, total)
      VALUES ('global', 1)
      ON DUPLICATE KEY UPDATE total = total + 1
    `);
    const [rows] = await db.execute(`SELECT total FROM site_visits WHERE page_key = 'global'`);
    const total = rows && rows[0] ? Number(rows[0].total) : 0;
    res.json({ success: true, total });
  } catch (err) {
    console.error('[metrics] POST /visits error:', err.message || err);
    res.status(500).json({ success: false, message: 'Failed to increment visits' });
  }
});

module.exports = router;
