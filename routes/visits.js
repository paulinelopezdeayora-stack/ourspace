const router   = require('express').Router();
const { pool } = require('../db');

// POST /api/visits — incrémente une fois par session, retourne le total
router.post('/', async (req, res) => {
  try {
    if (!req.session.visitCounted) {
      await pool.query(`
        INSERT INTO site_stats (key, value) VALUES ('total_visits', 1)
        ON CONFLICT (key) DO UPDATE SET value = site_stats.value + 1
      `);
      req.session.visitCounted = true;
    }
    const r = await pool.query("SELECT value FROM site_stats WHERE key = 'total_visits'");
    res.json({ count: parseInt(r.rows[0]?.value || 0) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ count: 0 });
  }
});

module.exports = router;
