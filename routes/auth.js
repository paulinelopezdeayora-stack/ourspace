const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const { pool } = require('../db');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  let { username, email, password, display_name } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: 'Pseudo, email et mot de passe requis' });

  username = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (username.length < 3)
    return res.status(400).json({ error: 'Pseudo trop court (min 3 caractères, lettres/chiffres/_ uniquement)' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, skin`,
      [username, email.toLowerCase().trim(), hash, (display_name || username).trim()]
    );
    req.session.userId = r.rows[0].id;

    // Auto-amitié avec le premier membre du réseau (Tom de Ourspace)
    try {
      const first = await pool.query(
        'SELECT id FROM users WHERE id != $1 ORDER BY id ASC LIMIT 1',
        [r.rows[0].id]
      );
      if (first.rows[0]) {
        const tomId = first.rows[0].id;
        const newId = r.rows[0].id;
        await pool.query(
          `INSERT INTO friends (user_id, friend_id, status)
           VALUES ($1,$2,'accepted'),($2,$1,'accepted')
           ON CONFLICT (user_id, friend_id) DO NOTHING`,
          [tomId, newId]
        );
      }
    } catch (_) { /* non-bloquant */ }

    res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      const field = e.detail?.includes('username') ? 'Pseudo' : 'Email';
      return res.status(400).json({ error: `${field} déjà utilisé` });
    }
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const r = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    req.session.userId = user.id;
    await pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    const { password_hash, ...safe } = user;
    res.json({ ok: true, user: safe });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: 'Non connecté' });

  try {
    const r = await pool.query(
      `SELECT id, username, display_name, bio, location, mood,
              song_title, song_artist, avatar_data, audio_data, audio_name, skin, created_at, last_seen
       FROM users WHERE id = $1`,
      [req.session.userId]
    );
    if (!r.rows[0]) {
      req.session.destroy();
      return res.status(401).json({ error: 'Session expirée' });
    }
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
