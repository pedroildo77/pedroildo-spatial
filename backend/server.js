import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 📁 Upload config
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==========================
// 📦 PROJECTS
// ==========================

// GET ALL PROJECTS
app.get("/api/projects", async (req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("id", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});

// GET ONE PROJECT
app.get("/api/project/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(500).json(error);
  res.json(data);
});

// CREATE PROJECT
app.post("/api/project", async (req, res) => {
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
    .from("projects")
    .insert([{
      name,
      client,
      description,
      space_mode: space_mode || "virtual",
      location_name: location_name || "",
      latitude: latitude || 0,
      longitude: longitude || 0,
      altitude: altitude || 0,
      heading: heading || 0,
      is_public: is_public ?? true
    }])
    .select();

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

// UPDATE PROJECT
app.put("/api/project/:id", async (req, res) => {
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
    .from("projects")
    .update({
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
    })
    .eq("id", req.params.id)
    .select();

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

// DELETE PROJECT
app.delete("/api/project/:id", async (req, res) => {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

// ==========================
// 📦 MODEL UPLOAD
// ==========================

app.post("/api/upload/:projectId", upload.single("file"), async (req, res) => {
  const file = req.file;
  const projectId = req.params.projectId;

  if (!file) return res.status(400).json({ error: "No file" });

  const fileName = `${Date.now()}_${file.originalname}`;
  const filePath = `project_${projectId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("models")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (uploadError) return res.status(500).json(uploadError);

  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/models/${filePath}`;

  const { data, error } = await supabase
    .from("models")
    .insert([{
      project_id: projectId,
      name: file.originalname,
      file_path: filePath,
      public_url: publicUrl,
      url: publicUrl
    }])
    .select();

  if (error) return res.status(500).json(error);

  res.json(data[0]);
});

// GET MODEL
app.get("/api/project/:id/model", async (req, res) => {
  const { data, error } = await supabase
    .from("models")
    .select("*")
    .eq("project_id", req.params.id)
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error) return res.json({});
  res.json(data);
});

// ==========================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
