const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');
const createNotif = require('../lib/notif');

// GET /api/posts?page=0
router.get('/', requireAuth, async (req, res) => {
  const page  = parseInt(req.query.page) || 0;
  const limit = 20;
  try {
    const r = await pool.query(`
      SELECT
        p.id, p.title, p.body, p.photo_data, p.comments_disabled, p.created_at,
        u.username, u.display_name, u.avatar_data, u.avatar_url,
        (SELECT COUNT(*)::int FROM post_likes    WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*)::int FROM post_comments WHERE post_id = p.id) AS comment_count,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) AS liked
      FROM posts p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.session.userId, limit, page * limit]);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/posts/user/:username — posts publics d'un utilisateur
router.get('/user/:username', async (req, res) => {
  const limit  = parseInt(req.query.limit) || 3;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const u = await pool.query('SELECT id FROM users WHERE username = $1', [req.params.username.toLowerCase()]);
    if (!u.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const r = await pool.query(`
      SELECT p.id, p.title, p.body, p.photo_data, p.created_at,
        (SELECT COUNT(*)::int FROM post_likes    WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*)::int FROM post_comments WHERE post_id = p.id) AS comment_count
      FROM posts p
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [u.rows[0].id, limit, offset]);
    const total = await pool.query('SELECT COUNT(*)::int FROM posts WHERE user_id = $1', [u.rows[0].id]);
    res.json({ posts: r.rows, total: total.rows[0].count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/posts
router.post('/', requireAuth, async (req, res) => {
  const { title, body, photo_data, comments_disabled } = req.body;
  if (!title?.trim() && !body?.trim()) return res.status(400).json({ error: 'Titre ou contenu requis' });
  try {
    const r = await pool.query(
      `INSERT INTO posts (user_id, title, body, photo_data, comments_disabled)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.session.userId, title || '', body || '', photo_data || null, !!comments_disabled]
    );
    res.json({ id: r.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.session.userId]
    );
    if (!r.rows[0]) return res.status(403).json({ error: 'Interdit' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/posts/:id/like  (toggle)
router.post('/:id/like', requireAuth, async (req, res) => {
  const postId = req.params.id;
  const userId = req.session.userId;
  try {
    const existing = await pool.query(
      'SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );
    if (existing.rows.length) {
      await pool.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      res.json({ liked: false });
    } else {
      await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
      // Notifier le propriétaire du post
      const owner = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
      if (owner.rows[0]) createNotif(owner.rows[0].user_id, 'post_like', userId, parseInt(postId));
      res.json({ liked: true });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/posts/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT pc.id, pc.text, pc.created_at, u.username, u.display_name, u.avatar_data, u.avatar_url
      FROM post_comments pc
      JOIN users u ON u.id = pc.user_id
      WHERE pc.post_id = $1
      ORDER BY pc.created_at ASC
    `, [req.params.id]);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/posts/:id/comments
router.post('/:id/comments', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Commentaire vide' });
  try {
    const post = await pool.query('SELECT comments_disabled FROM posts WHERE id = $1', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Post introuvable' });
    if (post.rows[0].comments_disabled) return res.status(403).json({ error: 'Commentaires désactivés' });
    const r = await pool.query(
      'INSERT INTO post_comments (post_id, user_id, text) VALUES ($1, $2, $3) RETURNING id, created_at',
      [req.params.id, req.session.userId, text.trim()]
    );
    // Notifier le propriétaire du post
    const owner = await pool.query('SELECT user_id FROM posts WHERE id = $1', [req.params.id]);
    if (owner.rows[0]) createNotif(owner.rows[0].user_id, 'post_comment', req.session.userId, parseInt(req.params.id));
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/posts/:id/comments-toggle
router.patch('/:id/comments-toggle', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE posts SET comments_disabled = NOT comments_disabled
       WHERE id = $1 AND user_id = $2 RETURNING comments_disabled`,
      [req.params.id, req.session.userId]
    );
    if (!r.rows[0]) return res.status(403).json({ error: 'Interdit' });
    res.json({ comments_disabled: r.rows[0].comments_disabled });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
