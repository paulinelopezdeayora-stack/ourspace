const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');

// GET /api/comments/:username
router.get('/:username', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.content, c.created_at,
              a.username    AS author_username,
              a.display_name AS author_name,
              a.avatar_data  AS author_avatar
       FROM comments c
       JOIN users a ON a.id = c.author_id
       JOIN users p ON p.id = c.profile_id
       WHERE p.username = $1
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [req.params.username.toLowerCase()]
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/comments/:username
router.post('/:username', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Commentaire vide' });

  try {
    const profile = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [req.params.username.toLowerCase()]
    );
    if (!profile.rows[0]) return res.status(404).json({ error: 'Profil introuvable' });

    const ins = await pool.query(
      `INSERT INTO comments (profile_id, author_id, content)
       VALUES ($1, $2, $3) RETURNING id, content, created_at`,
      [profile.rows[0].id, req.session.userId, content.trim()]
    );
    const author = await pool.query(
      'SELECT username, display_name, avatar_data FROM users WHERE id = $1',
      [req.session.userId]
    );
    res.json({
      ...ins.rows[0],
      author_username: author.rows[0].username,
      author_name:     author.rows[0].display_name,
      author_avatar:   author.rows[0].avatar_data,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/comments/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Commentaire introuvable' });

    const uid = req.session.userId;
    if (r.rows[0].author_id !== uid && r.rows[0].profile_id !== uid)
      return res.status(403).json({ error: 'Non autorisé' });

    await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
