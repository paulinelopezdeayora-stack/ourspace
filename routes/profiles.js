const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');

const PUBLIC_FIELDS = `id, username, display_name, bio, location, mood,
  song_title, song_artist, avatar_data, skin, created_at, last_seen`;

// GET /api/profiles/:username
router.get('/:username', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE username = $1`,
      [req.params.username.toLowerCase()]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/profiles/me  (doit être avant /:username pour pas être capturé)
router.put('/me', requireAuth, async (req, res) => {
  const { display_name, bio, location, mood, song_title, song_artist, skin, avatar_data } = req.body;

  try {
    const r = await pool.query(
      `UPDATE users SET
         display_name = COALESCE(NULLIF($1,''), display_name),
         bio          = COALESCE($2, bio),
         location     = COALESCE($3, location),
         mood         = COALESCE($4, mood),
         song_title   = COALESCE(NULLIF($5,''), song_title),
         song_artist  = COALESCE(NULLIF($6,''), song_artist),
         skin         = COALESCE(NULLIF($7,''), skin),
         avatar_data  = COALESCE($8, avatar_data)
       WHERE id = $9
       RETURNING ${PUBLIC_FIELDS}`,
      [display_name, bio, location, mood, song_title, song_artist, skin, avatar_data, req.session.userId]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
