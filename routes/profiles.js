const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');
const r2          = require('../lib/r2');
const multer      = require('multer');
const upload      = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const PUBLIC_FIELDS = `id, username, display_name, bio, location, mood,
  song_title, song_artist, avatar_data, avatar_url, audio_data, audio_url, audio_name, skin, interests, marquee_text, custom_css, created_at, last_seen`;

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
  const { display_name, bio, location, mood, song_title, song_artist, skin, avatar_data, audio_data, audio_name, interests, marquee_text, custom_css } = req.body;
  const uid = req.session.userId;

  try {
    let avatar_url = undefined;
    let audio_url  = undefined;
    // Ces flags indiquent si on a réussi à uploader vers R2 (et donc qu'on ne veut PAS sauver le base64 en DB)
    let avatarWentToR2 = false;
    let audioWentToR2  = false;

    // Upload avatar vers R2 si base64 fourni et R2 configuré
    if (avatar_data && avatar_data.startsWith('data:') && process.env.R2_ENDPOINT) {
      try {
        const parsed = parseDataUri(avatar_data);
        if (parsed) {
          const ext = parsed.contentType.split('/')[1] || 'jpg';
          avatar_url = await r2.upload(`avatar_${uid}.${ext}`, parsed.buffer, parsed.contentType);
          avatarWentToR2 = true;
        }
      } catch (r2err) {
        console.warn('R2 avatar upload failed, fallback base64:', r2err.message);
      }
    }

    // Upload audio vers R2 si base64 fourni et R2 configuré
    if (audio_data && audio_data.startsWith('data:') && process.env.R2_ENDPOINT) {
      try {
        const parsed = parseDataUri(audio_data);
        if (parsed) {
          const ext = parsed.contentType.split('/')[1] || 'mp3';
          audio_url = await r2.upload(`audio_${uid}.${ext}`, parsed.buffer, parsed.contentType);
          audioWentToR2 = true;
        }
      } catch (r2err) {
        console.warn('R2 audio upload failed, fallback base64:', r2err.message);
      }
    }

    // Valeurs à écrire en DB :
    // - Si R2 a réussi  → on stocke l'URL et on efface le base64 (évite de dupliquer)
    // - Si R2 a raté    → on stocke le base64 directement, audio_url reste inchangé
    // - Si rien envoyé  → on ne touche à rien
    const newAvatarData = avatar_data ? (avatarWentToR2 ? null : avatar_data) : undefined;
    const newAvatarUrl  = avatar_url  || undefined;
    const newAudioData  = audio_data  ? (audioWentToR2  ? null : audio_data)  : undefined;
    const newAudioUrl   = audio_url   || undefined;

    const r = await pool.query(
      `UPDATE users SET
         display_name = COALESCE(NULLIF($1,''),  display_name),
         bio          = COALESCE($2,             bio),
         location     = COALESCE($3,             location),
         mood         = COALESCE($4,             mood),
         song_title   = COALESCE(NULLIF($5,''),  song_title),
         song_artist  = COALESCE(NULLIF($6,''),  song_artist),
         skin         = COALESCE(NULLIF($7,''),  skin),
         avatar_data  = CASE WHEN $8::text  IS NOT NULL THEN $8::text  ELSE avatar_data END,
         avatar_url   = CASE WHEN $9::text  IS NOT NULL THEN $9::text  ELSE avatar_url  END,
         audio_data   = CASE WHEN $10::text IS NOT NULL THEN $10::text ELSE audio_data  END,
         audio_url    = CASE WHEN $11::text IS NOT NULL THEN $11::text ELSE audio_url   END,
         audio_name   = COALESCE($12,            audio_name),
         interests    = COALESCE($13,            interests),
         marquee_text = COALESCE($15,            marquee_text),
         custom_css   = CASE WHEN $16::text IS NOT NULL THEN NULLIF($16::text,'') ELSE custom_css END
       WHERE id = $14
       RETURNING ${PUBLIC_FIELDS}`,
      // pg v8 interdit les undefined — on convertit tout en null
      [display_name ?? null, bio ?? null, location ?? null, mood ?? null,
       song_title ?? null, song_artist ?? null, skin ?? null,
       newAvatarData ?? null, newAvatarUrl ?? null,
       newAudioData  ?? null, newAudioUrl  ?? null,
       audio_name   ?? null, interests    ?? null,
       uid,
       marquee_text ?? null, custom_css ?? null]
    );

    res.json(r.rows[0]);
  } catch (e) {
    console.error('PUT /profiles/me error:', e.message, e.code);
    res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
});

// POST /api/profiles/me/audio — upload multipart (plus fiable que base64 JSON)
router.post('/me/audio', requireAuth, (req, res, next) => {
  // Callback form pour capturer les erreurs multer en JSON (sinon Express renvoie du HTML)
  upload.single('audio')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'Erreur parsing fichier : ' + err.message });
    next();
  });
}, async (req, res) => {
  const uid  = req.session.userId;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Aucun fichier audio fourni (champ "audio" manquant)' });

  const audioName = (req.body.audio_name || file.originalname || '').replace(/\.[^.]+$/, '') || 'Piste';

  let audio_url  = null;
  let audio_data = null;

  // Tentative upload R2
  if (process.env.R2_ENDPOINT) {
    try {
      const ext = (file.mimetype.split('/')[1] || 'mp3').replace('mpeg', 'mp3');
      audio_url = await r2.upload(`audio_${uid}.${ext}`, file.buffer, file.mimetype);
    } catch (r2err) {
      console.error('R2 audio upload failed:', r2err.message);
      return res.status(500).json({ error: 'Stockage R2 indisponible : ' + r2err.message });
    }
  }

  // Fallback base64 uniquement si R2 pas configuré (petits fichiers)
  if (!audio_url) {
    if (file.size > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Fichier trop grand sans R2 (max 5 Mo). Configure R2 pour les gros fichiers.' });
    }
    audio_data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  }

  try {
    const r = await pool.query(
      `UPDATE users SET
         audio_url  = COALESCE($1::text, audio_url),
         audio_data = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE audio_data END,
         audio_name = $3
       WHERE id = $4
       RETURNING audio_url, audio_name`,
      [audio_url, audio_data, audioName, uid]
    );
    res.json({ ok: true, audio_data: audio_data, ...r.rows[0] });
  } catch (e) {
    console.error('DB audio save error:', e);
    res.status(500).json({ error: 'Erreur base de données : ' + e.message });
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
