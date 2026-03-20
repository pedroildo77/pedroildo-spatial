const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'spatial.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir DB:', err.message);
  } else {
    console.log('DB ligado em:', dbPath);
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    client TEXT,
    description TEXT,
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT,
    glb_path TEXT,
    usdz_path TEXT,
    poster_path TEXT,
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS placements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    model_id INTEGER,
    label TEXT,
    pos_x REAL,
    pos_y REAL,
    pos_z REAL,
    rot_x REAL,
    rot_y REAL,
    rot_z REAL,
    scale REAL,
    latitude REAL,
    longitude REAL,
    altitude REAL,
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS anchors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    model_id INTEGER,
    mode TEXT,
    label TEXT,
    worldmap_path TEXT,
    anchor_data TEXT,
    created_at TEXT
  )`);

  db.run(`ALTER TABLE placements ADD COLUMN label TEXT`, () => {});
  db.run(`ALTER TABLE anchors ADD COLUMN mode TEXT`, () => {});
  db.run(`ALTER TABLE anchors ADD COLUMN label TEXT`, () => {});
  db.run(`ALTER TABLE anchors ADD COLUMN worldmap_path TEXT`, () => {});
  db.run(`ALTER TABLE anchors ADD COLUMN anchor_data TEXT`, () => {});
});

module.exports = db;