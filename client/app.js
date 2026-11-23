const translations = {
  fa: {
    privateSpace:"PRIVATE SPACE",welcome:"به فضای خصوصی خودت خوش آمدی",authHint:"برای ورود یا ساخت حساب، اطلاعاتت را وارد کن.",
    invitationCode:"کد دعوت",setupToken:"کلید راه‌اندازی مالک",inviteHint:"برای ساخت حساب به دعوت‌نامه معتبر نیاز داری.",setupHint:"راه‌اندازی اولیه: کلید امن مالک را وارد کن.",invitationInvalid:"کد دعوت معتبر نیست، منقضی شده یا قبلاً استفاده شده است.",setupInvalid:"کلید راه‌اندازی مالک نادرست است.",ownerSetupDisabled:"راه‌اندازی مالک روی سرور فعال نشده است.",invitationManagement:"مدیریت دعوت‌نامه‌ها",createInvitation:"ساخت دعوت‌نامه",invitationCreated:"کد دعوت (فقط همین بار نمایش داده می‌شود):",copyCode:"کپی کد",invitationActive:"فعال",invitationUsed:"استفاده‌شده",invitationExpired:"منقضی‌شده",invitationRevoked:"باطل‌شده",revokeInvitation:"باطل‌کردن",invitationCapacity:"ظرفیت باقی‌مانده برای دعوت‌نامه کافی نیست.",
    username:"نام کاربری",password:"رمز عبور",login:"ورود",register:"ساخت حساب",firstAccount:"اولین حسابی که ساخته شود، مالک اصلی خواهد بود.",
    community:"PRIVATE COMMUNITY",mainRoom:"گفت‌وگوی اصلی",logout:"خروج",messagePlaceholder:"پیامت را بنویس...",send:"ارسال",
    mvpNotice:"پیام‌ها ذخیره می‌شوند و تماس گروهی در دسترس است.",callsTitle:"تماس گروهی",joinCall:"ورود به تماس",leaveCall:"خروج از تماس",micOn:"خاموش‌کردن میکروفون",micOff:"روشن‌کردن میکروفون",cameraOn:"خاموش‌کردن دوربین",cameraOff:"روشن‌کردن دوربین",callReady:"برای ورود به تماس گروهی دکمه شروع را بزن.",callConnected:"به تماس گروهی متصل شدی.",callFull:"ظرفیت تماس تکمیل است.",callAlready:"این حساب از قبل وارد تماس شده است.",callFailed:"اتصال تماس برقرار نشد.",mediaDenied:"دسترسی میکروفون یا دوربین داده نشد.",footer:"فضای خصوصی دوستان",
    invalid:"نام کاربری یا رمز عبور معتبر نیست.",taken:"این نام کاربری قبلاً استفاده شده است.",limit:"ظرفیت ساخت حساب تکمیل شده است.",
    passwordRules:"رمز عبور باید حداقل ۸ نویسه باشد.",accountSettings:"تغییر اطلاعات حساب",changeType:"نوع تغییر",changeUsername:"نام کاربری",changePassword:"رمز عبور",currentPassword:"رمز عبور فعلی",newUsername:"نام کاربری جدید",newPassword:"رمز عبور جدید",sendRequest:"ارسال درخواست به هاست",pendingRequests:"درخواست‌های در انتظار تأیید",requestSent:"درخواست ارسال شد؛ منتظر تأیید هاست بمان.",requestPending:"یک درخواست در انتظار بررسی داری.",currentPasswordInvalid:"رمز عبور فعلی درست نیست.",sameUsername:"نام کاربری جدید باید با نام فعلی متفاوت باشد.",requestResultApproved:"هاست درخواستت را تأیید کرد.",requestResultRejected:"هاست درخواستت را رد کرد.",approve:"تأیید",reject:"رد",network:"ارتباط با سرور برقرار نشد.",usernameRules:"نام کاربری باید ۳ تا ۲۰ حرف انگلیسی، عدد یا _ باشد."
  },
  en: {
    privateSpace:"PRIVATE SPACE",welcome:"Welcome to your private space",authHint:"Enter your details to sign in or create an account.",
    invitationCode:"Invitation code",setupToken:"Owner setup key",inviteHint:"A valid invitation is required to create an account.",setupHint:"Initial setup: enter the secure owner key.",invitationInvalid:"The invitation is invalid, expired, or already used.",setupInvalid:"The owner setup key is incorrect.",ownerSetupDisabled:"Owner setup is not enabled on the server.",invitationManagement:"Invitation management",createInvitation:"Create invitation",invitationCreated:"Invitation code (shown only once):",copyCode:"Copy code",invitationActive:"Active",invitationUsed:"Used",invitationExpired:"Expired",invitationRevoked:"Revoked",revokeInvitation:"Revoke",invitationCapacity:"There is not enough remaining account capacity for another invitation.",
    username:"Username",password:"Password",login:"Sign in",register:"Create account",firstAccount:"The first account created becomes the owner.",
    community:"PRIVATE COMMUNITY",mainRoom:"Main chat",logout:"Log out",messagePlaceholder:"Write a message...",send:"Send",
    mvpNotice:"Messages are saved and group calling is available.",callsTitle:"Group call",joinCall:"Join call",leaveCall:"Leave call",micOn:"Turn microphone off",micOff:"Turn microphone on",cameraOn:"Turn camera off",cameraOff:"Turn camera on",callReady:"Press Join to enter the group call.",callConnected:"You joined the group call.",callFull:"The call is full.",callAlready:"This account is already in the call.",callFailed:"The call could not connect.",mediaDenied:"Microphone or camera permission was denied.",footer:"A private space for friends",
    invalid:"Enter a valid username and password.",taken:"That username is already taken.",limit:"The account limit has been reached.",
    passwordRules:"Password must be at least 8 characters.",accountSettings:"Account settings",changeType:"Change type",changeUsername:"Username",changePassword:"Password",currentPassword:"Current password",newUsername:"New username",newPassword:"New password",sendRequest:"Send request to host",pendingRequests:"Pending approval requests",requestSent:"Request sent. Wait for the host's approval.",requestPending:"You already have a pending request.",currentPasswordInvalid:"Your current password is incorrect.",sameUsername:"Choose a username different from your current one.",requestResultApproved:"The host approved your request.",requestResultRejected:"The host rejected your request.",approve:"Approve",reject:"Reject",network:"Could not connect to the server.",usernameRules:"Username must be 3–20 characters: English letters, numbers or _."
  }
};
let language = "fa";
let currentUser = null;
let socket = null;
let ownerSetupMode = false;
let inCall = false;
let localStream = null;
let audioEnabled = false;
let videoEnabled = false;
const peerConnections = new Map();
const remoteTiles = new Map();
const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
const $ = (id) => document.getElementById(id);

function setLanguage(next) {
  language = next;
  document.documentElement.lang = next;
  document.documentElement.dir = next === "fa" ? "rtl" : "ltr";
  document.body.dir = document.documentElement.dir;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = translations[next][node.dataset.i18n];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = translations[next][node.dataset.i18nPlaceholder];
  });
  $("languageButton").textContent = next === "fa" ? "English" : "فارسی";
  if ($("registrationHint")) $("registrationHint").textContent = translations[next][ownerSetupMode ? "setupHint" : "inviteHint"];
}

function errorText(code) {
  const map = { INVALID_CREDENTIALS:"invalid", USERNAME_TAKEN:"taken", USER_LIMIT:"limit", PASSWORD_RULES:"passwordRules", USERNAME_RULES:"usernameRules", CURRENT_PASSWORD_INVALID:"currentPasswordInvalid", REQUEST_ALREADY_PENDING:"requestPending", SAME_USERNAME:"sameUsername", INVITATION_INVALID:"invitationInvalid", INVALID_SETUP_TOKEN:"setupInvalid", OWNER_SETUP_DISABLED:"ownerSetupDisabled", INVITATION_CAPACITY_REACHED:"invitationCapacity" };
  return translations[language][map[code] || "network"];
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type":"application/json", ...(options.headers || {}) },
    credentials: "same-origin"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "NETWORK");
  return data;
}

function showChat(user) {
  currentUser = user;
  $("authPanel").hidden = true;
  $("chatPanel").hidden = false;
  $("currentUser").textContent = user.username + " · " + user.role;
  $("ownerRequestsPanel").hidden = user.role !== "owner";
  $("ownerInvitationsPanel").hidden = user.role !== "owner";
  if (user.role === "owner") { loadOwnerRequests(); loadOwnerInvitations(); }
  loadMessages();
  connectSocket();
}

function addMessage(message) {
  const node = document.createElement("article");
  node.className = "message" + (currentUser && message.username === currentUser.username ? " mine" : "");
  const name = document.createElement("strong");
  name.textContent = message.username;
  const body = document.createElement("p");
  body.textContent = message.body;
  const time = document.createElement("time");
  const storedTimestamp = String(message.createdAt).replace(" ", "T");
  const isoTimestamp = storedTimestamp.endsWith("Z") ? storedTimestamp : storedTimestamp + "Z";
  time.textContent = new Date(isoTimestamp).toLocaleString(language === "fa" ? "fa-IR" : "en");
  node.append(name, body, time);
  $("messages").append(node);
  $("messages").scrollTop = $("messages").scrollHeight;
}

async function loadMessages() {
  try {
    const { messages } = await api("/api/messages");
    $("messages").replaceChildren();
    messages.forEach(addMessage);
  } catch (error) {
    console.error(error);
  }
}

function connectSocket() {
  if (socket) socket.disconnect();
  socket = io();
  socket.on("chat:message", addMessage);
  socket.on("call:joined", handleCallJoined);
  socket.on("call:participant-joined", ({ participant }) => {
    if (inCall && participant) ensurePeer(participant);
  });
  socket.on("call:participants", ({ participants }) => {
    if (inCall) participants.forEach((participant) => { if (participant.userId !== currentUser.id) ensurePeer(participant); });
  });
  socket.on("call:participant-left", ({ userId }) => closePeer(userId));
  socket.on("call:media-state", ({ userId, audioEnabled: audio, videoEnabled: video }) => {
    const tile = remoteTiles.get(userId);
    if (tile) tile.label.textContent = tile.username + (audio ? " · 🎙" : " · 🔇") + (video ? " · 📷" : " · ▫");
  });
  socket.on("call:signal", ({ fromUserId, signal }) => handleSignal(fromUserId, signal));
  socket.on("call:error", ({ error }) => {
    const key = error === "CALL_FULL" ? "callFull" : error === "ALREADY_IN_CALL" ? "callAlready" : "callFailed";
    $("callStatus").textContent = translations[language][key];
  });
  socket.on("account-change:request", loadOwnerRequests);
  socket.on("account-change:result", async (r) => {
    $("changeStatus").textContent = translations[language][r.decision === "approve" ? "requestResultApproved" : "requestResultRejected"];
    if (r.decision === "approve" && r.type === "username") {
      try {
        const { user } = await api("/api/me");
        currentUser = user;
        $("currentUser").textContent = user.username + " · " + user.role;
        if (socket) { socket.disconnect(); connectSocket(); }
      } catch (error) { console.error(error); }
    }
    $("currentPassword").value = "";
    $("newPassword").value = "";
    $("newUsername").value = "";
  });
  socket.on("connect_error", (error) => {
    if (error.message === "AUTH_REQUIRED") socket.disconnect();
  });
}

async function authenticate(mode) {
  $("authError").textContent = "";
  const username = $("username").value.trim();
  const password = $("password").value;
  try {
    const payload = { username, password };
    let endpoint = "/api/login";
    if (mode === "register") {
      if (ownerSetupMode) {
        endpoint = "/api/setup";
        payload.setupToken = $("setupToken").value;
      } else {
        endpoint = "/api/register";
        payload.invitationCode = $("invitationCode").value.trim();
      }
    }
    const data = await api(endpoint, { method:"POST", body:JSON.stringify(payload) });
    showChat(data.user);
  } catch (error) {
    $("authError").textContent = errorText(error.message);
  }
}

async function configureRegistration() {
  try {
    const status = await api("/api/status");
    ownerSetupMode = Boolean(status.needsOwnerSetup);
    $("setupField").hidden = !ownerSetupMode;
    $("invitationField").hidden = ownerSetupMode;
    $("registrationHint").textContent = translations[language][ownerSetupMode ? "setupHint" : "inviteHint"];
    $("registerButton").disabled = ownerSetupMode && !status.ownerSetupAvailable;
    if (ownerSetupMode && !status.ownerSetupAvailable) {
      $("authError").textContent = translations[language].ownerSetupDisabled;
    }
  } catch (error) {
    $("authError").textContent = errorText(error.message);
  }
}

$("authForm").addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate("login");
});
$("registerButton").addEventListener("click", () => authenticate("register"));
$("languageButton").addEventListener("click", () => setLanguage(language === "fa" ? "en" : "fa"));
$("logoutButton").addEventListener("click", async () => {
  try { await api("/api/logout", { method:"POST" }); } catch {}
  if (socket) socket.disconnect();
  currentUser = null;
  $("chatPanel").hidden = true;
  $("authPanel").hidden = false;
  $("password").value = "";
});

$("changeType").addEventListener("change", () => {
  const isUsername = $("changeType").value === "username";
  $("newUsername").disabled = !isUsername; $("newUsername").required = isUsername;
  $("newPassword").disabled = isUsername; $("newPassword").required = !isUsername;
});
$("changeType").dispatchEvent(new Event("change"));
$("accountChangeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = $("changeType").value;
  const payload = { type, currentPassword:$("currentPassword").value };
  if (type === "username") payload.newUsername = $("newUsername").value.trim();
  else payload.newPassword = $("newPassword").value;
  try {
    await api("/api/account-change-requests", { method:"POST", body:JSON.stringify(payload) });
    $("changeStatus").textContent = translations[language].requestSent;
    $("accountChangeForm").reset(); $("changeType").dispatchEvent(new Event("change"));
  } catch (error) {
    $("changeStatus").textContent = error.message === "REQUEST_ALREADY_PENDING" ? translations[language].requestPending : errorText(error.message);
  }
});
async function loadOwnerInvitations() {
  try {
    const { invitations } = await api("/api/invitations");
    const root = $("ownerInvitations");
    root.replaceChildren();
    invitations.forEach((invitation) => {
      const item = document.createElement("div");
      item.className = "request-item";
      const label = document.createElement("span");
      const statusKey = invitation.status === "active" ? "invitationActive" :
        invitation.status === "used" ? "invitationUsed" :
        invitation.status === "expired" ? "invitationExpired" : "invitationRevoked";
      label.textContent = "#" + invitation.id + " · " + translations[language][statusKey] +
        " · " + new Date(invitation.expiresAt).toLocaleString(language === "fa" ? "fa-IR" : "en");
      item.append(label);
      if (invitation.status === "active") {
        const revoke = document.createElement("button");
        revoke.className = "quiet-button";
        revoke.textContent = translations[language].revokeInvitation;
        revoke.addEventListener("click", async () => {
          try {
            await api("/api/invitations/" + invitation.id, { method:"DELETE" });
            await loadOwnerInvitations();
          } catch (error) { $("newInvitationCode").textContent = errorText(error.message); }
        });
        item.append(revoke);
      }
      root.append(item);
    });
    if (!invitations.length) root.textContent = "—";
  } catch (error) { console.error(error); }
}

$("createInvitationButton").addEventListener("click", async () => {
  $("newInvitationCode").textContent = "";
  try {
    const { invitation } = await api("/api/invitations", { method:"POST", body:JSON.stringify({}) });
    $("newInvitationCode").textContent = translations[language].invitationCreated + " " + invitation.code;
    await loadOwnerInvitations();
  } catch (error) {
    $("newInvitationCode").textContent = errorText(error.message);
  }
});

async function loadOwnerRequests() {
  try {
    const { requests } = await api("/api/account-change-requests");
    const root = $("ownerRequests"); root.replaceChildren();
    requests.forEach((r) => {
      const item = document.createElement("div"); item.className = "request-item";
      const label = document.createElement("span");
      label.textContent = r.username + " · " + (r.type === "username" ? "Username → " + r.proposedUsername : "Password change");
      const yes = document.createElement("button"); yes.className = "primary"; yes.textContent = translations[language].approve;
      yes.addEventListener("click", () => decideRequest(r.id, "approve"));
      const no = document.createElement("button"); no.className = "quiet-button"; no.textContent = translations[language].reject;
      no.addEventListener("click", () => decideRequest(r.id, "reject"));
      item.append(label, yes, no); root.append(item);
    });
    if (!requests.length) root.textContent = "—";
  } catch (e) { console.error(e); }
}
async function decideRequest(id, decision) {
  try { await api("/api/account-change-requests/" + id, { method:"PATCH", body:JSON.stringify({ decision }) }); await loadOwnerRequests(); }
  catch (e) { console.error(e); }
}
$("messageForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("messageInput");
  const body = input.value.trim();
  if (!body || !socket?.connected) return;
  socket.emit("chat:send", body);
  input.value = "";
});


function callText(key) { return translations[language][key]; }
function updateCallControls() {
  $("joinCallButton").disabled = inCall;
  $("leaveCallButton").disabled = !inCall;
  $("audioButton").disabled = !inCall;
  $("videoButton").disabled = !inCall;
  $("audioButton").textContent = callText(audioEnabled ? "micOn" : "micOff");
  $("videoButton").textContent = callText(videoEnabled ? "cameraOn" : "cameraOff");
}
function ensureTile(userId, username) {
  let tile = remoteTiles.get(userId);
  if (tile) return tile;
  const root = document.createElement("div"); root.className = "video-tile";
  const video = document.createElement("video"); video.autoplay = true; video.playsInline = true;
  const label = document.createElement("span"); label.className = "video-label"; label.textContent = username;
  const placeholder = document.createElement("span"); placeholder.className = "video-placeholder"; placeholder.textContent = username;
  root.append(video, placeholder, label); $("videoGrid").append(root);
  tile = { root, video, label, placeholder, username }; remoteTiles.set(userId, tile); return tile;
}
function closePeer(userId) {
  const pc = peerConnections.get(userId);
  if (pc) pc.close();
  peerConnections.delete(userId);
  const tile = remoteTiles.get(userId);
  if (tile) tile.root.remove();
  remoteTiles.delete(userId);
}
function ensurePeer(participant) {
  if (!inCall || participant.userId === currentUser.id || peerConnections.has(participant.userId)) return peerConnections.get(participant.userId);
  const peerId = participant.userId;
  const pc = new RTCPeerConnection({ iceServers });
  const state = { pc, makingOffer: false, ignoreOffer: false, polite: currentUser.id > peerId };
  peerConnections.set(peerId, state);
  if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  const tile = ensureTile(peerId, participant.username);
  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      tile.video.srcObject = stream;
      tile.placeholder.hidden = true;
    }
  };
  pc.onicecandidate = (event) => {
    if (event.candidate && socket?.connected) socket.emit("call:signal", { targetUserId: peerId, signal: { candidate: event.candidate } });
  };
  pc.onnegotiationneeded = async () => {
    try {
      state.makingOffer = true;
      await pc.setLocalDescription();
      socket.emit("call:signal", { targetUserId: peerId, signal: { description: pc.localDescription } });
    } catch (error) { console.warn("Call negotiation failed", error); }
    finally { state.makingOffer = false; }
  };
  return state;
}
async function handleSignal(fromUserId, signal) {
  if (!inCall) return;
  const state = peerConnections.get(fromUserId);
  if (!state) return;
  const pc = state.pc;
  try {
    if (signal.description) {
      const description = signal.description;
      const readyForOffer = !state.makingOffer && (pc.signalingState === "stable" || state.isSettingRemoteAnswerPending);
      const offerCollision = description.type === "offer" && !readyForOffer;
      state.ignoreOffer = !state.polite && offerCollision;
      if (state.ignoreOffer) return;
      state.isSettingRemoteAnswerPending = description.type === "answer";
      await pc.setRemoteDescription(description);
      state.isSettingRemoteAnswerPending = false;
      if (description.type === "offer") {
        await pc.setLocalDescription();
        socket.emit("call:signal", { targetUserId: fromUserId, signal: { description: pc.localDescription } });
      }
    } else if (signal.candidate) {
      try { await pc.addIceCandidate(signal.candidate); }
      catch (error) { if (!state.ignoreOffer) throw error; }
    }
  } catch (error) { console.warn("Call signaling failed", error); }
}
function handleCallJoined({ participants, selfUserId }) {
  inCall = true;
  $("callStatus").textContent = callText("callConnected");
  updateCallControls();
  participants.forEach((participant) => {
    if (participant.userId !== selfUserId) ensurePeer(participant);
  });
}
async function joinCall() {
  if (!socket?.connected || inCall) return;
  $("callStatus").textContent = callText("callReady");
  socket.emit("call:join");
}
async function leaveCall() {
  if (!inCall) return;
  socket.emit("call:leave");
  peerConnections.forEach((state) => state.pc.close());
  peerConnections.clear(); remoteTiles.forEach(tile => tile.root.remove()); remoteTiles.clear();
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  localStream = null; audioEnabled = false; videoEnabled = false; inCall = false;
  $("callStatus").textContent = callText("callReady");
  updateCallControls();
}
async function setMedia(kind, enabled) {
  if (!inCall) return;
  try {
    const constraints = kind === "audio" ? { audio: true, video: false } : { audio: false, video: true };
    if (!localStream) localStream = new MediaStream();
    const existing = localStream.getTracks().find(track => track.kind === kind);
    if (enabled && !existing) {
      const acquired = await navigator.mediaDevices.getUserMedia(constraints);
      const track = acquired.getTracks()[0];
      localStream.addTrack(track);
      peerConnections.forEach(({ pc }) => pc.addTrack(track, localStream));
    } else if (existing) {
      existing.enabled = enabled;
    }
    if (kind === "audio") audioEnabled = enabled;
    else videoEnabled = enabled;
    socket.emit("call:media-state", { audioEnabled, videoEnabled });
    updateCallControls();
  } catch (error) {
    $("callStatus").textContent = callText("mediaDenied");
  }
}
$("joinCallButton").addEventListener("click", joinCall);
$("leaveCallButton").addEventListener("click", leaveCall);
$("audioButton").addEventListener("click", () => setMedia("audio", !audioEnabled));
$("videoButton").addEventListener("click", () => setMedia("video", !videoEnabled));

setLanguage("fa");
updateCallControls();
configureRegistration();
api("/api/me").then(({ user }) => showChat(user)).catch(() => {});
