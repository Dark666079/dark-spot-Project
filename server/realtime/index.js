function registerRealtime({ io, db, sessionMiddleware }) {
  io.engine.use(sessionMiddleware);

  io.use((socket, next) => {
    if (socket.request.session?.user) return next();
    next(new Error("AUTH_REQUIRED"));
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
}

module.exports = { registerRealtime };
