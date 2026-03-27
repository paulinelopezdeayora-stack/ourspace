const router   = require('express').Router();
const { pool } = require('../db');

// GET /api/discover?q=search&page=1
router.get('/', async (req, res) => {
  const { q, page = 1 } = req.query;
  const limit  = 24;
  const offset = (Math.max(1, parseInt(page)) - 1) * limit;

  try {
    let r;
    if (q?.trim()) {
      r = await pool.query(
        `SELECT id, username, display_name, bio, avatar_data, mood, last_seen
         FROM users
         WHERE username ILIKE $1 OR display_name ILIKE $1
         ORDER BY last_seen DESC
         LIMIT $2 OFFSET $3`,
        [`%${q.trim()}%`, limit, offset]
      );
    } else {
      r = await pool.query(
        `SELECT id, username, display_name, bio, avatar_data, mood, last_seen
         FROM users
         ORDER BY last_seen DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
