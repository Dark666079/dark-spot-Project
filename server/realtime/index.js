const { createCallSignaling } = require("../modules/calls");

function registerRealtime({ io, db, sessionMiddleware, maxCallParticipants = 6 }) {
  const calls = createCallSignaling({ io, db, maxParticipants: maxCallParticipants });
  io.engine.use(sessionMiddleware);

  io.use((socket, next) => {
    const sessionUser = socket.request.session?.user;
    if (!sessionUser) return next(new Error("AUTH_REQUIRED"));
    const user = db.prepare("SELECT auth_version FROM users WHERE id = ?").get(sessionUser.id);
    if (!user || user.auth_version !== sessionUser.authVersion) return next(new Error("AUTH_REQUIRED"));
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.request.session.user;
    socket.join("main-room");
    if (user.role === "owner") socket.join("owner-room");
    socket.join("user-" + user.id);
    calls.attach(socket);

    let windowStartedAt = Date.now();
    let messageCount = 0;
    socket.on("chat:send", (rawBody) => {
      const now = Date.now();
      if (now - windowStartedAt >= 10000) {
        windowStartedAt = now;
        messageCount = 0;
      }
      messageCount += 1;
      if (messageCount > 8) {
        socket.emit("chat:error", { error: "RATE_LIMITED", retryAfterMs: Math.max(0, 10000 - (now - windowStartedAt)) });
        return;
      }

      const currentUser = db.prepare("SELECT username, auth_version FROM users WHERE id = ?").get(user.id);
      if (!currentUser || currentUser.auth_version !== user.authVersion) {
        socket.disconnect(true);
        return;
      }

      const body = String(rawBody || "").trim();
      if (!body || body.length > 2000) return;

      const result = db.prepare(
        "INSERT INTO messages (user_id, username, body) VALUES (?, ?, ?)"
      ).run(user.id, currentUser.username, body);

      const message = db.prepare(
        "SELECT id, username, body, created_at AS createdAt FROM messages WHERE id = ?"
      ).get(result.lastInsertRowid);
      io.to("main-room").emit("chat:message", message);
    });
  });
}

module.exports = { registerRealtime };
