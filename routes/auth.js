const router      = require('express').Router();
const bcrypt      = require('bcryptjs');
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');
async function sendWelcomeEmail(to, displayName, username) {
  const key = process.env.RESEND_KEY;
  if (!key) return;
  const html = [
    '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head><body>',
    '<div style="max-width:520px;margin:30px auto;background:#0d0020;border:2px solid #3a1166;border-radius:6px;font-family:Arial,sans-serif;color:#e0e0ff">',
    '<div style="background:#140030;padding:28px 24px;text-align:center;border-bottom:1px solid #3a1166">',
    '<div style="font-family:Impact,sans-serif;font-size:2em;letter-spacing:6px;color:#cc55bb">OURSPACE</div>',
    '<div style="color:#9977cc;font-size:11px;margin-top:6px">notre espace. notre paix.</div>',
    '</div>',
    '<div style="padding:28px">',
    '<p style="font-size:24px;text-align:center">🐻</p>',
    '<p>Salut <strong style="color:#cc55bb">' + displayName + '</strong> !</p>',
    '<p>Bienvenue sur OURSPACE — le réseau social rétro pour les vrais.</p>',
    '<p>Ton compte <strong style="color:#9977cc">@' + username + '</strong> est prêt.</p>',
    '<a href="https://www.ourspace.cool" style="display:block;width:fit-content;margin:20px auto;background:#3a1166;color:#cc55bb;text-decoration:none;padding:10px 28px;border:1px solid #cc55bb;border-radius:3px">Accéder à OURSPACE</a>',
    '<p style="color:#9977cc;font-size:12px;text-align:center">Fait avec amour et Comic Sans,<br><strong>Poppy Fusée</strong></p>',
    '</div>',
    '<div style="text-align:center;padding:14px;color:#444466;font-size:11px;border-top:1px solid #1a0044">',
    'OURSPACE 2026 — Les ours ne font pas la guerre.',
    '</div></div></body></html>'
  ].join('');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'OURSPACE <noreply@ourspace.cool>', to, subject: 'Bienvenue sur OURSPACE !', html }),
    });
    const json = await res.json();
    if (!res.ok) console.warn('Resend error:', JSON.stringify(json));
  } catch (e) {
    console.warn('Email non envoyé :', e.message);
  }
}

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
    await new Promise((resolve, reject) =>
      req.session.save(err => err ? reject(err) : resolve())
    );

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

    // Email de bienvenue (non-bloquant, jamais fatal)
    setImmediate(() => {
      sendWelcomeEmail(email.toLowerCase().trim(), r.rows[0].display_name, r.rows[0].username)
        .catch(e => console.warn('sendWelcomeEmail crash:', e.message));
    });

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
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Erreur session' });
      res.json({ ok: true, user: safe });
    });
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
      `SELECT id, username, email, display_name, bio, location, mood,
              song_title, song_artist, avatar_data, avatar_url, audio_data, audio_url, audio_name, skin, interests, marquee_text, custom_css, earned_badges, created_at, last_seen
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

// PUT /api/auth/username — changer le pseudo
router.put('/username', requireAuth, async (req, res) => {
  let { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Pseudo et mot de passe requis' });

  username = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (username.length < 3)
    return res.status(400).json({ error: 'Pseudo trop court (min 3 caractères, lettres/chiffres/_ uniquement)' });

  try {
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    if (!r.rows[0] || !(await bcrypt.compare(password, r.rows[0].password_hash)))
      return res.status(401).json({ error: 'Mot de passe incorrect' });

    await pool.query('UPDATE users SET username = $1 WHERE id = $2', [username, req.session.userId]);
    res.json({ ok: true, username });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Ce pseudo est déjà pris' });
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/auth/password — changer le mot de passe
router.put('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'Nouveau mot de passe trop court (min 6 caractères)' });

  try {
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    if (!r.rows[0] || !(await bcrypt.compare(current_password, r.rows[0].password_hash)))
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.session.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/auth/email — changer l'adresse email
router.put('/email', requireAuth, async (req, res) => {
  const { password, new_email } = req.body;
  if (!password || !new_email)
    return res.status(400).json({ error: 'Mot de passe et nouvel email requis' });

  try {
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    if (!r.rows[0] || !(await bcrypt.compare(password, r.rows[0].password_hash)))
      return res.status(401).json({ error: 'Mot de passe incorrect' });

    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [new_email.toLowerCase().trim(), req.session.userId]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Email déjà utilisé' });
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/auth/account — supprimer son compte
router.delete('/account', requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password)
    return res.status(400).json({ error: 'Mot de passe requis pour confirmer' });

  try {
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    if (!r.rows[0] || !(await bcrypt.compare(password, r.rows[0].password_hash)))
      return res.status(401).json({ error: 'Mot de passe incorrect' });

    await pool.query('DELETE FROM users WHERE id = $1', [req.session.userId]);
    req.session.destroy();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
