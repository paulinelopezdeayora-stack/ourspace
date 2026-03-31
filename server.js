require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const PgSession  = require('connect-pg-simple')(session);
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
const { pool }   = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.set('trust proxy', 1); // Railway passe par un proxy HTTPS

app.use(express.json({ limit: '20mb' }));       // avatar + audio base64
app.use(express.urlencoded({ extended: true }));

// Sessions stockées en PostgreSQL
app.use(session({
  store: new PgSession({
    pool,
    createTableIfMissing: true,   // crée "session" automatiquement
  }),
  secret:            process.env.SESSION_SECRET || 'ourspace-dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge:   30 * 24 * 60 * 60 * 1000, // 30 jours
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// Fichiers statiques (frontend)
// Les .html ne sont jamais mis en cache (updates visibles immédiatement)
// Les .js/.css/.svg/.png peuvent être cachés 1h
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Routes API
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/friends',  require('./routes/friends'));
app.use('/api/discover', require('./routes/discover'));
app.use('/api/posts',    require('./routes/posts'));
app.use('/api/media',    require('./routes/media'));
app.use('/api/visits',   require('./routes/visits'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));

// Toutes les autres routes → frontend (SPA-style)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Crée les tables automatiquement au démarrage
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      bio TEXT DEFAULT '',
      location VARCHAR(100) DEFAULT '',
      mood VARCHAR(255) DEFAULT '',
      song_title VARCHAR(200) DEFAULT '',
      song_artist VARCHAR(200) DEFAULT '',
      avatar_data TEXT,
      audio_data  TEXT,
      audio_name  VARCHAR(255) DEFAULT '',
      skin        VARCHAR(50)  DEFAULT 'dark',
      created_at  TIMESTAMP    DEFAULT NOW(),
      last_seen   TIMESTAMP    DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS audio_data TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS audio_name VARCHAR(255) DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS interests  TEXT DEFAULT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS audio_url  VARCHAR(500) DEFAULT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS earned_badges TEXT DEFAULT '["joined"]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS marquee_text TEXT DEFAULT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_css   TEXT DEFAULT NULL;
    CREATE TABLE IF NOT EXISTS notifications (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       VARCHAR(30) NOT NULL,
      ref_id     INT DEFAULT NULL,
      read_at    TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      position INT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, friend_id)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      profile_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) DEFAULT '',
      body TEXT DEFAULT '',
      photo_data TEXT,
      comments_disabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS post_comments (
      id SERIAL PRIMARY KEY,
      post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id          SERIAL PRIMARY KEY,
      sender_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      read_at     TIMESTAMP DEFAULT NULL,
      created_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv
      ON messages (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
      ON messages (receiver_id, read_at) WHERE read_at IS NULL;
  `);

  // Suppression des comptes de démo
  await pool.query(`
    DELETE FROM users WHERE username IN ('xX_FoxyGrl_Xx', 'OursBrun42', 'MoonChild_')
  `);

  // Fix username owner : poppy_fuse → poppy_fusee
  await pool.query(`
    UPDATE users SET username = 'poppy_fusee' WHERE id = 1 AND username != 'poppy_fusee'
  `);

  // Renommer "Opinions" → "Mon rêve" dans les intérêts sauvegardés
  await pool.query(`
    UPDATE users SET interests = REPLACE(interests, '☮️ Opinions', '🌙 Mon rêve')
    WHERE interests LIKE '%Opinions%'
  `);

  // Sync display_name = username pour tous les comptes (on ne garde que le pseudo)
  await pool.query(`UPDATE users SET display_name = username WHERE display_name != username`);

  // Nettoyer les valeurs par défaut song qui polluent les profils vierges
  await pool.query(`UPDATE users SET song_title  = '' WHERE song_title  = 'Welcome to the Black Parade'`);
  await pool.query(`UPDATE users SET song_artist = '' WHERE song_artist = 'My Chemical Romance'`);

  // Compteur de visites
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_stats (
      key   VARCHAR(50) PRIMARY KEY,
      value BIGINT DEFAULT 0
    );
    INSERT INTO site_stats (key, value) VALUES ('total_visits', 0)
    ON CONFLICT (key) DO NOTHING;
  `);

  console.log('🐻 Base de données prête');
}

// ===== SOCKET.IO CHAT =====
const onlineUsers = new Map(); // socketId → { id, username, display_name, avatar_url }

io.use(async (socket, next) => {
  // Pas besoin d'auth pour rejoindre, mais on essaie de récupérer l'utilisateur
  next();
});

io.on('connection', (socket) => {
  // Authentification via userId envoyé par le client
  socket.on('auth', async ({ userId }) => {
    if (!userId) return;
    try {
      const r = await pool.query(
        'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
        [userId]
      );
      if (!r.rows[0]) return;
      const user = r.rows[0];
      onlineUsers.set(socket.id, user);
      io.emit('online_users', Array.from(onlineUsers.values()));

      // Envoie les 30 derniers messages
      const msgs = await pool.query(
        `SELECT m.id, m.text, m.created_at, u.username, u.display_name, u.avatar_url
         FROM chat_messages m JOIN users u ON u.id = m.user_id
         ORDER BY m.created_at DESC LIMIT 30`
      );
      socket.emit('chat_history', msgs.rows.reverse());
    } catch(e) { console.error('chat auth error:', e.message); }
  });

  socket.on('chat_message', async ({ text }) => {
    const user = onlineUsers.get(socket.id);
    if (!user || !text || !text.trim()) return;
    const clean = text.trim().slice(0, 300);
    try {
      const r = await pool.query(
        'INSERT INTO chat_messages (user_id, text) VALUES ($1, $2) RETURNING id, created_at',
        [user.id, clean]
      );
      io.emit('chat_message', {
        id: r.rows[0].id,
        text: clean,
        created_at: r.rows[0].created_at,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      });
    } catch(e) { console.error('chat_message error:', e.message); }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('online_users', Array.from(onlineUsers.values()));
  });
});

const PORT = process.env.PORT || 3000;
initDB()
  .then(() => server.listen(PORT, () => console.log(`🐻 Ourspace tourne sur http://localhost:${PORT}`)))
  .catch(err => { console.error('Erreur base de données:', err); process.exit(1); });
