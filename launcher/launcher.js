const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.LAUNCHER_PORT || 4317);
const ROOT = path.resolve(__dirname, "..");
const token = crypto.randomBytes(32).toString("hex");
let child = null;
let childOutput = "";
let stopping = false;

const page = (status) => `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dark-Spot Launcher</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#10131b;color:#f3f5fa;font-family:Tahoma,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px}
main{width:min(100%,440px);background:#1b2130;border:1px solid #30394c;border-radius:18px;padding:26px;box-shadow:0 18px 60px #0005}
h1{font-size:23px;margin:0 0 8px}.muted{color:#aeb8ca;font-size:14px;line-height:1.9}
.status{margin:22px 0;padding:14px;border-radius:12px;background:#111722;display:flex;justify-content:space-between;align-items:center}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:${status.running ? "#36c98b" : "#e5a84b"};margin-left:8px}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}button{border:0;border-radius:10px;padding:13px;font-size:15px;font-weight:bold;cursor:pointer}
#start{background:#247b59;color:white}#stop{background:#8e3b47;color:white}button:disabled{opacity:.4;cursor:not-allowed}
#message{min-height:28px;margin-top:16px;color:#b9c6dc;font-size:13px;line-height:1.8}
</style></head><body><main>
<h1>Dark-Spot Launcher</h1><div class="muted">کنترل سرور فقط روی همین لپ‌تاپ</div>
<div class="status"><span>وضعیت سرور</span><strong><i class="dot"></i>${status.running ? "روشن" : "خاموش"}</strong></div>
<div class="actions"><button id="start" ${status.running ? "disabled" : ""}>روشن کردن</button><button id="stop" ${status.running ? "" : "disabled"}>خاموش کردن</button></div>
<div id="message">این صفحه را فقط روی لپ‌تاپ هاست باز کن.</div>
</main><script>
const key=${JSON.stringify(token)};
async function act(action){const m=document.querySelector("#message");m.textContent="در حال انجام...";try{const r=await fetch("/control/"+action,{method:"POST",headers:{"x-launcher-token":key}});const d=await r.json();if(!r.ok)throw new Error(d.error||"خطا");m.textContent=d.message;setTimeout(()=>location.reload(),700)}catch(e){m.textContent="خطا: "+e.message}}
document.querySelector("#start").onclick=()=>act("start");
document.querySelector("#stop").onclick=()=>act("stop");
</script></body></html>`;

function status() { return { running: Boolean(child && child.exitCode === null), pid: child?.pid || null }; }

function startServer() {
  if (child && child.exitCode === null) return false;
  childOutput = "";
  stopping = false;
  child = spawn(process.execPath, [path.join(ROOT, "server", "server.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      DARKSPOT_LAUNCHER_URL: `http://${HOST}:${PORT}`,
      DARKSPOT_LAUNCHER_TOKEN: token
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", chunk => { childOutput += chunk.toString(); process.stdout.write(chunk); });
  child.stderr.on("data", chunk => { childOutput += chunk.toString(); process.stderr.write(chunk); });
  child.on("exit", () => { child = null; stopping = false; });
  return true;
}

function stopServer() {
  if (!child || child.exitCode !== null) return false;
  stopping = true;
  const current = child;
  current.kill("SIGTERM");
  setTimeout(() => {
    if (child === current && current.exitCode === null) current.kill("SIGKILL");
  }, 5000).unref();
  return true;
}

function send(res, code, value) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== `http://${HOST}:${PORT}`) return send(res, 403, { error: "ORIGIN_FORBIDDEN" });
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(page(status()));
  }
  if (req.method === "GET" && req.url === "/control/status") return send(res, 200, status());
  if (req.method === "POST" && req.url === "/internal/owner-logout") {
    if (req.headers["x-launcher-token"] !== token) return send(res, 403, { error: "INVALID_CONTROL_TOKEN" });
    const stopped = stopServer();
    return send(res, 200, { ok: true, stopped });
  }
  if (req.method === "POST" && req.url.startsWith("/control/")) {
    if (req.headers["x-launcher-token"] !== token) return send(res, 403, { error: "INVALID_CONTROL_TOKEN" });
    const action = req.url.slice("/control/".length);
    if (action === "start") return send(res, 200, { ok: true, started: startServer(), message: "درخواست روشن‌کردن سرور ثبت شد." });
    if (action === "stop") return send(res, 200, { ok: true, stopped: stopServer(), message: "درخواست خاموش‌کردن سرور ثبت شد." });
    return send(res, 404, { error: "NOT_FOUND" });
  }
  return send(res, 404, { error: "NOT_FOUND" });
});

server.listen(PORT, HOST, () => {
  console.log(`Dark-Spot Launcher: http://${HOST}:${PORT}`);
});
server.on("error", error => {
  console.error("Launcher could not start:", error.message);
  process.exitCode = 1;
});

function closeLauncher() {
  const current = child;
  if (current && current.exitCode === null) {
    stopServer();
    current.once("exit", () => server.close(() => process.exit(0)));
    setTimeout(() => process.exit(1), 7000).unref();
    return;
  }
  server.close(() => process.exit(0));
}
process.on("SIGINT", closeLauncher);
process.on("SIGTERM", closeLauncher);
