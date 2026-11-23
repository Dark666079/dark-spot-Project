const path = require("node:path");
const crypto = require("node:crypto");
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
const OWNER_SETUP_TOKEN = process.env.OWNER_SETUP_TOKEN || "";

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DB_PATH || path.join(dataDir, "dark-spot.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
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
  CREATE TABLE IF NOT EXISTS account_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    change_type TEXT NOT NULL CHECK(change_type IN ('username','password')),
    proposed_username TEXT,
    proposed_password_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_pending_account_change_per_user
    ON account_change_requests(user_id) WHERE status = 'pending';
  CREATE UNIQUE INDEX IF NOT EXISTS one_pending_username_change
    ON account_change_requests(proposed_username COLLATE NOCASE)
    WHERE status = 'pending' AND change_type = 'username' AND proposed_username IS NOT NULL;
  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    used_by INTEGER REFERENCES users(id),
    revoked_at TEXT
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

const hashInvitation = (token) => crypto.createHash("sha256").update(token).digest("hex");
const nowIso = () => new Date().toISOString();

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
  const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  res.json({
    name: "Dark-Spot",
    status: "running",
    maxUsers: MAX_USERS,
    maxCallParticipants: MAX_CALL_PARTICIPANTS,
    needsOwnerSetup: count === 0,
    ownerSetupAvailable: Boolean(OWNER_SETUP_TOKEN)
  });
});

function validateCredentials(username, password, res) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    res.status(400).json({ error: "USERNAME_RULES" });
    return false;
  }
  if (password.length < 8 || password.length > 72) {
    res.status(400).json({ error: "PASSWORD_RULES" });
    return false;
  }
  return true;
}

function createSessionForUser(req, res, user, statusCode = 201) {
  req.session.regenerate((sessionError) => {
    if (sessionError) return res.status(500).json({ error: "SESSION_ERROR" });
    req.session.user = publicUser(user);
    req.session.save((saveError) => {
      if (saveError) return res.status(500).json({ error: "SESSION_ERROR" });
      res.status(statusCode).json({ user: publicUser(user) });
    });
  });
}

// The first owner is bootstrapped only with a local operator-provided secret.
app.post("/api/setup", async (req, res) => {
  if (!OWNER_SETUP_TOKEN) return res.status(503).json({ error: "OWNER_SETUP_DISABLED" });
  if (!crypto.timingSafeEqual(
    Buffer.from(String(req.body.setupToken || "")),
    Buffer.from(OWNER_SETUP_TOKEN)
  )) return res.status(403).json({ error: "INVALID_SETUP_TOKEN" });

  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!validateCredentials(username, password, res)) return;

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = db.transaction(() => {
      const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
      if (count !== 0) {
        const error = new Error("OWNER_ALREADY_EXISTS");
        error.code = "OWNER_ALREADY_EXISTS";
        throw error;
      }
      const result = db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'owner')"
      ).run(username, passwordHash);
      return db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(result.lastInsertRowid);
    }).immediate();
    createSessionForUser(req, res, user);
  } catch (error) {
    if (error.code === "OWNER_ALREADY_EXISTS") return res.status(409).json({ error: "OWNER_ALREADY_EXISTS" });
    if (String(error.code).startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "USERNAME_TAKEN" });
    console.error(error);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const invitationCode = String(req.body.invitationCode || "").trim();
  if (!validateCredentials(username, password, res)) return;
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(invitationCode)) {
    return res.status(403).json({ error: "INVITATION_INVALID" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = db.transaction(() => {
      const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
      if (count >= MAX_USERS) {
        const error = new Error("USER_LIMIT");
        error.code = "USER_LIMIT";
        throw error;
      }
      const nameTaken = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
      const nameReserved = db.prepare(
        "SELECT id FROM account_change_requests WHERE proposed_username = ? COLLATE NOCASE AND status = 'pending' AND change_type = 'username'"
      ).get(username);
      if (nameTaken || nameReserved) {
        const error = new Error("USERNAME_TAKEN");
        error.code = "USERNAME_TAKEN";
        throw error;
      }
      const now = nowIso();
      const invitation = db.prepare(
        "SELECT id FROM invitations WHERE token_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?"
      ).get(hashInvitation(invitationCode), now);
      if (!invitation) {
        const error = new Error("INVITATION_INVALID");
        error.code = "INVITATION_INVALID";
        throw error;
      }
      const result = db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'member')"
      ).run(username, passwordHash);
      const consumed = db.prepare(
        "UPDATE invitations SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL"
      ).run(now, result.lastInsertRowid, invitation.id);
      if (consumed.changes !== 1) {
        const error = new Error("INVITATION_INVALID");
        error.code = "INVITATION_INVALID";
        throw error;
      }
      return db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(result.lastInsertRowid);
    }).immediate();

    createSessionForUser(req, res, user);
  } catch (error) {
    if (error.code === "USER_LIMIT") return res.status(403).json({ error: "USER_LIMIT" });
    if (error.code === "INVITATION_INVALID") return res.status(403).json({ error: "INVITATION_INVALID" });
    if (error.code === "USERNAME_TAKEN" || String(error.code).startsWith("SQLITE_CONSTRAINT")) {
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


app.post("/api/account-change-requests", requireAuth, async (req, res) => {
  const type = req.body.type;
  const currentPassword = String(req.body.currentPassword || "");
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.user.id);
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(401).json({ error: "CURRENT_PASSWORD_INVALID" });
  let proposedUsername = null, proposedPasswordHash = null;
  if (type === "username") {
    proposedUsername = String(req.body.newUsername || "").trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(proposedUsername)) return res.status(400).json({ error: "USERNAME_RULES" });
    if (proposedUsername.toLowerCase() === user.username.toLowerCase()) return res.status(400).json({ error: "SAME_USERNAME" });
  } else if (type === "password") {
    const newPassword = String(req.body.newPassword || "");
    if (newPassword.length < 8 || newPassword.length > 72) return res.status(400).json({ error: "PASSWORD_RULES" });
    proposedPasswordHash = await bcrypt.hash(newPassword, 12);
  } else return res.status(400).json({ error: "INVALID_CHANGE_TYPE" });
  let result;
  try {
    result = db.transaction(() => {
      if (type === "username") {
        const taken = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(proposedUsername);
        if (taken) {
          const error = new Error("USERNAME_TAKEN");
          error.code = "USERNAME_TAKEN";
          throw error;
        }
      }
      return db.prepare("INSERT INTO account_change_requests (user_id, change_type, proposed_username, proposed_password_hash) VALUES (?, ?, ?, ?)")
        .run(user.id, type, proposedUsername, proposedPasswordHash);
    }).immediate();
  } catch (error) {
    if (error.code === "USERNAME_TAKEN" || String(error.code).startsWith("SQLITE_CONSTRAINT")) {
      if (String(error.message).includes("proposed_username") || error.code === "USERNAME_TAKEN") return res.status(409).json({ error: "USERNAME_TAKEN" });
      return res.status(409).json({ error: "REQUEST_ALREADY_PENDING" });
    }
    throw error;
  }
  const request = { id:Number(result.lastInsertRowid), userId:user.id, username:user.username, type, proposedUsername };
  io.to("owner-room").emit("account-change:request", request);
  res.status(201).json({ ok:true, requestId:request.id, status:"pending" });
});

app.get("/api/account-change-requests", requireAuth, requireOwner, (_req, res) => {
  const requests = db.prepare(`SELECT r.id, r.user_id AS userId, u.username, r.change_type AS type, r.proposed_username AS proposedUsername, r.created_at AS createdAt FROM account_change_requests r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' ORDER BY r.id`).all();
  res.json({ requests });
});

app.patch("/api/account-change-requests/:id", requireAuth, requireOwner, (req, res) => {
  const decision = req.body.decision;
  if (!["approve","reject"].includes(decision)) return res.status(400).json({ error:"INVALID_DECISION" });
  let request;
  try {
    request = db.transaction(() => {
      const pending = db.prepare("SELECT * FROM account_change_requests WHERE id = ? AND status = 'pending'").get(Number(req.params.id));
      if (!pending) return null;
      if (decision === "approve") {
        if (pending.change_type === "username") {
          db.prepare("UPDATE users SET username = ? WHERE id = ?").run(pending.proposed_username, pending.user_id);
        } else {
          db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(pending.proposed_password_hash, pending.user_id);
        }
      }
      const updated = db.prepare("UPDATE account_change_requests SET status = ?, proposed_password_hash = NULL WHERE id = ? AND status = 'pending'")
        .run(decision === "approve" ? "approved" : "rejected", pending.id);
      if (updated.changes !== 1) return null;
      return pending;
    })();
  } catch (error) {
    if (String(error.code).startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error:"USERNAME_TAKEN" });
    throw error;
  }
  if (!request) return res.status(404).json({ error:"REQUEST_NOT_FOUND" });
  io.to("user-" + request.user_id).emit("account-change:result", { requestId:request.id, decision, type:request.change_type });
  res.json({ ok:true });
});

app.post("/api/invitations", requireAuth, requireOwner, (_req, res) => {
  const now = nowIso();
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  const activeInvites = db.prepare(
    "SELECT COUNT(*) AS count FROM invitations WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > ?"
  ).get(now).count;
  if (userCount + activeInvites >= MAX_USERS) return res.status(409).json({ error: "INVITATION_CAPACITY_REACHED" });

  const code = crypto.randomBytes(32).toString("base64url");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000);
  const result = db.prepare(
    "INSERT INTO invitations (token_hash, created_by, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(hashInvitation(code), _req.session.user.id, createdAt.toISOString(), expiresAt.toISOString());
  res.status(201).json({
    invitation: {
      id: Number(result.lastInsertRowid),
      code,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    }
  });
});

app.get("/api/invitations", requireAuth, requireOwner, (_req, res) => {
  const now = nowIso();
  const invitations = db.prepare(
    "SELECT i.id, i.created_at AS createdAt, i.expires_at AS expiresAt, i.used_at AS usedAt, i.revoked_at AS revokedAt, u.username AS usedBy FROM invitations i LEFT JOIN users u ON u.id = i.used_by ORDER BY i.id DESC"
  ).all().map((item) => ({
    ...item,
    status: item.usedAt ? "used" : item.revokedAt ? "revoked" : item.expiresAt <= now ? "expired" : "active"
  }));
  res.json({ invitations });
});

app.delete("/api/invitations/:id", requireAuth, requireOwner, (req, res) => {
  const result = db.prepare(
    "UPDATE invitations SET revoked_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?"
  ).run(nowIso(), Number(req.params.id), nowIso());
  if (!result.changes) return res.status(404).json({ error: "INVITATION_NOT_ACTIVE" });
  res.json({ ok: true });
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
  if (user.role === "owner") socket.join("owner-room");
  socket.join("user-" + user.id);

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
  const address = server.address();
  const actualPort = address && typeof address === "object" ? address.port : PORT;
  console.log(`Dark-Spot server listening on http://localhost:${actualPort}`);
  console.log(`Account limit: ${MAX_USERS}; call participant limit: ${MAX_CALL_PARTICIPANTS}`);
  if (SESSION_SECRET.startsWith("dev-only")) {
    console.warn("WARNING: Set SESSION_SECRET before exposing this server to the internet.");
  }
});
