const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');

const PUBLIC_FIELDS = `id, username, display_name, bio, location, mood,
  song_title, song_artist, avatar_data, audio_data, audio_name, skin, interests, created_at, last_seen`;

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

// PUT /api/profiles/me
router.put('/me', requireAuth, async (req, res) => {
  const { display_name, bio, location, mood, song_title, song_artist, skin, avatar_data, audio_data, audio_name, interests } = req.body;

  try {
    const r = await pool.query(
      `UPDATE users SET
         display_name = COALESCE(NULLIF($1,''),  display_name),
         bio          = COALESCE($2,             bio),
         location     = COALESCE($3,             location),
         mood         = COALESCE($4,             mood),
         song_title   = COALESCE(NULLIF($5,''),  song_title),
         song_artist  = COALESCE(NULLIF($6,''),  song_artist),
         skin         = COALESCE(NULLIF($7,''),  skin),
         avatar_data  = COALESCE($8,             avatar_data),
         audio_data   = COALESCE($9,             audio_data),
         audio_name   = COALESCE($10,            audio_name),
         interests    = COALESCE($11,            interests)
       WHERE id = $12
       RETURNING ${PUBLIC_FIELDS}`,
      [display_name, bio, location, mood, song_title, song_artist, skin, avatar_data, audio_data, audio_name, interests, req.session.userId]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/profiles/me/audio
router.delete('/me/audio', requireAuth, async (req, res) => {
  try {
    await pool.query(`UPDATE users SET audio_data = NULL, audio_name = '' WHERE id = $1`, [req.session.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
