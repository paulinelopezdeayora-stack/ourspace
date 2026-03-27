const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { awardBadge } = require('../lib/badges');

// GET /api/friends/me — mes amis acceptés
router.get('/me', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_data, u.mood, u.last_seen,
              f.position, f.status
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'accepted'
       ORDER BY f.position NULLS LAST, u.display_name`,
      [req.session.userId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/friends/requests — demandes reçues en attente
router.get('/requests', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_data, f.created_at
       FROM friends f
       JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.session.userId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/friends/request/:username — envoyer une demande
router.post('/request/:username', requireAuth, async (req, res) => {
  try {
    const target = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [req.params.username.toLowerCase()]
    );
    if (!target.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.rows[0].id === req.session.userId)
      return res.status(400).json({ error: 'On peut pas s\'ajouter soi-même 😅' });

    await pool.query(
      `INSERT INTO friends (user_id, friend_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (user_id, friend_id) DO NOTHING`,
      [req.session.userId, target.rows[0].id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/friends/accept/:username — accepter une demande
router.post('/accept/:username', requireAuth, async (req, res) => {
  try {
    const requester = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [req.params.username.toLowerCase()]
    );
    if (!requester.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const rid = requester.rows[0].id;

    await pool.query(
      `UPDATE friends SET status = 'accepted'
       WHERE user_id = $1 AND friend_id = $2`,
      [rid, req.session.userId]
    );
    // Amitié mutuelle
    await pool.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
      [req.session.userId, rid]
    );
    awardBadge(req.session.userId, 'first_friend');
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/friends/:username — supprimer un ami (les deux sens)
router.delete('/:username', requireAuth, async (req, res) => {
  try {
    const target = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [req.params.username.toLowerCase()]
    );
    if (!target.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });

    await pool.query(
      `DELETE FROM friends
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [req.session.userId, target.rows[0].id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/friends/top8 — réordonner le top 8
router.put('/top8', requireAuth, async (req, res) => {
  const { order } = req.body; // tableau de usernames (max 8)
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Format invalide' });

  try {
    await pool.query(
      'UPDATE friends SET position = NULL WHERE user_id = $1',
      [req.session.userId]
    );
    for (let i = 0; i < Math.min(order.length, 8); i++) {
      const u = await pool.query('SELECT id FROM users WHERE username = $1', [order[i]]);
      if (u.rows[0]) {
        await pool.query(
          'UPDATE friends SET position = $1 WHERE user_id = $2 AND friend_id = $3',
          [i + 1, req.session.userId, u.rows[0].id]
        );
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
