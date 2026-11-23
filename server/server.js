const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { Server } = require("socket.io");

const {
  PORT,
  HOST,
  MAX_USERS,
  MAX_CALL_PARTICIPANTS,
  SESSION_SECRET,
  OWNER_SETUP_TOKEN,
  CLIENT_DIR
} = require("./config");
const db = require("./db");
const { createInvitationRouter } = require("./modules/invitations");
const { requireAuth, requireOwner } = require("./middleware/auth");
const { registerRealtime } = require("./realtime");
const { SQLiteSessionStore } = require("./session-store");

const app = express();
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server);
app.locals.db = db;
const sessionMiddleware = session({
  name: "darkspot.sid",
  store: new SQLiteSessionStore(db),
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

registerRealtime({ io, db, sessionMiddleware });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(sessionMiddleware);
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(express.static(CLIENT_DIR));
app.use("/api", createInvitationRouter({ db, requireAuth, requireOwner, maxUsers: MAX_USERS }));

const hashInvitation = (token) => crypto.createHash("sha256").update(token).digest("hex");
const nowIso = () => new Date().toISOString();

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  role: user.role
});

const sessionUser = (user) => ({ ...publicUser(user), authVersion: user.auth_version ?? 0 });

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
    req.session.user = sessionUser(user);
    req.session.save((saveError) => {
      if (saveError) return res.status(500).json({ error: "SESSION_ERROR" });
      res.status(statusCode).json({ user: publicUser(user) });
    });
  });
}

// The first owner is bootstrapped only with a local operator-provided secret.
app.post("/api/setup", async (req, res) => {
  if (OWNER_SETUP_TOKEN.length < 32) return res.status(503).json({ error: "OWNER_SETUP_DISABLED" });
  const suppliedSetupToken = Buffer.from(String(req.body.setupToken || ""));
  const expectedSetupToken = Buffer.from(OWNER_SETUP_TOKEN);
  if (suppliedSetupToken.length !== expectedSetupToken.length || !crypto.timingSafeEqual(suppliedSetupToken, expectedSetupToken)) {
    return res.status(403).json({ error: "INVALID_SETUP_TOKEN" });
  }

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
      return db.prepare("SELECT id, username, role, auth_version FROM users WHERE id = ?").get(result.lastInsertRowid);
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
    req.session.user = sessionUser(user);
    req.session.save((saveError) => {
      if (saveError) return res.status(500).json({ error: "SESSION_ERROR" });
      res.json({ user: publicUser(user) });
    });
  });
});

app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, username, role, auth_version FROM users WHERE id = ?").get(req.session.user.id);
  if (!user) return res.status(401).json({ error: "AUTH_REQUIRED" });
  req.session.user = sessionUser(user);
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
          db.prepare("UPDATE users SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?").run(pending.proposed_password_hash, pending.user_id);
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
  if (decision === "approve" && request.change_type === "password") {
    io.in("user-" + request.user_id).disconnectSockets(true);
  }
  io.to("user-" + request.user_id).emit("account-change:result", { requestId:request.id, decision, type:request.change_type });
  res.json({ ok:true });
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

server.listen(PORT, HOST, () => {
  const address = server.address();
  const actualPort = address && typeof address === "object" ? address.port : PORT;
  console.log(`Dark-Spot server listening on http://localhost:${actualPort}`);
  console.log(`Account limit: ${MAX_USERS}; call participant limit: ${MAX_CALL_PARTICIPANTS}`);
});
