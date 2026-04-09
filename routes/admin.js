const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');

// Seul l'user #1 (propriétaire du site) peut accéder aux routes admin
function requireAdmin(req, res, next) {
  if (req.session.userId !== 1) return res.status(403).json({ error: 'Accès refusé' });
  next();
}

// GET /api/admin/emails — liste de tous les emails inscrits
router.get('/emails', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, display_name, email, created_at
       FROM users
       ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/stats — chiffres globaux
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [msgs, posts, cmts] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM messages'),
      pool.query('SELECT COUNT(*) FROM posts'),
      pool.query('SELECT COUNT(*) FROM comments'),
    ]);
    res.json({
      messages: parseInt(msgs.rows[0].count),
      posts:    parseInt(posts.rows[0].count),
      comments: parseInt(cmts.rows[0].count),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/reset-password — reset forcé d'un mot de passe utilisateur
router.post('/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { username, new_password } = req.body;
  if (!username || !new_password) return res.status(400).json({ error: 'username et new_password requis' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 car.)' });
  try {
    const hash = await bcrypt.hash(new_password, 12);
    const r = await pool.query('UPDATE users SET password_hash=$1 WHERE username=$2 RETURNING id,username', [hash, username.toLowerCase()]);
    if (!r.rowCount) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ ok: true, username: r.rows[0].username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/send-welcome-all — envoie un mail de bienvenue à tous les inscrits
router.post('/send-welcome-all', requireAuth, requireAdmin, async (req, res) => {
  const key = process.env.RESEND_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_KEY non défini' });

  const { rows } = await pool.query('SELECT username, email FROM users ORDER BY id ASC');
  res.json({ ok: true, total: rows.length, message: 'Envoi en cours en arrière-plan' });

  // Envoi en arrière-plan avec délai pour éviter le rate limiting
  (async () => {
    let sent = 0, failed = 0;
    for (const u of rows) {
      const html = [
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>',
        '<div style="max-width:520px;margin:30px auto;background:#0d0020;border:2px solid #3a1166;border-radius:6px;font-family:Arial,sans-serif;color:#e0e0ff">',
        '<div style="background:#140030;padding:28px 24px;text-align:center;border-bottom:1px solid #3a1166">',
        '<div style="font-family:Impact,sans-serif;font-size:2em;letter-spacing:6px;color:#cc55bb">OURSPACE</div>',
        '<div style="color:#9977cc;font-size:11px;margin-top:6px">notre espace. notre paix.</div>',
        '</div>',
        '<div style="padding:28px">',
        '<p style="font-size:24px;text-align:center">🐻</p>',
        '<p>Salut <strong style="color:#cc55bb">@' + u.username + '</strong> !</p>',
        '<p>Bienvenue sur OURSPACE — le réseau social rétro pour les vrais.</p>',
        '<p>On est super contents que tu sois là 🌸</p>',
        '<a href="https://www.ourspace.cool" style="display:block;width:fit-content;margin:20px auto;background:#3a1166;color:#cc55bb;text-decoration:none;padding:10px 28px;border:1px solid #cc55bb;border-radius:3px">Accéder à OURSPACE</a>',
        '<p style="color:#9977cc;font-size:12px;text-align:center">Fait avec amour et Comic Sans,<br><strong>Poppy Fusée</strong></p>',
        '</div>',
        '<div style="text-align:center;padding:14px;color:#444466;font-size:11px;border-top:1px solid #1a0044">OURSPACE 2026 — Les ours ne font pas la guerre.</div>',
        '</div></body></html>'
      ].join('');
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'OURSPACE <noreply@ourspace.cool>', to: u.email, subject: 'Bienvenue sur OURSPACE ! 🐻', html }),
        });
        if (r.ok) sent++; else failed++;
      } catch (_) { failed++; }
      // Pause 300ms entre chaque email
      await new Promise(r => setTimeout(r, 300));
    }
    console.log(`send-welcome-all terminé : ${sent} envoyés, ${failed} échecs`);
  })();
});

// POST /api/admin/test-email — envoie un email de test à l'admin (debug)
router.post('/test-email', requireAuth, requireAdmin, async (req, res) => {
  const key = process.env.RESEND_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_KEY non défini dans les variables d\'environnement Railway' });

  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Champ "to" requis' });

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'OURSPACE <noreply@ourspace.cool>',
        to,
        subject: 'Test email OURSPACE',
        html: '<p>🐻 Ceci est un email de test OURSPACE.</p>',
      }),
    });
    const json = await resp.json();
    if (!resp.ok) return res.status(500).json({ error: 'Resend a répondu avec une erreur', detail: json });
    res.json({ ok: true, resend_response: json });
  } catch (e) {
    res.status(500).json({ error: 'Fetch vers Resend a échoué', detail: e.message });
  }
});

module.exports = router;
