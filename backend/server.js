const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const WORLDMAPS_DIR = path.join(ROOT_DIR, 'worldmaps');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(WORLDMAPS_DIR)) fs.mkdirSync(WORLDMAPS_DIR, { recursive: true });

// -----------------------------
// Middleware
// -----------------------------
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(ROOT_DIR));
app.use('/models', express.static(UPLOADS_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/worldmaps', express.static(WORLDMAPS_DIR));

// -----------------------------
// Upload configs
// -----------------------------
const modelUpload = multer({
  dest: UPLOADS_DIR
});

const worldmapUpload = multer({
  dest: WORLDMAPS_DIR
});

// -----------------------------
// Rotas HTML
// -----------------------------
app.get('/', (req, res) => {
  res.send('Pedroildo Spatial backend running');
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'viewer.html'));
});

app.get('/installer', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'installer.html'));
});

app.get('/client', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'client.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

// -----------------------------
// PROJETOS
// -----------------------------
app.post('/api/project', (req, res) => {
  const { name, client, description } = req.body;

  db.run(
    `INSERT INTO projects(name, client, description, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [name || '', client || '', description || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.get('/api/projects', (req, res) => {
  db.all(
    `SELECT * FROM projects ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.get('/api/project/:id', (req, res) => {
  db.get(
    `SELECT * FROM projects WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

// -----------------------------
// MODELOS
// -----------------------------
app.post('/api/model', modelUpload.single('model'), (req, res) => {
  const projectId = req.body.project;
  const originalName = req.file ? req.file.originalname : null;
  const storedPath = req.file ? req.file.filename : null;

  if (!projectId || !req.file) {
    return res.status(400).json({ error: 'Campos obrigatórios: project e model' });
  }

  db.run(
    `INSERT INTO models(project_id, name, glb_path, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [projectId, originalName, storedPath],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        id: this.lastID,
        filename: originalName,
        url: `/models/${storedPath}`
      });
    }
  );
});

app.get('/api/model/:id', (req, res) => {
  db.get(
    `SELECT * FROM models WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json(null);

      res.json({
        ...row,
        url: `/models/${row.glb_path}`
      });
    }
  );
});

app.get('/api/project/:projectId/model', (req, res) => {
  db.get(
    `SELECT * FROM models
     WHERE project_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [req.params.projectId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json(null);

      res.json({
        ...row,
        url: `/models/${row.glb_path}`
      });
    }
  );
});

app.get('/api/project/:projectId/models', (req, res) => {
  db.all(
    `SELECT * FROM models
     WHERE project_id = ?
     ORDER BY id DESC`,
    [req.params.projectId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const formatted = (rows || []).map((row) => ({
        ...row,
        url: `/models/${row.glb_path}`
      }));

      res.json(formatted);
    }
  );
});

// -----------------------------
// PLACEMENTS
// -----------------------------
app.post('/api/placement', (req, res) => {
  const p = req.body;

  db.run(
    `INSERT INTO placements(
      project_id,
      model_id,
      label,
      pos_x, pos_y, pos_z,
      rot_x, rot_y, rot_z,
      scale,
      latitude, longitude, altitude,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      p.project_id ?? null,
      p.model_id ?? null,
      p.label ?? 'Placement',
      p.pos_x ?? 0,
      p.pos_y ?? 0,
      p.pos_z ?? 0,
      p.rot_x ?? 0,
      p.rot_y ?? 0,
      p.rot_z ?? 0,
      p.scale ?? 1,
      p.latitude ?? 0,
      p.longitude ?? 0,
      p.altitude ?? 0
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.get('/api/placement/:projectId', (req, res) => {
  db.get(
    `SELECT * FROM placements
     WHERE project_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [req.params.projectId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

app.get('/api/placements/:projectId', (req, res) => {
  db.all(
    `SELECT * FROM placements
     WHERE project_id = ?
     ORDER BY id DESC`,
    [req.params.projectId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.get('/api/placement/item/:id', (req, res) => {
  db.get(
    `SELECT * FROM placements WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

app.delete('/api/placement/item/:id', (req, res) => {
  db.run(
    `DELETE FROM placements WHERE id = ?`,
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes > 0 });
    }
  );
});

// -----------------------------
// WORLDMAPS
// -----------------------------
app.post('/api/worldmap', worldmapUpload.single('worldmap'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Ficheiro worldmap obrigatório' });
  }

  res.json({
    filename: req.file.originalname,
    stored: req.file.filename,
    url: `/worldmaps/${req.file.filename}`
  });
});

app.get('/api/worldmap/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(WORLDMAPS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Worldmap não encontrado' });
  }

  res.sendFile(filePath);
});

// -----------------------------
// ANCHORS
// -----------------------------
app.post('/api/anchor', (req, res) => {
  const a = req.body;

  db.run(
    `INSERT INTO anchors(
      project_id,
      model_id,
      mode,
      label,
      worldmap_path,
      anchor_data,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      a.project_id ?? null,
      a.model_id ?? null,
      a.mode ?? 'interior',
      a.label ?? 'Anchor',
      a.worldmap_path ?? '',
      a.anchor_data ? JSON.stringify(a.anchor_data) : ''
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.get('/api/anchors/:projectId', (req, res) => {
  db.all(
    `SELECT * FROM anchors
     WHERE project_id = ?
     ORDER BY id DESC`,
    [req.params.projectId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const parsed = (rows || []).map((row) => ({
        ...row,
        anchor_data: safeParseJSON(row.anchor_data)
      }));

      res.json(parsed);
    }
  );
});

app.get('/api/anchor/:id', (req, res) => {
  db.get(
    `SELECT * FROM anchors WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json(null);

      res.json({
        ...row,
        anchor_data: safeParseJSON(row.anchor_data)
      });
    }
  );
});

app.get('/api/project/:projectId/anchor/latest', (req, res) => {
  db.get(
    `SELECT * FROM anchors
     WHERE project_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [req.params.projectId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json(null);

      res.json({
        ...row,
        anchor_data: safeParseJSON(row.anchor_data)
      });
    }
  );
});

app.delete('/api/anchor/:id', (req, res) => {
  db.get(
    `SELECT * FROM anchors WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!row) {
        return res.json({ deleted: false });
      }

      if (row.worldmap_path) {
        const filePath = path.join(WORLDMAPS_DIR, path.basename(row.worldmap_path));
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error('Erro ao apagar worldmap:', e.message);
          }
        }
      }

      db.run(
        `DELETE FROM anchors WHERE id = ?`,
        [req.params.id],
        function (deleteErr) {
          if (deleteErr) return res.status(500).json({ error: deleteErr.message });
          res.json({ deleted: this.changes > 0 });
        }
      );
    }
  );
});

// -----------------------------
// Helpers
// -----------------------------
function safeParseJSON(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// -----------------------------
// START
// -----------------------------
app.listen(PORT, () => {
  console.log(`Pedroildo Spatial backend running on http://localhost:${PORT}`);
});