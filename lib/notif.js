const { pool } = require('../db');

// Crée une notification — silencieux si erreur, jamais pour soi-même
async function createNotif(userId, type, actorId, refId = null) {
  if (!userId || !actorId || userId === actorId) return;
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, actor_id, ref_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, type, actorId, refId]
    );
  } catch (e) {
    console.error('createNotif error:', e.message);
  }
}

module.exports = createNotif;
