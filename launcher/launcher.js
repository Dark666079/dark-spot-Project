const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.LAUNCHER_PORT || 4317);
const ROOT = path.resolve(__dirname, "..");
const token = crypto.randomBytes(32).toString("hex");
const STOP_TIMEOUT_MS = 5000;
let child = null;
let childOutput = "";
let lastExit = null;
let stopping = false;
let startPromise = null;
let stopPromise = null;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("LAUNCHER_PORT must be a valid TCP port.");
}

const page = () => `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#10131b">
<title>Dark-Spot | کنترل سرور</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#10131b;color:#f3f5fa;font-family:Tahoma,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:18px}
main{width:min(100%,460px);background:#1b2130;border:1px solid #30394c;border-radius:18px;padding:25px;box-shadow:0 18px 60px #0005}
h1{font-size:23px;margin:0 0 8px}.muted{color:#aeb8ca;font-size:13px;line-height:2}
.status{margin:22px 0 14px;padding:15px;border-radius:12px;background:#111722;display:flex;justify-content:space-between;align-items:center}
.state{display:flex;align-items:center;gap:9px;font-weight:bold}.dot{width:10px;height:10px;border-radius:50%;background:#d6a34c}.dot.on{background:#36c98b}.dot.busy{background:#64a9ed}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
button{border:0;border-radius:10px;padding:14px;font-size:15px;font-weight:bold;cursor:pointer;color:white}
#start{background:#247b59}#stop{background:#8e3b47}button:disabled{opacity:.4;cursor:not-allowed}
#message{min-height:48px;margin-top:16px;padding:10px 12px;border-radius:9px;background:#111722;color:#c4d0e2;font-size:13px;line-height:1.9;white-space:pre-wrap}
#details{margin-top:10px;color:#8f9bb0;font-size:11px;direction:ltr;text-align:left;overflow-wrap:anywhere}
footer{margin-top:17px;color:#8490a4;font-size:11px;line-height:1.8}
</style></head><body><main>
<h1>Dark-Spot</h1><div class="muted">پنل کنترل محلی سرور</div>
<div class="status"><span>وضعیت سرور</span><strong class="state"><i id="dot" class="dot"></i><span id="stateText">در حال بررسی...</span></strong></div>
<div class="actions"><button id="start" type="button">روشن کردن سرور</button><button id="stop" type="button">خاموش کردن سرور</button></div>
<div id="message" role="status" aria-live="polite">این پنل فقط روی همین لپ‌تاپ در دسترس است.</div>
<div id="details"></div>
<footer>پنل را باز نگه دار. با بستن پنل یا پنجره اجرای آن، سرور نیز متوقف می‌شود.</footer>
</main>
<script>
"use strict";
const key=${JSON.stringify(token)};
const startButton=document.getElementById("start");
const stopButton=document.getElementById("stop");
const message=document.getElementById("message");
const stateText=document.getElementById("stateText");
const dot=document.getElementById("dot");
const details=document.getElementById("details");
let busy=false;
function showStatus(data){
  const active=data.running;
  stateText.textContent=data.starting?"در حال روشن‌شدن...":data.stopping?"در حال خاموش‌شدن...":active?"روشن":"خاموش";
  dot.className="dot"+(active?" on":(data.starting||data.stopping?" busy":""));
  startButton.disabled=busy||active||data.starting||data.stopping;
  stopButton.disabled=busy||(!active&&!data.starting)||data.stopping;
  details.textContent=data.pid?"PID: "+data.pid:(data.lastExit?"آخرین خروج: "+data.lastExit:"");
}
async function refresh(){
  try{
    const response=await fetch("/control/status",{cache:"no-store"});
    if(!response.ok)throw new Error("دریافت وضعیت ناموفق بود");
    showStatus(await response.json());
  }catch(error){message.textContent="ارتباط با پنل قطع شده است: "+error.message;}
}
async function act(action){
  if(busy)return;
  busy=true;startButton.disabled=true;stopButton.disabled=true;
  message.textContent=action==="start"?"در حال راه‌اندازی سرور...":"در حال خاموش‌کردن سرور...";
  try{
    const response=await fetch("/control/"+action,{method:"POST",headers:{"x-launcher-token":key},cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||data.error||"عملیات ناموفق بود");
    message.textContent=data.message||"عملیات انجام شد.";
  }catch(error){message.textContent="خطا: "+error.message;}
  finally{busy=false;await refresh();}
}
startButton.addEventListener("click",()=>act("start"));
stopButton.addEventListener("click",()=>act("stop"));
refresh();
setInterval(refresh,2000);
</script></body></html>`;

function status() {
  const running = Boolean(child && child.exitCode === null);
  return { running, starting: Boolean(startPromise), stopping, pid: running ? child.pid : null, lastExit };
}

function startServer() {
  if (startPromise) return startPromise;
  if (child && child.exitCode === null) {
    return Promise.resolve({ ok: true, started: false, message: "سرور از قبل روشن است." });
  }

  startPromise = new Promise((resolve) => {
    childOutput = "";
    lastExit = null;
    stopping = false;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const processChild = spawn(process.execPath, [path.join(ROOT, "server", "server.js")], {
      cwd: ROOT,
      env: {
        ...process.env,
        DARKSPOT_LAUNCHER_URL: `http://${HOST}:${PORT}`,
        DARKSPOT_LAUNCHER_TOKEN: token
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    child = processChild;

    processChild.stdout.on("data", (chunk) => {
      childOutput = (childOutput + chunk.toString()).slice(-12000);
      process.stdout.write(chunk);
    });
    processChild.stderr.on("data", (chunk) => {
      childOutput = (childOutput + chunk.toString()).slice(-12000);
      process.stderr.write(chunk);
    });
    processChild.once("error", (error) => {
      lastExit = "خطای اجرا: " + error.message;
      if (child === processChild) child = null;
      finish({ ok: false, started: false, message: "اجرای سرور ممکن نشد: " + error.message });
    });
    processChild.once("exit", (code, signal) => {
      lastExit = "code=" + code + (signal ? ", signal=" + signal : "");
      if (child === processChild) child = null;
      stopping = false;
      if (!settled) {
        const detail = childOutput.trim().slice(-1800);
        finish({ ok: false, started: false, message: "سرور هنگام راه‌اندازی متوقف شد." + (detail ? "\n" + detail : "") });
      }
    });
    processChild.once("spawn", () => {
      setTimeout(() => {
        if (child !== processChild || processChild.exitCode !== null) return;
        finish({ ok: true, started: true, message: "فرایند سرور اجرا شد. وضعیت در پنل به‌روزرسانی می‌شود." });
      }, 900);
    });
  }).finally(() => {
    startPromise = null;
  });

  return startPromise;
}

function stopServer() {
  if (stopPromise) return stopPromise;
  const current = child;
  if (!current || current.exitCode !== null) {
    return Promise.resolve({ ok: true, stopped: false, message: "سرور از قبل خاموش است." });
  }

  stopping = true;
  stopPromise = new Promise((resolve) => {
    let finished = false;
    const finish = (forced) => {
      if (finished) return;
      finished = true;
      stopping = false;
      if (child === current && current.exitCode !== null) child = null;
      resolve({
        ok: true,
        stopped: true,
        message: forced ? "سرور پس از پایان مهلت، به‌صورت اجباری متوقف شد." : "سرور با موفقیت خاموش شد."
      });
    };
    current.once("exit", () => finish(false));
    current.kill("SIGTERM");
    const timer = setTimeout(() => {
      if (current.exitCode === null) {
        current.kill("SIGKILL");
        setTimeout(() => finish(true), 300);
      } else {
        finish(false);
      }
    }, STOP_TIMEOUT_MS);
    timer.unref();
  }).finally(() => {
    stopPromise = null;
  });
  return stopPromise;
}

function send(res, code, value) {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(value));
}

function authorized(req) {
  return req.headers["x-launcher-token"] === token;
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== `http://${HOST}:${PORT}`) {
    return send(res, 403, { error: "ORIGIN_FORBIDDEN" });
  }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
    });
    return res.end(page());
  }
  if (req.method === "GET" && req.url === "/control/status") {
    return send(res, 200, status());
  }
  if (req.method === "POST" && req.url === "/internal/owner-logout") {
    if (!authorized(req)) return send(res, 403, { error: "INVALID_CONTROL_TOKEN" });
    stopServer().then((result) => send(res, 200, result)).catch((error) => {
      send(res, 500, { error: "STOP_FAILED", message: error.message });
    });
    return;
  }
  if (req.method === "POST" && (req.url === "/control/start" || req.url === "/control/stop")) {
    if (!authorized(req)) return send(res, 403, { error: "INVALID_CONTROL_TOKEN" });
    const operation = req.url === "/control/start" ? startServer() : stopServer();
    operation.then((result) => send(res, result.ok ? 200 : 500, result)).catch((error) => {
      send(res, 500, { error: "CONTROL_FAILED", message: error.message });
    });
    return;
  }
  return send(res, 404, { error: "NOT_FOUND" });
});

server.on("error", (error) => {
  console.error("Launcher could not start:", error.message);
  process.exitCode = 1;
});
server.listen(PORT, HOST, () => {
  console.log(`Dark-Spot control panel: http://${HOST}:${PORT}`);
});

let closing = false;
async function closeLauncher() {
  if (closing) return;
  closing = true;
  try {
    await stopServer();
  } finally {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), STOP_TIMEOUT_MS + 1500).unref();
  }
}
process.on("SIGINT", closeLauncher);
process.on("SIGTERM", closeLauncher);
