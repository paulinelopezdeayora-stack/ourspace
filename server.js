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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🐻 Ourspace tourne sur http://localhost:${PORT}`);
});
