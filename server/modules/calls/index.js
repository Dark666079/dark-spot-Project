function createCallSignaling({ io, db, maxParticipants }) {
  const participants = new Map();

  function publicParticipant(entry) {
    return {
      userId: entry.userId,
      username: entry.username,
      role: entry.role,
      audioEnabled: entry.audioEnabled,
      videoEnabled: entry.videoEnabled,
      audioBlockedByHost: entry.audioBlockedByHost,
      videoBlockedByHost: entry.videoBlockedByHost
    };
  }

  function snapshot() {
    return [...participants.values()].map(publicParticipant);
  }

  function remove(socket) {
    const userId = socket.data.callUserId;
    if (!userId) return;
    const participant = participants.get(userId);
    if (participant?.socketId === socket.id) {
      participants.delete(userId);
      socket.leave("call-room");
      io.to("call-room").emit("call:participant-left", { userId });
      io.to("call-room").emit("call:participants", { participants: snapshot() });
    }
    delete socket.data.callUserId;
  }

  function attach(socket) {
    socket.on("call:join", () => {
      const sessionUser = socket.request.session?.user;
      if (!sessionUser) return socket.emit("call:error", { error: "AUTH_REQUIRED" });
      const current = db.prepare("SELECT id, username, role, auth_version FROM users WHERE id = ?").get(sessionUser.id);
      if (!current || current.auth_version !== sessionUser.authVersion) {
        socket.disconnect(true);
        return;
      }
      if (socket.data.callUserId) return socket.emit("call:joined", { participants: snapshot(), selfUserId: current.id });
      if (participants.has(current.id)) {
        return socket.emit("call:error", { error: "ALREADY_IN_CALL" });
      }
      if (participants.size >= maxParticipants) {
        return socket.emit("call:error", { error: "CALL_FULL" });
      }

      const participant = {
        userId: current.id,
        username: current.username,
        role: current.role,
        socketId: socket.id,
        audioEnabled: false,
        videoEnabled: false,
        audioBlockedByHost: false,
        videoBlockedByHost: false
      };
      participants.set(current.id, participant);
      socket.data.callUserId = current.id;
      socket.join("call-room");
      socket.emit("call:joined", { participants: snapshot(), selfUserId: current.id });
      socket.to("call-room").emit("call:participant-joined", { participant: publicParticipant(participant) });
    });

    socket.on("call:leave", () => remove(socket));

    socket.on("call:media-state", (state = {}) => {
      const userId = socket.data.callUserId;
      const participant = participants.get(userId);
      if (!participant || participant.socketId !== socket.id) return;
      participant.audioEnabled = !participant.audioBlockedByHost && state.audioEnabled === true;
      participant.videoEnabled = !participant.videoBlockedByHost && state.videoEnabled === true;
      io.to("call-room").emit("call:media-state", { userId, audioEnabled: participant.audioEnabled, videoEnabled: participant.videoEnabled, audioBlockedByHost: participant.audioBlockedByHost, videoBlockedByHost: participant.videoBlockedByHost });
    });

    socket.on("call:moderate-media", (payload = {}) => {
      const ownerSession = socket.request.session?.user;
      if (!ownerSession || !socket.data.callUserId) return;
      const owner = db.prepare("SELECT role, auth_version FROM users WHERE id = ?").get(ownerSession.id);
      if (!owner || owner.role !== "owner" || owner.auth_version !== ownerSession.authVersion) {
        socket.emit("call:error", { error: "OWNER_REQUIRED" });
        return;
      }
      const targetUserId = Number(payload.targetUserId);
      const kind = payload.kind;
      if (!Number.isSafeInteger(targetUserId) || !["audio", "video"].includes(kind) || typeof payload.blocked !== "boolean") return;
      const target = participants.get(targetUserId);
      if (!target || targetUserId === ownerSession.id) return;
      const field = kind === "audio" ? "audioBlockedByHost" : "videoBlockedByHost";
      const enabledField = kind === "audio" ? "audioEnabled" : "videoEnabled";
      target[field] = payload.blocked;
      if (payload.blocked) target[enabledField] = false;
      io.to(target.socketId).emit("call:moderation", { kind, blocked: payload.blocked });
      io.to("call-room").emit("call:media-state", {
        userId: targetUserId,
        audioEnabled: target.audioEnabled,
        videoEnabled: target.videoEnabled,
        audioBlockedByHost: target.audioBlockedByHost,
        videoBlockedByHost: target.videoBlockedByHost
      });
    });

    socket.on("call:signal", (payload = {}) => {
      const userId = socket.data.callUserId;
      const sender = participants.get(userId);
      const targetUserId = Number(payload.targetUserId);
      const target = participants.get(targetUserId);
      if (!sender || sender.socketId !== socket.id || !target || !payload.signal || typeof payload.signal !== "object") return;
      const serialized = JSON.stringify(payload.signal);
      if (serialized.length > 200000) return;
      io.to(target.socketId).emit("call:signal", {
        fromUserId: userId,
        signal: payload.signal
      });
    });

    socket.on("disconnect", () => remove(socket));
  }

  return { attach, snapshot };
}

module.exports = { createCallSignaling };
