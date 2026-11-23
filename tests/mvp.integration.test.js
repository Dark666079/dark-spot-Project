const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { io: createSocket } = require("socket.io-client");

async function getFreePort() {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Server did not start in time. Output: " + output)), 15000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/listening on http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on("data", onData);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Server exited before becoming ready. Code: " + code + ". Output: " + output));
    });
  });
}

test("MVP HTTP auth, owner permissions, and persistent realtime chat", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dark-spot-test-"));
  const port = await getFreePort();
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DB_PATH: path.join(tempDir, "test.sqlite"),
      SESSION_SECRET: "test-only-session-secret-with-enough-length",
      OWNER_SETUP_TOKEN: "test-owner-setup-token-very-long",
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let socket;
  let memberSocket;
  t.after(async () => {
    if (socket) socket.disconnect();
    if (memberSocket) memberSocket.disconnect();
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(resolve, 2000);
    });
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const actualPort = await waitForServer(child);
  const base = "http://127.0.0.1:" + actualPort;
  const request = (url, options = {}) => fetch(base + url, options);
  const cookieFrom = (response) => {
    const value = response.headers.get("set-cookie");
    assert.ok(value, "response should set a session cookie");
    return value.split(";")[0];
  };

  const statusResponse = await request("/api/status");
  assert.equal(statusResponse.status, 200);
  const status = await statusResponse.json();
  assert.equal(status.maxUsers, 6);
  assert.equal(status.maxCallParticipants, 6);

  const invalidSetup = await request("/api/setup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "wrong_owner", password: "owner-password-123", setupToken: "wrong" })
  });
  assert.equal(invalidSetup.status, 403);
  assert.equal((await invalidSetup.json()).error, "INVALID_SETUP_TOKEN");

  const ownerResponse = await request("/api/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "owner_test", password: "owner-password-123", setupToken: "test-owner-setup-token-very-long" })
  });
  assert.equal(ownerResponse.status, 201);
  const ownerCookie = cookieFrom(ownerResponse);
  const owner = (await ownerResponse.json()).user;
  assert.equal(owner.role, "owner");
  const secondOwnerSetup = await request("/api/setup", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "second_owner", password: "owner-password-123", setupToken: "test-owner-setup-token-very-long" })
  });
  assert.equal(secondOwnerSetup.status, 409);
  assert.equal((await secondOwnerSetup.json()).error, "OWNER_ALREADY_EXISTS");

  const meResponse = await request("/api/me", { headers: { cookie: ownerCookie } });
  assert.equal(meResponse.status, 200);
  assert.equal((await meResponse.json()).user.username, "owner_test");

  const openRegistration = await request("/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "blocked_user", password: "blocked-password-123" })
  });
  assert.equal(openRegistration.status, 403);
  assert.equal((await openRegistration.json()).error, "INVITATION_INVALID");

  const createInvitation = async () => {
    const response = await request("/api/invitations", {
      method: "POST", headers: { cookie: ownerCookie, "content-type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(response.status, 201);
    return (await response.json()).invitation;
  };
  const memberInvitation = await createInvitation();
  assert.equal(new Date(memberInvitation.expiresAt).getTime() - new Date(memberInvitation.createdAt).getTime(), 96 * 60 * 60 * 1000);
  const memberResponse = await request("/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "member_test", password: "member-password-123", invitationCode: memberInvitation.code })
  });
  assert.equal(memberResponse.status, 201);
  const memberCookie = cookieFrom(memberResponse);
  const member = (await memberResponse.json()).user;
  assert.equal(member.role, "member");

  const invitationReuse = await request("/api/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "reused_code_user", password: "member-password-123", invitationCode: memberInvitation.code })
  });
  assert.equal(invitationReuse.status, 403);
  assert.equal((await invitationReuse.json()).error, "INVITATION_INVALID");


  const badCurrentPassword = await request("/api/account-change-requests", {
    method: "POST",
    headers: { cookie: memberCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "username", currentPassword: "wrong-password", newUsername: "member_renamed" })
  });
  assert.equal(badCurrentPassword.status, 401);

  const duplicateNameInvitation = await createInvitation();
  const duplicateRegisteredUsername = await request("/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "OWNER_TEST", password: "another-password-123", invitationCode: duplicateNameInvitation.code })
  });
  assert.equal(duplicateRegisteredUsername.status, 409);
  assert.equal((await duplicateRegisteredUsername.json()).error, "USERNAME_TAKEN");

  const usernameChangeRequest = await request("/api/account-change-requests", {
    method: "POST",
    headers: { cookie: memberCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "username", currentPassword: "member-password-123", newUsername: "member_renamed" })
  });
  assert.equal(usernameChangeRequest.status, 201);
  const usernameRequestId = (await usernameChangeRequest.json()).requestId;
  const reservedNameInvitation = await createInvitation();
  const reservedNameRegistration = await request("/api/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "MEMBER_RENAMED", password: "another-password-123", invitationCode: reservedNameInvitation.code })
  });
  assert.equal(reservedNameRegistration.status, 409);
  assert.equal((await reservedNameRegistration.json()).error, "USERNAME_TAKEN");
  for (const invitation of [duplicateNameInvitation, reservedNameInvitation]) {
    const releaseInvitation = await request("/api/invitations/" + invitation.id, {
      method: "DELETE", headers: { cookie: ownerCookie }
    });
    assert.equal(releaseInvitation.status, 200);
  }
  const competingUsernameRequest = await request("/api/account-change-requests", {
    method: "POST",
    headers: { cookie: ownerCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "username", currentPassword: "owner-password-123", newUsername: "MEMBER_RENAMED" })
  });
  assert.equal(competingUsernameRequest.status, 409);
  assert.equal((await competingUsernameRequest.json()).error, "USERNAME_TAKEN");
  const duplicatePendingRequest = await request("/api/account-change-requests", {
    method: "POST",
    headers: { cookie: memberCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "password", currentPassword: "member-password-123", newPassword: "another-password-456" })
  });
  assert.equal(duplicatePendingRequest.status, 409);
  assert.equal((await duplicatePendingRequest.json()).error, "REQUEST_ALREADY_PENDING");
  const ownerPending = await request("/api/account-change-requests", { headers: { cookie: ownerCookie } });
  assert.equal(ownerPending.status, 200);
  const pendingList = (await ownerPending.json()).requests;
  assert.ok(pendingList.some((item) => item.id === usernameRequestId));
  assert.equal(JSON.stringify(pendingList).includes("proposed_password_hash"), false);
  const rejectUsername = await request("/api/account-change-requests/" + usernameRequestId, {
    method: "PATCH", headers: { cookie: ownerCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "reject" })
  });
  assert.equal(rejectUsername.status, 200);

  const passwordChangeRequest = await request("/api/account-change-requests", {
    method: "POST",
    headers: { cookie: memberCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "password", currentPassword: "member-password-123", newPassword: "member-password-456" })
  });
  assert.equal(passwordChangeRequest.status, 201);
  const passwordRequestId = (await passwordChangeRequest.json()).requestId;
  const approvePassword = await request("/api/account-change-requests/" + passwordRequestId, {
    method: "PATCH", headers: { cookie: ownerCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve" })
  });
  assert.equal(approvePassword.status, 200);
  const approvedPasswordRequest = await request("/api/account-change-requests", { headers: { cookie: ownerCookie } });
  assert.equal(JSON.stringify(await approvedPasswordRequest.json()).includes("member-password-456"), false);
  const newPasswordLogin = await request("/api/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "member_test", password: "member-password-456" })
  });
  assert.equal(newPasswordLogin.status, 200);
  const staleSessionResponse = await request("/api/me", { headers: { cookie: memberCookie } });
  assert.equal(staleSessionResponse.status, 401);
  const refreshedMemberCookie = cookieFrom(newPasswordLogin);

  const approvedUsernameRequest = await request("/api/account-change-requests", {
    method: "POST",
    headers: { cookie: refreshedMemberCookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "username", currentPassword: "member-password-456", newUsername: "member_renamed" })
  });
  assert.equal(approvedUsernameRequest.status, 201);
  const approvedUsernameId = (await approvedUsernameRequest.json()).requestId;
  const approveUsername = await request("/api/account-change-requests/" + approvedUsernameId, {
    method: "PATCH", headers: { cookie: ownerCookie, "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve" })
  });
  assert.equal(approveUsername.status, 200);
  const renamedMe = await request("/api/me", { headers: { cookie: refreshedMemberCookie } });
  assert.equal((await renamedMe.json()).user.username, "member_renamed");

  const revocableInvitation = await createInvitation();
  const revokeResponse = await request("/api/invitations/" + revocableInvitation.id, {
    method: "DELETE", headers: { cookie: ownerCookie }
  });
  assert.equal(revokeResponse.status, 200);
  const revokedUse = await request("/api/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "revoked_user", password: "member-password-123", invitationCode: revocableInvitation.code })
  });
  assert.equal(revokedUse.status, 403);

  for (let index = 3; index <= 6; index += 1) {
    const invitation = await createInvitation();
    const extraAccount = await request("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "member_" + index, password: "member-password-123", invitationCode: invitation.code })
    });
    assert.equal(extraAccount.status, 201);
  }
  const seventhAccount = await request("/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "seventh_user", password: "member-password-123" })
  });
  assert.equal(seventhAccount.status, 403);
  assert.equal((await seventhAccount.json()).error, "INVITATION_INVALID");

  const memberCannotCreateInvitation = await request("/api/invitations", {
    method: "POST", headers: { cookie: refreshedMemberCookie, "content-type": "application/json" }, body: JSON.stringify({})
  });
  assert.equal(memberCannotCreateInvitation.status, 403);


  const forbiddenPromotion = await request("/api/users/" + member.id + "/role", {
    method: "PATCH",
    headers: { cookie: refreshedMemberCookie, "content-type": "application/json" },
    body: JSON.stringify({ role: "admin" })
  });
  assert.equal(forbiddenPromotion.status, 403);

  const promotion = await request("/api/users/" + member.id + "/role", {
    method: "PATCH",
    headers: { cookie: ownerCookie, "content-type": "application/json" },
    body: JSON.stringify({ role: "admin" })
  });
  assert.equal(promotion.status, 200);

  const adminLogin = await request("/api/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "member_renamed", password: "member-password-456" })
  });
  assert.equal(adminLogin.status, 200);
  const adminCookie = cookieFrom(adminLogin);
  assert.equal((await adminLogin.json()).user.role, "admin");
  const adminInvitationAttempt = await request("/api/invitations", {
    method: "POST", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({})
  });
  assert.equal(adminInvitationAttempt.status, 403);

  const invitationListResponse = await request("/api/invitations", { headers: { cookie: ownerCookie } });
  assert.equal(invitationListResponse.status, 200);
  const invitationList = (await invitationListResponse.json()).invitations;
  assert.ok(invitationList.some((item) => item.id === memberInvitation.id && item.status === "used"));
  assert.equal(JSON.stringify(invitationList).includes(memberInvitation.code), false);

  const usersResponse = await request("/api/users", { headers: { cookie: ownerCookie } });
  assert.equal(usersResponse.status, 200);
  const users = (await usersResponse.json()).users;
  assert.equal(users.find((user) => user.id === member.id).role, "admin");

  const anonymousSocket = createSocket(base, { reconnection: false, timeout: 5000 });
  const anonymousError = await new Promise((resolve, reject) => {
    anonymousSocket.once("connect_error", resolve);
    anonymousSocket.once("connect", () => reject(new Error("Anonymous socket should not connect")));
  });
  assert.equal(anonymousError.message, "AUTH_REQUIRED");
  anonymousSocket.disconnect();

  socket = createSocket(base, {
    extraHeaders: { Cookie: ownerCookie },
    timeout: 5000,
    reconnection: false
  });
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  const ownerJoinedCall = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Owner did not join call")), 5000);
    socket.once("call:joined", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  socket.emit("call:join");
  const ownerCallState = await ownerJoinedCall;
  assert.equal(ownerCallState.participants.length, 1);
  assert.equal(ownerCallState.selfUserId, owner.id);

  memberSocket = createSocket(base, {
    extraHeaders: { Cookie: refreshedMemberCookie },
    timeout: 5000,
    reconnection: false
  });
  await new Promise((resolve, reject) => {
    memberSocket.once("connect", resolve);
    memberSocket.once("connect_error", reject);
  });
  const participantJoined = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Call participant join was not broadcast")), 5000);
    socket.once("call:participant-joined", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  const memberJoinedCall = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Member did not join call")), 5000);
    memberSocket.once("call:joined", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  memberSocket.emit("call:join");
  const joinedParticipant = await participantJoined;
  const memberCallState = await memberJoinedCall;
  assert.equal(joinedParticipant.participant.userId, member.id);
  assert.equal(memberCallState.participants.length, 2);

  const mediaState = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Call media state was not broadcast")), 5000);
    socket.once("call:media-state", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  memberSocket.emit("call:media-state", { audioEnabled: true, videoEnabled: false });
  const mediaUpdate = await mediaState;
  assert.equal(mediaUpdate.userId, member.id);
  assert.equal(mediaUpdate.audioEnabled, true);
  assert.equal(mediaUpdate.videoEnabled, false);

  const forcedMuteNotice = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Host mute command did not reach participant")), 5000);
    memberSocket.once("call:moderation", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  const forcedMuteState = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Host mute state was not broadcast")), 5000);
    socket.once("call:media-state", (payload) => { if (payload.userId === member.id) { clearTimeout(timer); resolve(payload); } });
  });
  socket.emit("call:moderate-media", { targetUserId: member.id, kind: "audio", blocked: true });
  const muteNotice = await forcedMuteNotice;
  const muteState = await forcedMuteState;
  assert.deepEqual(muteNotice, { kind: "audio", blocked: true });
  assert.equal(muteState.audioEnabled, false);
  assert.equal(muteState.audioBlockedByHost, true);

  const enforcedMuteState = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not enforce host mute")), 5000);
    socket.once("call:media-state", (payload) => { if (payload.userId === member.id) { clearTimeout(timer); resolve(payload); } });
  });
  memberSocket.emit("call:media-state", { audioEnabled: true, videoEnabled: false });
  const enforcedState = await enforcedMuteState;
  assert.equal(enforcedState.audioEnabled, false);
  assert.equal(enforcedState.audioBlockedByHost, true);

  const memberCannotModerate = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Non-owner moderation was not rejected")), 5000);
    memberSocket.once("call:error", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  memberSocket.emit("call:moderate-media", { targetUserId: owner.id, kind: "video", blocked: true });
  assert.equal((await memberCannotModerate).error, "OWNER_REQUIRED");

  const releaseNotice = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Host did not release microphone")), 5000);
    memberSocket.once("call:moderation", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  socket.emit("call:moderate-media", { targetUserId: member.id, kind: "audio", blocked: false });
  assert.deepEqual(await releaseNotice, { kind: "audio", blocked: false });

  const relayedSignal = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebRTC signaling message was not relayed")), 5000);
    socket.once("call:signal", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  memberSocket.emit("call:signal", { targetUserId: owner.id, signal: { description: { type: "offer", sdp: "test-sdp" } } });
  const signalPayload = await relayedSignal;
  assert.equal(signalPayload.fromUserId, member.id);
  assert.equal(signalPayload.signal.description.sdp, "test-sdp");
  memberSocket.emit("call:leave");
  socket.emit("call:leave");

  const incomingMessage = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for chat broadcast")), 5000);
    socket.once("chat:message", (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
  socket.emit("chat:send", "dark-spot integration test message");
  const received = await incomingMessage;
  assert.equal(received.body, "dark-spot integration test message");
  assert.equal(received.username, "owner_test");

  const messagesResponse = await request("/api/messages", { headers: { cookie: ownerCookie } });
  assert.equal(messagesResponse.status, 200);
  const messages = (await messagesResponse.json()).messages;
  assert.ok(messages.some((message) => message.body === "dark-spot integration test message"));

  const memberMessageReceived = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Member chat message was not broadcast")), 5000);
    socket.once("chat:message", (message) => { clearTimeout(timer); resolve(message); });
  });
  memberSocket.emit("chat:send", "message authored by member");
  const memberMessage = await memberMessageReceived;
  assert.equal(memberMessage.userId, member.id);

  const memberEditsOwnMessage = await request("/api/messages/" + memberMessage.id, {
    method: "PATCH", headers: { cookie: refreshedMemberCookie, "content-type": "application/json" },
    body: JSON.stringify({ body: "member edited their own message" })
  });
  assert.equal(memberEditsOwnMessage.status, 200);
  assert.equal((await memberEditsOwnMessage.json()).message.body, "member edited their own message");

  const ownerCannotEditMemberMessage = await request("/api/messages/" + memberMessage.id, {
    method: "PATCH", headers: { cookie: ownerCookie, "content-type": "application/json" },
    body: JSON.stringify({ body: "unauthorized edit" })
  });
  assert.equal(ownerCannotEditMemberMessage.status, 404);

  const memberCannotDeleteMessage = await request("/api/messages/" + memberMessage.id, {
    method: "DELETE", headers: { cookie: refreshedMemberCookie }
  });
  assert.equal(memberCannotDeleteMessage.status, 403);

  const deleteBroadcast = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Message deletion was not broadcast")), 5000);
    socket.once("chat:deleted", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  const adminDelete = await request("/api/messages/" + memberMessage.id, {
    method: "DELETE", headers: { cookie: adminCookie }
  });
  assert.equal(adminDelete.status, 200);
  assert.equal((await deleteBroadcast).id, memberMessage.id);

  const editBroadcast = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Message edit was not broadcast")), 5000);
    socket.once("chat:updated", (payload) => { clearTimeout(timer); resolve(payload); });
  });
  const ownerEdit = await request("/api/messages/" + received.id, {
    method: "PATCH", headers: { cookie: ownerCookie, "content-type": "application/json" },
    body: JSON.stringify({ body: "owner edited their own message" })
  });
  assert.equal(ownerEdit.status, 200);
  assert.equal((await editBroadcast).body, "owner edited their own message");

  const ownerDelete = await request("/api/messages/" + received.id, {
    method: "DELETE", headers: { cookie: ownerCookie }
  });
  assert.equal(ownerDelete.status, 200);

  const logout = await request("/api/logout", { method: "POST", headers: { cookie: ownerCookie } });
  assert.equal(logout.status, 200);
  const afterLogout = await request("/api/me", { headers: { cookie: ownerCookie } });
  assert.equal(afterLogout.status, 401);
});
