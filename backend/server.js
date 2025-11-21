const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Servir frontend desde la raíz del proyecto
const PUBLIC_DIR = path.resolve(__dirname, "..");
app.use(express.static(PUBLIC_DIR));
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/geocollab";
const pool = new Pool({ connectionString });

app.get("/anotaciones", async (req, res) => {
  try {
    const { view_type } = req.query;
    if (view_type) {
      const { rows } = await pool.query(
        "SELECT id, autor, texto, posicion, rotacion, view_type FROM anotaciones WHERE view_type = $1 ORDER BY id ASC",
        [view_type]
      );
      return res.json(rows);
    }
    const { rows } = await pool.query(
      "SELECT id, autor, texto, posicion, rotacion, view_type FROM anotaciones ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener anotaciones" });
  }
});

app.post("/anotaciones", async (req, res) => {
  try {
    const { id, autor, texto, posicion, rotacion, view_type } = req.body;
    if (!id || !autor || !texto || !posicion || !rotacion) {
      return res
        .status(400)
        .json({
          error: "Campos requeridos: id, autor, texto, posicion, rotacion",
        });
    }
    const posJson = JSON.stringify(posicion);
    const rotJson = JSON.stringify(rotacion);
    await pool.query(
      "INSERT INTO anotaciones (id, autor, texto, posicion, rotacion, view_type) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, COALESCE($6, '" +
        "bars" +
        "')) ON CONFLICT (id) DO NOTHING",
      [id, autor, texto, posJson, rotJson, view_type]
    );
    // Emitir evento de creación a clientes conectados
    try { io.emit('annotation:create', { id, autor, texto, posicion, rotacion, view_type }); } catch(e) {}
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar anotación" });
  }
});

// --- Socket.IO: sincronización de avatares simples ---
// Eventos: 'avatar:join', 'avatar:update', 'avatar:leave'
io.on("connection", (socket) => {
  const id = socket.id;
  socket.broadcast.emit("avatar:join", { id });

  socket.on("avatar:update", (payload) => {
    // payload: { id, pos:[x,y,z], rot:[x,y,z], name }
    socket.broadcast.emit("avatar:update", { ...payload, id });
  });

  socket.on("disconnect", () => {
    io.emit("avatar:leave", { id });
  });
});

server.listen(PORT, () => {
  console.log(`API+Sockets en http://localhost:${PORT}`);
});

// DELETE /anotaciones  -> borra todas o por view_type (?view_type=bars|terrain|points|surface)
app.delete("/anotaciones", async (req, res) => {
  try {
    const { view_type } = req.query;

    if (view_type) {
      const { rowCount } = await pool.query(
        "DELETE FROM anotaciones WHERE view_type = $1",
        [view_type]
      );
      try { io.emit('annotation:clear', { view_type }); } catch(e) {}
      return res.json({ ok: true, deleted: rowCount });
    } else {
      const { rowCount } = await pool.query("DELETE FROM anotaciones");
      try { io.emit('annotation:clear', { view_type: null }); } catch(e) {}
      return res.json({ ok: true, deleted: rowCount });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al borrar anotaciones" });
  }
});
