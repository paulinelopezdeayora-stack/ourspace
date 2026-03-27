require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const PgSession  = require('connect-pg-simple')(session);
const path       = require('path');
const { pool }   = require('./db');

const app = express();

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
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/friends',  require('./routes/friends'));
app.use('/api/discover', require('./routes/discover'));
app.use('/api/posts',    require('./routes/posts'));
app.use('/api/media',    require('./routes/media'));
app.use('/api/visits',   require('./routes/visits'));

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
      song_title VARCHAR(200) DEFAULT 'Welcome to the Black Parade',
      song_artist VARCHAR(200) DEFAULT 'My Chemical Romance',
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
  `);

  // Seed demo users
  const bcrypt = require('bcryptjs');
  const demoHash = await bcrypt.hash('ourspace2026', 8);
  await pool.query(`
    INSERT INTO users (username, email, password_hash, display_name, bio, mood, skin, earned_badges)
    VALUES
      ('xX_FoxyGrl_Xx', 'foxy@ourspace.demo', $1, '🦊 FoxyGrl', 'Grande nostalgique des années 2000. J''ai encore mes vieilles .mp3 de Winamp. Je code des sites inutiles mais beaux.', 'melancholy vibes 🖤', 'emo-dark', '["joined","first_post","first_friend"]'),
      ('OursBrun42', 'ours@ourspace.demo', $1, 'OursBrun42', 'J''aime la randonnée et les vieux PC. Ma page perso c''est mon jardin numérique. 3h de marche sans réseau c''est obligatoire.', 'en forêt 🌲', 'matrix', '["joined","first_post"]'),
      ('MoonChild_', 'moon@ourspace.demo', $1, '🌙 MoonChild', 'La nuit c''est mieux. Je code des trucs inutiles mais beaux. Insomniaque professionnelle.', 'insomnique again ⭐', 'midnight', '["joined","music_lover"]')
    ON CONFLICT (username) DO NOTHING
  `, [demoHash]);

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

const PORT = process.env.PORT || 3000;
initDB()
  .then(() => app.listen(PORT, () => console.log(`🐻 Ourspace tourne sur http://localhost:${PORT}`)))
  .catch(err => { console.error('Erreur base de données:', err); process.exit(1); });
