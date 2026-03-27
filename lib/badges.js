const { pool } = require('../db');

const BADGE_DEFS = {
  joined:       { icon: '🐻', label: 'Pionnier·e',    desc: 'A rejoint Ourspace' },
  first_post:   { icon: '✍️', label: 'Auteur·e',      desc: 'A publié son premier post' },
  first_friend: { icon: '🤝', label: 'Social·e',      desc: 'A ajouté son premier ami' },
  customized:   { icon: '🎨', label: 'Artiste',       desc: 'A personnalisé son profil' },
  music_lover:  { icon: '🎵', label: 'Mélomane',      desc: 'A ajouté une musique' },
};

async function awardBadge(userId, badgeKey) {
  try {
    const r = await pool.query('SELECT earned_badges FROM users WHERE id = $1', [userId]);
    if (!r.rows[0]) return;
    const badges = JSON.parse(r.rows[0].earned_badges || '[]');
    if (badges.includes(badgeKey)) return;
    badges.push(badgeKey);
    await pool.query('UPDATE users SET earned_badges = $1 WHERE id = $2', [JSON.stringify(badges), userId]);
  } catch (e) { /* non-bloquant */ }
}

module.exports = { BADGE_DEFS, awardBadge };
