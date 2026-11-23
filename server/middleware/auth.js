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

module.exports = { requireAuth, requireOwner };
