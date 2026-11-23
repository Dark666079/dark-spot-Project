const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_USERS = 6;
const MAX_CALL_PARTICIPANTS = 6;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-this-secret-before-sharing";

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "dark-spot.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const sessionMiddleware = session({
  name: "darkspot.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(sessionMiddleware);
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(express.static(path.join(__dirname, "..", "client")));

io.engine.use(sessionMiddleware);
io.use((socket, next) => {
  if (socket.request.session?.user) return next();
  next(new Error("AUTH_REQUIRED"));
});

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  role: user.role
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "AUTH_REQUIRED" });
  next();
}

function requireOwner(req, res, next) {
  if (req.session.user?.role !== "owner") {
    return res.status(403).json({ error: "OWNER_ONLY" });
  }
  next();
}

app.get("/api/status", (_req, res) => {
  res.json({
    name: "Dark-Spot",
    status: "running",
    maxUsers: MAX_USERS,
    maxCallParticipants: MAX_CALL_PARTICIPANTS
  });
});

app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "USERNAME_RULES" });
  }
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: "PASSWORD_RULES" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = db.transaction(() => {
      const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
      if (count >= MAX_USERS) {
        const limitError = new Error("USER_LIMIT");
        limitError.code = "USER_LIMIT";
        throw limitError;
      }
      const role = count === 0 ? "owner" : "member";
      const result = db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
      ).run(username, passwordHash, role);
      return db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(result.lastInsertRowid);
    })();

    req.session.regenerate((sessionError) => {
      if (sessionError) return res.status(500).json({ error: "SESSION_ERROR" });
      req.session.user = publicUser(user);
      req.session.save((saveError) => {
        if (saveError) return res.status(500).json({ error: "SESSION_ERROR" });
        res.status(201).json({ user: publicUser(user) });
      });
    });
  } catch (error) {
    if (error.code === "USER_LIMIT") return res.status(403).json({ error: "USER_LIMIT" });
    if (String(error.code).startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ error: "USERNAME_TAKEN" });
    }
    console.error(error);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }

  req.session.regenerate((error) => {
    if (error) return res.status(500).json({ error: "SESSION_ERROR" });
    req.session.user = publicUser(user);
    res.json({ user: publicUser(user) });
  });
});

app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(req.session.user.id);
  if (!user) return res.status(401).json({ error: "AUTH_REQUIRED" });
  req.session.user = publicUser(user);
  res.json({ user: publicUser(user) });
});

app.get("/api/messages", requireAuth, (_req, res) => {
  const messages = db.prepare(
    "SELECT id, username, body, created_at AS createdAt FROM messages ORDER BY id DESC LIMIT 100"
  ).all().reverse();
  res.json({ messages });
});

app.get("/api/users", requireAuth, requireOwner, (_req, res) => {
  const users = db.prepare(
    "SELECT id, username, role, created_at AS createdAt FROM users ORDER BY id"
  ).all();
  res.json({ users });
});

app.patch("/api/users/:id/role", requireAuth, requireOwner, (req, res) => {
  const role = req.body.role;
  if (!["admin", "member"].includes(role)) {
    return res.status(400).json({ error: "INVALID_ROLE" });
  }
  const result = db.prepare("UPDATE users SET role = ? WHERE id = ? AND role != 'owner'")
    .run(role, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "USER_NOT_FOUND" });
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  const user = socket.request.session.user;
  socket.join("main-room");

  socket.on("chat:send", (rawBody) => {
    const body = String(rawBody || "").trim();
    if (!body || body.length > 2000) return;

    const result = db.prepare(
      "INSERT INTO messages (user_id, username, body) VALUES (?, ?, ?)"
    ).run(user.id, user.username, body);

    const message = db.prepare(
      "SELECT id, username, body, created_at AS createdAt FROM messages WHERE id = ?"
    ).get(result.lastInsertRowid);
    io.to("main-room").emit("chat:message", message);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Dark-Spot server listening on http://localhost:${PORT}`);
  console.log(`Account limit: ${MAX_USERS}; call participant limit: ${MAX_CALL_PARTICIPANTS}`);
  if (SESSION_SECRET.startsWith("dev-only")) {
    console.warn("WARNING: Set SESSION_SECRET before exposing this server to the internet.");
  }
});
