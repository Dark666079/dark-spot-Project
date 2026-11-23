const translations = {
  fa: {
    privateSpace:"PRIVATE SPACE",welcome:"به فضای خصوصی خودت خوش آمدی",authHint:"برای ورود یا ساخت حساب، اطلاعاتت را وارد کن.",
    invitationCode:"کد دعوت",setupToken:"کلید راه‌اندازی مالک",inviteHint:"برای ساخت حساب به دعوت‌نامه معتبر نیاز داری.",setupHint:"راه‌اندازی اولیه: کلید امن مالک را وارد کن.",invitationInvalid:"کد دعوت معتبر نیست، منقضی شده یا قبلاً استفاده شده است.",setupInvalid:"کلید راه‌اندازی مالک نادرست است.",ownerSetupDisabled:"راه‌اندازی مالک روی سرور فعال نشده است.",invitationManagement:"مدیریت دعوت‌نامه‌ها",createInvitation:"ساخت دعوت‌نامه",invitationCreated:"کد دعوت (فقط همین بار نمایش داده می‌شود):",copyCode:"کپی کد",invitationActive:"فعال",invitationUsed:"استفاده‌شده",invitationExpired:"منقضی‌شده",invitationRevoked:"باطل‌شده",revokeInvitation:"باطل‌کردن",invitationCapacity:"ظرفیت باقی‌مانده برای دعوت‌نامه کافی نیست.",
    username:"نام کاربری",password:"رمز عبور",login:"ورود",register:"ساخت حساب",firstAccount:"اولین حسابی که ساخته شود، مالک اصلی خواهد بود.",
    community:"PRIVATE COMMUNITY",mainRoom:"گفت‌وگوی اصلی",logout:"خروج",messagePlaceholder:"پیامت را بنویس...",send:"ارسال",
    mvpNotice:"نسخه اولیه: پیام‌ها ذخیره می‌شوند؛ تماس صوتی و تصویری در مرحله بعد اضافه می‌شود.",footer:"فضای خصوصی دوستان",
    invalid:"نام کاربری یا رمز عبور معتبر نیست.",taken:"این نام کاربری قبلاً استفاده شده است.",limit:"ظرفیت ساخت حساب تکمیل شده است.",
    passwordRules:"رمز عبور باید حداقل ۸ نویسه باشد.",accountSettings:"تغییر اطلاعات حساب",changeType:"نوع تغییر",changeUsername:"نام کاربری",changePassword:"رمز عبور",currentPassword:"رمز عبور فعلی",newUsername:"نام کاربری جدید",newPassword:"رمز عبور جدید",sendRequest:"ارسال درخواست به هاست",pendingRequests:"درخواست‌های در انتظار تأیید",requestSent:"درخواست ارسال شد؛ منتظر تأیید هاست بمان.",requestPending:"یک درخواست در انتظار بررسی داری.",currentPasswordInvalid:"رمز عبور فعلی درست نیست.",sameUsername:"نام کاربری جدید باید با نام فعلی متفاوت باشد.",requestResultApproved:"هاست درخواستت را تأیید کرد.",requestResultRejected:"هاست درخواستت را رد کرد.",approve:"تأیید",reject:"رد",network:"ارتباط با سرور برقرار نشد.",usernameRules:"نام کاربری باید ۳ تا ۲۰ حرف انگلیسی، عدد یا _ باشد."
  },
  en: {
    privateSpace:"PRIVATE SPACE",welcome:"Welcome to your private space",authHint:"Enter your details to sign in or create an account.",
    invitationCode:"Invitation code",setupToken:"Owner setup key",inviteHint:"A valid invitation is required to create an account.",setupHint:"Initial setup: enter the secure owner key.",invitationInvalid:"The invitation is invalid, expired, or already used.",setupInvalid:"The owner setup key is incorrect.",ownerSetupDisabled:"Owner setup is not enabled on the server.",invitationManagement:"Invitation management",createInvitation:"Create invitation",invitationCreated:"Invitation code (shown only once):",copyCode:"Copy code",invitationActive:"Active",invitationUsed:"Used",invitationExpired:"Expired",invitationRevoked:"Revoked",revokeInvitation:"Revoke",invitationCapacity:"There is not enough remaining account capacity for another invitation.",
    username:"Username",password:"Password",login:"Sign in",register:"Create account",firstAccount:"The first account created becomes the owner.",
    community:"PRIVATE COMMUNITY",mainRoom:"Main chat",logout:"Log out",messagePlaceholder:"Write a message...",send:"Send",
    mvpNotice:"First version: messages are saved. Voice and video calling will be added in the next stage.",footer:"A private space for friends",
    invalid:"Enter a valid username and password.",taken:"That username is already taken.",limit:"The account limit has been reached.",
    passwordRules:"Password must be at least 8 characters.",accountSettings:"Account settings",changeType:"Change type",changeUsername:"Username",changePassword:"Password",currentPassword:"Current password",newUsername:"New username",newPassword:"New password",sendRequest:"Send request to host",pendingRequests:"Pending approval requests",requestSent:"Request sent. Wait for the host's approval.",requestPending:"You already have a pending request.",currentPasswordInvalid:"Your current password is incorrect.",sameUsername:"Choose a username different from your current one.",requestResultApproved:"The host approved your request.",requestResultRejected:"The host rejected your request.",approve:"Approve",reject:"Reject",network:"Could not connect to the server.",usernameRules:"Username must be 3–20 characters: English letters, numbers or _."
  }
};
let language = "fa";
let currentUser = null;
let socket = null;
let ownerSetupMode = false;
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
    if (ownerSetupMode && !status.ownerSetupAvailable) {
      $("registerButton").disabled = true;
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

setLanguage("fa");
configureRegistration();
api("/api/me").then(({ user }) => showChat(user)).catch(() => {});
