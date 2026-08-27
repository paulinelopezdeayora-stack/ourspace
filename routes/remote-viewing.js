const router      = require('express').Router();
const { pool }    = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { awardBadge } = require('../lib/badges');
const { TARGET_POOL } = require('../lib/rv-targets');

function randomDesignator() {
  const a = Math.floor(1000 + Math.random() * 9000);
  const b = Math.floor(1000 + Math.random() * 9000);
  return `${a}-${b}`;
}

function findTarget(key) {
  return TARGET_POOL.find(t => t.key === key) || null;
}

// POST /api/remote-viewing/sessions — démarre une nouvelle session (cible tirée au sort côté serveur)
router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const target = TARGET_POOL[Math.floor(Math.random() * TARGET_POOL.length)];
    const designator = randomDesignator();
    const r = await pool.query(
      `INSERT INTO rv_sessions (user_id, designator, target_key)
       VALUES ($1, $2, $3) RETURNING id, designator, status, created_at`,
      [req.session.userId, designator, target.key]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/remote-viewing/sessions/:id — sauvegarde les impressions (avant révélation)
router.patch('/sessions/:id', requireAuth, async (req, res) => {
  const { impressions, descriptor_tags, sketch_data } = req.body;
  try {
    const s = await pool.query(
      'SELECT status FROM rv_sessions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.userId]
    );
    if (!s.rows[0]) return res.status(404).json({ error: 'Session introuvable' });
    if (s.rows[0].status !== 'in_progress') return res.status(403).json({ error: 'Session déjà révélée' });
    await pool.query(
      `UPDATE rv_sessions SET impressions = $1, descriptor_tags = $2, sketch_data = $3
       WHERE id = $4 AND user_id = $5`,
      [impressions || '', JSON.stringify(descriptor_tags || []), sketch_data || null, req.params.id, req.session.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/remote-viewing/sessions/:id/reveal — révèle la cible et calcule le score de recoupement
router.post('/sessions/:id/reveal', requireAuth, async (req, res) => {
  try {
    const s = await pool.query(
      'SELECT * FROM rv_sessions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.userId]
    );
    const session = s.rows[0];
    if (!session) return res.status(404).json({ error: 'Session introuvable' });
    const target = findTarget(session.target_key);
    if (!target) return res.status(500).json({ error: 'Cible introuvable' });

    if (session.status !== 'in_progress') {
      return res.json({ target, overlap_score: session.overlap_score, status: session.status });
    }

    const userTags = JSON.parse(session.descriptor_tags || '[]');
    const overlap = userTags.filter(t => target.tags.includes(t)).length;
    await pool.query(
      `UPDATE rv_sessions SET status = 'revealed', overlap_score = $1, revealed_at = NOW() WHERE id = $2`,
      [overlap, req.params.id]
    );
    await awardBadge(req.session.userId, 'seer');
    res.json({ target, overlap_score: overlap, status: 'revealed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/remote-viewing/sessions/:id/score — note perso + réflexion (après révélation)
router.patch('/sessions/:id/score', requireAuth, async (req, res) => {
  const self_score = Number(req.body.self_score);
  const reflection = req.body.reflection || '';
  if (!Number.isInteger(self_score) || self_score < 0 || self_score > 5) {
    return res.status(400).json({ error: 'Note invalide (0-5)' });
  }
  try {
    const r = await pool.query(
      `UPDATE rv_sessions SET self_score = $1, reflection = $2, status = 'scored', scored_at = NOW()
       WHERE id = $3 AND user_id = $4 AND status = 'revealed' RETURNING id`,
      [self_score, reflection, req.params.id, req.session.userId]
    );
    if (!r.rows[0]) return res.status(403).json({ error: 'Session non révélée ou déjà notée' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/remote-viewing/sessions?page=0 — historique
router.get('/sessions', requireAuth, async (req, res) => {
  const page  = parseInt(req.query.page) || 0;
  const limit = 20;
  try {
    const r = await pool.query(
      `SELECT id, designator, target_key, status, descriptor_tags, overlap_score, self_score,
              reflection, sketch_data, impressions, created_at, revealed_at, scored_at
       FROM rv_sessions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.session.userId, limit, page * limit]
    );
    const rows = r.rows.map(row => ({
      ...row,
      target: row.status === 'in_progress' ? null : findTarget(row.target_key),
    }));
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/remote-viewing/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'scored')::int AS scored_total,
        COALESCE(AVG(self_score) FILTER (WHERE status = 'scored'), 0)::float AS avg_self_score,
        COALESCE(AVG(overlap_score) FILTER (WHERE status IN ('revealed','scored')), 0)::float AS avg_overlap
       FROM rv_sessions WHERE user_id = $1`,
      [req.session.userId]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/remote-viewing/sessions/:id
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM rv_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.session.userId]
    );
    if (!r.rows[0]) return res.status(403).json({ error: 'Interdit' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
