require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const PgSession  = require('connect-pg-simple')(session);
const path       = require('path');
const { pool }   = require('./db');

const app = express();

app.use(express.json({ limit: '5mb' }));        // avatar base64 peut peser ~500kb
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
      skin VARCHAR(50) DEFAULT 'dark',
      created_at TIMESTAMP DEFAULT NOW(),
      last_seen TIMESTAMP DEFAULT NOW()
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
  `);
  console.log('🐻 Base de données prête');
}

const PORT = process.env.PORT || 3000;
initDB()
  .then(() => app.listen(PORT, () => console.log(`🐻 Ourspace tourne sur http://localhost:${PORT}`)))
  .catch(err => { console.error('Erreur base de données:', err); process.exit(1); });
