const router      = require('express').Router();
const bcrypt      = require('bcryptjs');
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');
async function sendWelcomeEmail(to, displayName, username) {
  const key = process.env.RESEND_KEY;
  if (!key) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'OURSPACE <onboarding@resend.dev>',
        to,
        subject: '🐻 Bienvenue sur OURSPACE !',
        html: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  body{background:#000814;margin:0;padding:0;font-family:'Comic Sans MS',cursive}
  .wrap{max-width:520px;margin:30px auto;background:#0d0020;border:2px solid #3a1166;border-radius:6px;overflow:hidden}
  .hd{background:linear-gradient(180deg,#140030,#0d0020);padding:28px 24px;text-align:center;border-bottom:1px solid #3a1166}
  .title{font-family:Impact,sans-serif;font-size:2.4em;letter-spacing:6px;color:#cc55bb;text-shadow:0 0 8px #7744aa;margin:0}
  .tagline{color:#9977cc;font-size:11px;letter-spacing:2px;margin-top:6px}
  .body{padding:28px 28px 20px;color:#e0e0ff;font-size:14px;line-height:1.8}
  .name{color:#cc55bb;font-size:1.2em;font-weight:bold}
  .bear{font-size:2em;display:block;text-align:center;margin:14px 0}
  .btn{display:block;width:fit-content;margin:20px auto;background:linear-gradient(180deg,#3a1166,#1a0044);color:#cc55bb;text-decoration:none;padding:10px 28px;border:1px solid #cc55bb;border-radius:3px;font-family:'Comic Sans MS',cursive;font-size:13px;text-align:center}
  .footer{text-align:center;padding:14px;color:#444466;font-size:11px;border-top:1px solid #1a0044}
  .blink{animation:blink 1.4s step-end infinite}
  @keyframes blink{50%{opacity:0.3}}
  .stars{color:#9977cc;letter-spacing:3px}
</style>
</head>
<body>
<div class="wrap">
  <div class="hd">
    <div class="title">✦ OURSPACE ✦</div>
    <div class="tagline">notre espace. notre paix. ♥ old web revival 2026</div>
  </div>
  <div class="body">
    <span class="bear">🐻</span>
    <p>Salut <span class="name">${displayName}</span> !</p>
    <p>Bienvenue sur <strong style="color:#cc55bb">OURSPACE</strong> — Le réseau social des grands nostalgiques des internets du début. Ici pas d'IA, pas de faux comptes, quelques trolls car on les accueille aussi mais surtout de l'authenticité et des fautes de goûts. C'est un espace safe, modéré et adorable. Rencontrez-vous, échangez, faites communauté mes petits ours, c'est chez nous ici. 🕊️</p>
    <p>Ton compte <strong style="color:#9977cc">@${username}</strong> est prêt. Tu peux maintenant :</p>
    <ul style="color:#9977cc;padding-left:18px">
      <li>🎵 Mettre ta musique de profil</li>
      <li>📸 Uploader ta photo</li>
      <li>💬 Laisser des commentaires adorables sur les autres profils</li>
      <li>👥 Découvrir d'autres membres</li>
      <li>🎨 Choisir ton skin (Emo Dark, Bubblegum, Matrix…)</li>
    </ul>
    <a class="btn" href="https://ourspace-production-3dbb.up.railway.app">→ Accéder à mon profil</a>
    <p style="color:#9977cc;font-size:12px;text-align:center;margin-top:16px">Fait avec amour et Comic Sans,</p>
    <p style="color:#cc55bb;font-size:13px;font-weight:bold;text-align:center;margin-top:4px">Poppy Fusée</p>
    <p style="color:#444466;font-size:13px;text-align:center;letter-spacing:6px;margin-top:8px">★ ★ ★</p>
  </div>
  <div class="footer">
    OURSPACE 2026 — fait avec ♥ et Comic Sans<br>
    Les ours ne font pas la guerre.
  </div>
</div>
</body>
</html>`,
      }),
    });
  } catch (e) {
    console.warn('Email de bienvenue non envoyé :', e.message);
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

    // Email de bienvenue (non-bloquant)
    sendWelcomeEmail(email.toLowerCase().trim(), r.rows[0].display_name, r.rows[0].username);

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
