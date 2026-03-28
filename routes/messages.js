const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');

// ── Helpers ──────────────────────────────────────────────────────────────────

// Renvoie les deux IDs triés pour la clé de conversation
function convKey(a, b) {
  return [Math.min(a, b), Math.max(a, b)];
}

// GET /api/messages/conversations — liste des conversations de l'utilisateur connecté
router.get('/conversations', requireAuth, async (req, res) => {
  const uid = req.session.userId;
  try {
    const { rows } = await pool.query(`
      SELECT * FROM (
        SELECT DISTINCT ON (CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
          m.id,
          m.body,
          m.created_at,
          m.read_at,
          m.sender_id,
          CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS conv_partner,
          u.username        AS partner_username,
          u.display_name    AS partner_display_name,
          u.avatar_url      AS partner_avatar_url,
          u.avatar_data     AS partner_avatar_data,
          (
            SELECT COUNT(*) FROM messages unr
            WHERE unr.receiver_id = $1
              AND unr.sender_id = u.id
              AND unr.read_at IS NULL
          ) AS unread_count
        FROM messages m
        JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
        WHERE m.sender_id = $1 OR m.receiver_id = $1
        ORDER BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END, m.created_at DESC
      ) latest
      ORDER BY latest.created_at DESC
    `, [uid]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/messages/unread-count — nombre de messages non lus
router.get('/unread-count', requireAuth, async (req, res) => {
  const uid = req.session.userId;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM messages WHERE receiver_id = $1 AND read_at IS NULL`,
      [uid]
    );
    res.json({ count: parseInt(rows[0].count, 10) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/messages/:username — fil de conversation avec un utilisateur
router.get('/:username', requireAuth, async (req, res) => {
  const uid = req.session.userId;
  try {
    const other = await pool.query('SELECT id FROM users WHERE username = $1', [req.params.username.toLowerCase()]);
    if (!other.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const otherId = other.rows[0].id;

    const { rows } = await pool.query(`
      SELECT m.id, m.sender_id, m.receiver_id, m.body, m.created_at, m.read_at,
             s.username AS sender_username, s.display_name AS sender_display_name,
             s.avatar_url AS sender_avatar_url, s.avatar_data AS sender_avatar_data
      FROM messages m
      JOIN users s ON s.id = m.sender_id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [uid, otherId]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/messages/:username — envoyer un message
router.post('/:username', requireAuth, async (req, res) => {
  const uid  = req.session.userId;
  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message vide' });
  if (body.length > 2000) return res.status(400).json({ error: 'Message trop long (max 2000 caractères)' });

  try {
    const other = await pool.query('SELECT id FROM users WHERE username = $1', [req.params.username.toLowerCase()]);
    if (!other.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const otherId = other.rows[0].id;
    if (otherId === uid) return res.status(400).json({ error: 'Impossible de s\'envoyer un message à soi-même' });

    const { rows } = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, receiver_id, body, created_at, read_at`,
      [uid, otherId, body]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/messages/:username/read — marquer le fil comme lu
router.patch('/:username/read', requireAuth, async (req, res) => {
  const uid = req.session.userId;
  try {
    const other = await pool.query('SELECT id FROM users WHERE username = $1', [req.params.username.toLowerCase()]);
    if (!other.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const otherId = other.rows[0].id;

    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE receiver_id = $1 AND sender_id = $2 AND read_at IS NULL`,
      [uid, otherId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
