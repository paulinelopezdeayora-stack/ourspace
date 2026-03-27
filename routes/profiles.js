const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');
const r2          = require('../lib/r2');
const { awardBadge } = require('../lib/badges');

const PUBLIC_FIELDS = `id, username, display_name, bio, location, mood,
  song_title, song_artist, avatar_data, avatar_url, audio_data, audio_url, audio_name, skin, interests, earned_badges, marquee_text, created_at, last_seen`;

// Convertit un base64 data-URI en buffer + contentType
function parseDataUri(dataUri) {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

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
  const { display_name, bio, location, mood, song_title, song_artist, skin, avatar_data, audio_data, audio_name, interests, marquee_text } = req.body;
  const uid = req.session.userId;

  try {
    let avatar_url = undefined;
    let audio_url  = undefined;

    // Upload avatar vers R2 si base64 fourni et R2 configuré
    if (avatar_data && avatar_data.startsWith('data:') && process.env.R2_ENDPOINT) {
      const parsed = parseDataUri(avatar_data);
      if (parsed) {
        const ext = parsed.contentType.split('/')[1] || 'jpg';
        avatar_url = await r2.upload(`avatar_${uid}.${ext}`, parsed.buffer, parsed.contentType);
      }
    }

    // Upload audio vers R2 si base64 fourni et R2 configuré
    if (audio_data && audio_data.startsWith('data:') && process.env.R2_ENDPOINT) {
      const parsed = parseDataUri(audio_data);
      if (parsed) {
        const ext = parsed.contentType.split('/')[1] || 'mp3';
        audio_url = await r2.upload(`audio_${uid}.${ext}`, parsed.buffer, parsed.contentType);
      }
    }

    const r = await pool.query(
      `UPDATE users SET
         display_name = COALESCE(NULLIF($1,''),  display_name),
         bio          = COALESCE($2,             bio),
         location     = COALESCE($3,             location),
         mood         = COALESCE($4,             mood),
         song_title   = COALESCE(NULLIF($5,''),  song_title),
         song_artist  = COALESCE(NULLIF($6,''),  song_artist),
         skin         = COALESCE(NULLIF($7,''),  skin),
         avatar_data  = CASE WHEN $8 IS NOT NULL AND $9 IS NULL THEN $8 ELSE avatar_data END,
         avatar_url   = COALESCE($9,             avatar_url),
         audio_data   = CASE WHEN $10 IS NOT NULL AND $11 IS NULL THEN $10 ELSE audio_data END,
         audio_url    = COALESCE($11,            audio_url),
         audio_name   = COALESCE($12,            audio_name),
         interests    = COALESCE($13,            interests),
         marquee_text = COALESCE($15,            marquee_text)
       WHERE id = $14
       RETURNING ${PUBLIC_FIELDS}`,
      [display_name, bio, location, mood, song_title, song_artist, skin,
       avatar_data || null, avatar_url || null,
       audio_data || null, audio_url || null,
       audio_name, interests, uid,
       marquee_text !== undefined ? marquee_text : null]
    );

    // Award badges
    if ((avatar_data && avatar_data !== null) || (avatar_url && avatar_url !== null)) {
      awardBadge(uid, 'customized');
    }
    if ((audio_data && audio_data !== null) || (audio_url && audio_url !== null)) {
      awardBadge(uid, 'music_lover');
    }

    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/profiles/me/audio
router.delete('/me/audio', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    if (process.env.R2_ENDPOINT) {
      const u = await pool.query('SELECT audio_url FROM users WHERE id = $1', [uid]);
      const url = u.rows[0]?.audio_url;
      if (url) await r2.remove(url.replace('/api/media/', ''));
    }
    await pool.query(`UPDATE users SET audio_data = NULL, audio_url = NULL, audio_name = '' WHERE id = $1`, [uid]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
