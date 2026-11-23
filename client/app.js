const translations = {
  fa: {
    privateSpace:"PRIVATE SPACE",welcome:"به فضای خصوصی خودت خوش آمدی",authHint:"برای ورود یا ساخت حساب، اطلاعاتت را وارد کن.",
    username:"نام کاربری",password:"رمز عبور",login:"ورود",register:"ساخت حساب",firstAccount:"اولین حسابی که ساخته شود، مالک اصلی خواهد بود.",
    community:"PRIVATE COMMUNITY",mainRoom:"گفت‌وگوی اصلی",logout:"خروج",messagePlaceholder:"پیامت را بنویس...",send:"ارسال",
    mvpNotice:"نسخه اولیه: پیام‌ها ذخیره می‌شوند؛ تماس صوتی و تصویری در مرحله بعد اضافه می‌شود.",footer:"فضای خصوصی دوستان",
    invalid:"نام کاربری یا رمز عبور معتبر نیست.",taken:"این نام کاربری قبلاً استفاده شده است.",limit:"ظرفیت ساخت حساب تکمیل شده است.",
    passwordRules:"رمز عبور باید حداقل ۸ نویسه باشد.",network:"ارتباط با سرور برقرار نشد.",usernameRules:"نام کاربری باید ۳ تا ۲۰ حرف انگلیسی، عدد یا _ باشد."
  },
  en: {
    privateSpace:"PRIVATE SPACE",welcome:"Welcome to your private space",authHint:"Enter your details to sign in or create an account.",
    username:"Username",password:"Password",login:"Sign in",register:"Create account",firstAccount:"The first account created becomes the owner.",
    community:"PRIVATE COMMUNITY",mainRoom:"Main chat",logout:"Log out",messagePlaceholder:"Write a message...",send:"Send",
    mvpNotice:"First version: messages are saved. Voice and video calling will be added in the next stage.",footer:"A private space for friends",
    invalid:"Enter a valid username and password.",taken:"That username is already taken.",limit:"The account limit has been reached.",
    passwordRules:"Password must be at least 8 characters.",network:"Could not connect to the server.",usernameRules:"Username must be 3–20 characters: English letters, numbers or _."
  }
};
let language = "fa";
let currentUser = null;
let socket = null;
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
  const map = { INVALID_CREDENTIALS:"invalid", USERNAME_TAKEN:"taken", USER_LIMIT:"limit", PASSWORD_RULES:"passwordRules", USERNAME_RULES:"usernameRules" };
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
  socket.on("connect_error", (error) => {
    if (error.message === "AUTH_REQUIRED") socket.disconnect();
  });
}

async function authenticate(mode) {
  $("authError").textContent = "";
  const username = $("username").value.trim();
  const password = $("password").value;
  try {
    const data = await api("/api/" + mode, { method:"POST", body:JSON.stringify({ username, password }) });
    showChat(data.user);
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
$("messageForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("messageInput");
  const body = input.value.trim();
  if (!body || !socket?.connected) return;
  socket.emit("chat:send", body);
  input.value = "";
});

setLanguage("fa");
api("/api/me").then(({ user }) => showChat(user)).catch(() => {});
