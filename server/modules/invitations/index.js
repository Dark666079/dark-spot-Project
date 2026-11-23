const express = require("express");
const crypto = require("node:crypto");

function createInvitationRouter({ db, requireAuth, requireOwner, maxUsers }) {
  const router = express.Router();
  const hashInvitation = (token) => crypto.createHash("sha256").update(token).digest("hex");
  const nowIso = () => new Date().toISOString();

  router.post("/invitations", requireAuth, requireOwner, (_req, res) => {
    const code = crypto.randomBytes(32).toString("base64url");
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000);
    let invitationId;
    try {
      invitationId = db.transaction(() => {
        const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
        const activeInvites = db.prepare(
          "SELECT COUNT(*) AS count FROM invitations WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > ?"
        ).get(createdAt.toISOString()).count;
        if (userCount + activeInvites >= maxUsers) {
          const error = new Error("INVITATION_CAPACITY_REACHED");
          error.code = "INVITATION_CAPACITY_REACHED";
          throw error;
        }
        const result = db.prepare(
          "INSERT INTO invitations (token_hash, created_by, created_at, expires_at) VALUES (?, ?, ?, ?)"
        ).run(hashInvitation(code), _req.session.user.id, createdAt.toISOString(), expiresAt.toISOString());
        return Number(result.lastInsertRowid);
      }).immediate();
    } catch (error) {
      if (error.code === "INVITATION_CAPACITY_REACHED") return res.status(409).json({ error: "INVITATION_CAPACITY_REACHED" });
      throw error;
    }
    res.status(201).json({
      invitation: {
        id: invitationId,
        code,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      }
    });
  });

  router.get("/invitations", requireAuth, requireOwner, (_req, res) => {
    const now = nowIso();
    const invitations = db.prepare(
      "SELECT i.id, i.created_at AS createdAt, i.expires_at AS expiresAt, i.used_at AS usedAt, i.revoked_at AS revokedAt, u.username AS usedBy FROM invitations i LEFT JOIN users u ON u.id = i.used_by ORDER BY i.id DESC"
    ).all().map((item) => ({
      ...item,
      status: item.usedAt ? "used" : item.revokedAt ? "revoked" : item.expiresAt <= now ? "expired" : "active"
    }));
    res.json({ invitations });
  });

  router.delete("/invitations/:id", requireAuth, requireOwner, (req, res) => {
    const now = nowIso();
    const result = db.prepare(
      "UPDATE invitations SET revoked_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?"
    ).run(now, Number(req.params.id), now);
    if (!result.changes) return res.status(404).json({ error: "INVITATION_NOT_ACTIVE" });
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createInvitationRouter };
