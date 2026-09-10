-- Schema for Cloudflare D1 Database

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  contact_info TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  week_id TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_scores_game ON game_scores(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_week ON game_scores(game_id, week_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_players_normalized ON players(normalized_name);
