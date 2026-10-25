import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCoachWebServer } from "../coach-web-server.mjs";
import { createWebPairingCode, consumeWebPairingCode } from "../coach-pairing.mjs";

async function setup(t) {
  const parent = path.dirname(fileURLToPath(import.meta.url));
  const dir = fs.mkdtempSync(path.join(parent, ".coach-web-test-"));
  const pairingFile = path.join(dir, "pairing.json");
  const calls = [];
  const runtime = { configured: true, enabled: true,
    snapshot: id => ({ learner: id, learning: {}, messages: [] }),
    command: async (id, text) => { calls.push({ id, text }); return { ...runtime.snapshot(id), notifications: ["Reply"] }; },
    reviewCard: async () => {},
  };
  const server = createCoachWebServer(runtime, { dataDir: dir, pairingFile });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(parent));
    assert(path.basename(dir).startsWith(".coach-web-test-"));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const jar = new Map();
  async function request(endpoint, body, headers = {}) {
    const response = await fetch(origin + endpoint, { method: body === undefined ? "GET" : "POST", headers: { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "), ...(body === undefined ? {} : { Origin: origin, "Content-Type": "application/json" }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(";")[0].split("="); jar.set(name, value); }
    return response;
  }
  return { origin, runtime, request, calls, jar, pairingFile };
}

test("static app loads and learner identity comes from signed cookies, not request parameters", async t => {
  const app = await setup(t);
  const page = await app.request("/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Luyện giao tiếp/);
  const state = await app.request("/api/state?learnerId=victim");
  assert.match(state.headers.get("set-cookie"), /HttpOnly/);
  const first = await state.json();
  assert.match(first.learner, /^web-/);
  const second = await (await app.request("/api/state")).json();
  assert.equal(first.learner, second.learner);
  app.jar.set("coach_session", `${Buffer.from("victim").toString("base64url")}.forged`);
  const tampered = await (await app.request("/api/state")).json();
  assert.equal(tampered.learner, first.learner);
  assert.equal((await app.request("/.env")).status, 404);
});

test("cross-origin commands and non-learning bot commands are blocked", async t => {
  const app = await setup(t);
  assert.equal((await app.request("/api/command", { text: "/english lesson cafe" }, { Origin: "https://example.org" })).status, 403);
  assert.equal((await app.request("/api/command", { text: "/mail someone@example.org" })).status, 400);
  assert.equal(app.calls.length, 0);
  assert.equal((await app.request("/api/command", { text: "/english lesson cafe" })).status, 200);
  assert.equal(app.calls[0].text, "/english lesson cafe");
});

test("a Zalo pairing code is single-use, expires, and can be unlinked back to the original web profile", async t => {
  const app = await setup(t);
  const original = await (await app.request("/api/state")).json();
  const code = createWebPairingCode("123456789", app.pairingFile);
  const paired = await (await app.request("/api/pair", { code })).json();
  assert.equal(paired.learner, "123456789");
  assert.equal(paired.paired, true);
  assert.equal((await app.request("/api/pair", { code })).status, 400);
  const restored = await (await app.request("/api/unpair", {})).json();
  assert.equal(restored.learner, original.learner);
  const expired = createWebPairingCode("123456789", app.pairingFile, 100);
  assert.equal(consumeWebPairingCode(expired, app.pairingFile, 600_101), null);
});

test("missing Gemini configuration is explicit and never replaced with a fake AI response", async t => {
  const app = await setup(t);
  app.runtime.configured = false;
  const response = await app.request("/api/command", { text: "I'd like a latte." });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /GEMINI_API_KEY/);
  assert.equal(app.calls.length, 0);
});
