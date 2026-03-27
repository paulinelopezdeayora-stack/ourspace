-- Ourspace — schéma PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  bio           TEXT         DEFAULT '',
  location      VARCHAR(100) DEFAULT '',
  mood          VARCHAR(255) DEFAULT '',
  song_title    VARCHAR(200) DEFAULT 'Welcome to the Black Parade',
  song_artist   VARCHAR(200) DEFAULT 'My Chemical Romance',
  avatar_data   TEXT,         -- base64 data URL (petit fichier ok pour un profil)
  skin          VARCHAR(50)  DEFAULT 'dark',
  created_at    TIMESTAMP    DEFAULT NOW(),
  last_seen     TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friends (
  id         SERIAL PRIMARY KEY,
  user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     VARCHAR(20)  DEFAULT 'pending',  -- pending | accepted
  position   INT,                              -- 1-8 : top 8, NULL sinon
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  profile_id INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id  INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
