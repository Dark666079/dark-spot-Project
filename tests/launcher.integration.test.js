const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

async function getFreePort() {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitFor(check, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError || new Error("Timed out waiting for launcher/server state.");
}

test("local launcher starts, reports, and stops its server securely", async (t) => {
  const root = path.join(__dirname, "..");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dark-spot-launcher-test-"));
  const launcherPort = await getFreePort();
  const appPort = await getFreePort();
  const base = "http://127.0.0.1:" + launcherPort;
  const appBase = "http://127.0.0.1:" + appPort;
  const child = spawn(process.execPath, [path.join(root, "launcher", "launcher.js")], {
    cwd: root,
    env: {
      ...process.env,
      LAUNCHER_PORT: String(launcherPort),
      PORT: String(appPort),
      HOST: "127.0.0.1",
      DB_PATH: path.join(tempDir, "launcher-test.sqlite"),
      SESSION_SECRET: "launcher-test-session-secret-long-enough-123456",
      OWNER_SETUP_TOKEN: "launcher-test-owner-setup-token-long-enough-123456"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 8000))]);
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const html = await waitFor(async () => {
    if (child.exitCode !== null) throw new Error("Launcher exited: " + output);
    const response = await fetch(base + "/").catch(() => null);
    if (!response || !response.ok) return null;
    return response.text();
  });
  const tokenMatch = html.match(/const key="([a-f0-9]{64})"/);
  assert.ok(tokenMatch, "control page should contain its temporary private token");
  const token = tokenMatch[1];
  const headers = { "x-launcher-token": token, Origin: base };

  const initialStatus = await fetch(base + "/control/status");
  assert.equal(initialStatus.status, 200);
  assert.equal((await initialStatus.json()).running, false);

  const denied = await fetch(base + "/control/start", { method: "POST", headers: { Origin: base } });
  assert.equal(denied.status, 403);

  const badOrigin = await fetch(base + "/control/start", {
    method: "POST",
    headers: { ...headers, Origin: "http://example.invalid" }
  });
  assert.equal(badOrigin.status, 403);

  const startResponse = await fetch(base + "/control/start", { method: "POST", headers });
  assert.equal(startResponse.status, 200, output);
  assert.equal((await startResponse.json()).started, true);

  const appStatus = await waitFor(async () => {
    const response = await fetch(appBase + "/api/status").catch(() => null);
    if (!response || !response.ok) return null;
    return response.json();
  });
  assert.equal(appStatus.name, "Dark-Spot");

  const runningStatus = await fetch(base + "/control/status");
  assert.equal((await runningStatus.json()).running, true);

  const stopResponse = await fetch(base + "/control/stop", { method: "POST", headers });
  assert.equal(stopResponse.status, 200);
  assert.equal((await stopResponse.json()).stopped, true);

  await waitFor(async () => {
    const response = await fetch(base + "/control/status");
    return !(await response.json()).running;
  });

  await assert.rejects(() => fetch(appBase + "/api/status"), "server should no longer accept connections");
});
