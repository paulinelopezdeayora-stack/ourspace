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

module.exports = router;
