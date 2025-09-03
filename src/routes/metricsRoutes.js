const express = require('express');
const router = express.Router();
const db = require('../config/db');

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id TINYINT PRIMARY KEY,
      total BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
  // Ensure the singleton row exists
  await db.execute(`INSERT IGNORE INTO site_visits (id, total) VALUES (1, 0)`);
}

router.get('/visits', async (req, res) => {
  try {
    await ensureTable();
    const [rows] = await db.execute('SELECT total FROM site_visits WHERE id = 1');
    const total = rows && rows[0] ? Number(rows[0].total) : 0;
    res.json({ success: true, total });
  } catch (err) {
    console.error('[metrics] GET /visits error:', err.message || err);
    res.status(500).json({ success: false, message: 'Failed to get visits' });
  }
});

router.post('/visits', async (req, res) => {
  try {
    await ensureTable();
    await db.execute(`INSERT INTO site_visits (id, total) VALUES (1, 1)
                      ON DUPLICATE KEY UPDATE total = total + 1`);
    const [rows] = await db.execute('SELECT total FROM site_visits WHERE id = 1');
    const total = rows && rows[0] ? Number(rows[0].total) : 0;
    res.json({ success: true, total });
  } catch (err) {
    console.error('[metrics] POST /visits error:', err.message || err);
    res.status(500).json({ success: false, message: 'Failed to increment visits' });
  }
});

module.exports = router;
