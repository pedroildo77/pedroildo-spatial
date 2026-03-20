const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = path.join(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODELS_BUCKET = process.env.SUPABASE_MODELS_BUCKET || 'models';
const WORLDMAPS_BUCKET = process.env.SUPABASE_WORLDMAPS_BUCKET || 'worldmaps';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltam variáveis de ambiente do Supabase.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT_DIR));

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

/* =========================
   HTML
========================= */

app.get('/', (req, res) => {
  res.send('Pedroildo Spatial PRO backend running');
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

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'gallery.html'));
});

app.get('/project', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'project.html'));
});

app.get('/map', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'map.html'));
});

/* =========================
   HELPERS
========================= */

function safeParseJSON(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function makeStoragePath(folder, originalName = 'file.bin') {
  const now = Date.now();
  const rnd = Math.random().toString(36).slice(2, 10);
  const safeName = String(originalName || 'file')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return `${folder}/${now}_${rnd}_${safeName}`;
}

async function removeStorageFile(bucket, filePath) {
  if (!filePath) return;
  try {
    await supabase.storage.from(bucket).remove([filePath]);
  } catch (_) {}
}

function getPublicUrl(bucket, filePath) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

/* =========================
   PROJECTS
========================= */

app.post('/api/project', async (req, res) => {
  try {
    const {
      name,
      client,
      description,
      space_mode,
      location_name,
      latitude,
      longitude,
      altitude,
      heading,
      is_public
    } = req.body;

    const { data, error } = await supabase
      .from('projects')
      .insert([
        {
          name: name || '',
          client: client || '',
          description: description || '',
          space_mode: space_mode || 'virtual',
          location_name: location_name || '',
          latitude: latitude ?? 0,
          longitude: longitude ?? 0,
          altitude: altitude ?? 0,
          heading: heading ?? 0,
          is_public: is_public ?? true
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({ id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/project/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;

    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/project/:id', async (req, res) => {
  try {
    const {
      name,
      client,
      description,
      space_mode,
      location_name,
      latitude,
      longitude,
      altitude,
      heading,
      is_public
    } = req.body;

    const { data, error } = await supabase
      .from('projects')
      .update({
        name: name || '',
        client: client || '',
        description: description || '',
        space_mode: space_mode || 'virtual',
        location_name: location_name || '',
        latitude: latitude ?? 0,
        longitude: longitude ?? 0,
        altitude: altitude ?? 0,
        heading: heading ?? 0,
        is_public: is_public ?? true
      })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Projeto não encontrado' });

    res.json({ updated: true, id: Number(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/project/:id', async (req, res) => {
  try {
    const projectId = Number(req.params.id);

    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .eq('project_id', projectId);

    if (modelsError) throw modelsError;

    for (const model of models || []) {
      await removeStorageFile(MODELS_BUCKET, model.file_path);
    }

    const { data: anchors, error: anchorsError } = await supabase
      .from('anchors')
      .select('*')
      .eq('project_id', projectId);

    if (anchorsError) throw anchorsError;

    for (const anchor of anchors || []) {
      await removeStorageFile(WORLDMAPS_BUCKET, anchor.worldmap_path);
    }

    await supabase.from('placements').delete().eq('project_id', projectId);
    await supabase.from('anchors').delete().eq('project_id', projectId);
    await supabase.from('models').delete().eq('project_id', projectId);

    const { data, error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Projeto não encontrado' });

    res.json({ deleted: true, id: projectId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   MODELS
========================= */

app.post('/api/model', uploadMemory.single('model'), async (req, res) => {
  try {
    const file = req.file;
    const projectId = req.body.project;

    if (!projectId || !file) {
      return res.status(400).json({ error: 'Campos obrigatórios: project e model' });
    }

    const storagePath = makeStoragePath(`project_${projectId}`, file.originalname);

    const { error: uploadError } = await supabase.storage
      .from(MODELS_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const publicUrl = getPublicUrl(MODELS_BUCKET, storagePath);

    const { data, error } = await supabase
      .from('models')
      .insert([
        {
          project_id: Number(projectId),
          name: file.originalname || 'model',
          file_path: storagePath,
          public_url: publicUrl
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      id: data.id,
      filename: data.name,
      url: data.public_url
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/model/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    res.json({
      ...data,
      glb_path: data.file_path,
      url: data.public_url
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/project/:projectId/model', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('project_id', req.params.projectId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    res.json({
      ...data,
      glb_path: data.file_path,
      url: data.public_url
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/project/:projectId/models', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('project_id', req.params.projectId)
      .order('id', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map((row) => ({
      ...row,
      glb_path: row.file_path,
      url: row.public_url
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   PLACEMENTS
========================= */

app.post('/api/placement', async (req, res) => {
  try {
    const p = req.body;

    const { data, error } = await supabase
      .from('placements')
      .insert([
        {
          project_id: p.project_id ?? null,
          model_id: p.model_id ?? null,
          label: p.label ?? 'Placement',
          pos_x: p.pos_x ?? 0,
          pos_y: p.pos_y ?? 0,
          pos_z: p.pos_z ?? 0,
          rot_x: p.rot_x ?? 0,
          rot_y: p.rot_y ?? 0,
          rot_z: p.rot_z ?? 0,
          scale: p.scale ?? 1,
          latitude: p.latitude ?? 0,
          longitude: p.longitude ?? 0,
          altitude: p.altitude ?? 0
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({ id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/placement/:projectId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('placements')
      .select('*')
      .eq('project_id', req.params.projectId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/placements/:projectId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('placements')
      .select('*')
      .eq('project_id', req.params.projectId)
      .order('id', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/placement/item/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('placements')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;

    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/placement/item/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('placements')
      .delete()
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) throw error;

    res.json({ deleted: !!data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   WORLDMAPS
========================= */

app.post('/api/worldmap', uploadMemory.single('worldmap'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ficheiro worldmap obrigatório' });
    }

    const storagePath = makeStoragePath('worldmaps', req.file.originalname);

    const { error } = await supabase.storage
      .from(WORLDMAPS_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        upsert: true
      });

    if (error) throw error;

    const url = getPublicUrl(WORLDMAPS_BUCKET, storagePath);

    res.json({
      filename: req.file.originalname,
      stored: storagePath,
      url
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   ANCHORS
========================= */

app.post('/api/anchor', async (req, res) => {
  try {
    const a = req.body;

    const { data, error } = await supabase
      .from('anchors')
      .insert([
        {
          project_id: a.project_id ?? null,
          model_id: a.model_id ?? null,
          mode: a.mode ?? 'interior',
          label: a.label ?? 'Anchor',
          worldmap_path: a.worldmap_path ?? '',
          worldmap_url: a.worldmap_url ?? '',
          anchor_data: a.anchor_data ?? null
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({ id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anchors/:projectId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('anchors')
      .select('*')
      .eq('project_id', req.params.projectId)
      .order('id', { ascending: false });

    if (error) throw error;

    const parsed = (data || []).map((row) => ({
      ...row,
      anchor_data: typeof row.anchor_data === 'string' ? safeParseJSON(row.anchor_data) : row.anchor_data
    }));

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anchor/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('anchors')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    res.json({
      ...data,
      anchor_data: typeof data.anchor_data === 'string' ? safeParseJSON(data.anchor_data) : data.anchor_data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/project/:projectId/anchor/latest', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('anchors')
      .select('*')
      .eq('project_id', req.params.projectId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    res.json({
      ...data,
      anchor_data: typeof data.anchor_data === 'string' ? safeParseJSON(data.anchor_data) : data.anchor_data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/anchor/:id', async (req, res) => {
  try {
    const { data: existing, error: readError } = await supabase
      .from('anchors')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (readError) throw readError;
    if (!existing) return res.json({ deleted: false });

    if (existing.worldmap_path) {
      await removeStorageFile(WORLDMAPS_BUCKET, existing.worldmap_path);
    }

    const { data, error } = await supabase
      .from('anchors')
      .delete()
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) throw error;

    res.json({ deleted: !!data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(`Pedroildo Spatial PRO backend running on port ${PORT}`);
});
