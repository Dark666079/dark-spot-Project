function requireAuth(req, res, next) {
  const sessionUser = req.session.user;
  if (!sessionUser) return res.status(401).json({ error: "AUTH_REQUIRED" });
  const user = req.app.locals.db.prepare("SELECT auth_version FROM users WHERE id = ?").get(sessionUser.id);
  if (!user || user.auth_version !== sessionUser.authVersion) {
    return req.session.destroy(() => res.status(401).json({ error: "AUTH_REQUIRED" }));
  }
  next();
}

function requireOwner(req, res, next) {
  if (req.session.user?.role !== "owner") {
    return res.status(403).json({ error: "OWNER_ONLY" });
  }
  next();
}

module.exports = { requireAuth, requireOwner };
