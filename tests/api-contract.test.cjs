const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../js/api.js"), "utf8");
const seedSource = fs.readFileSync(path.join(__dirname, "../data/seed.js"), "utf8");

function fixture(occupied = [{ start_at: "2026-11-23T10:00:00-03:00", end_at: "2026-11-23T11:00:00-03:00" }]) {
  const calls = [];
  const document = { cookie: "csrftoken=before" };
  const localStorage = {
    getItem(key) {
      if (key === "labtech_api_modo") return "api";
      if (key === "labtech_sessao") return JSON.stringify({ id: 99, perfil: "admin" });
      return null;
    },
    setItem() { throw new Error("API mode must not persist a session"); },
    removeItem() { throw new Error("API mode must not clear a stored mock session"); }
  };
  const fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url.endsWith("/auth/csrf/")) return response(204, null);
    if (url.endsWith("/auth/login/")) {
      document.cookie = "csrftoken=after";
      return response(200, { user: { id: 7 } });
    }
    if (url.endsWith("/auth/me/")) return response(200, { id: 7 });
    if (url.endsWith("/auth/logout/")) return response(200, { status: "signed_out" });
    if (url === "/api/v1/spaces/") return response(200, [{ id: 2, code: "LAB-02", kind: "laboratory" }]);
    if (url.includes("/booking-agenda/")) return response(200, { occupied });
    if (url.includes("/bookings/") && opts.method === "POST") return response(201, { id: 3, space_id: 2, start_at: "2026-11-23T10:00:00-03:00", end_at: "2026-11-23T11:00:00-03:00", status: "active" });
    if (url.includes("/bookings/?")) return response(200, []);
    throw new Error(`Unexpected request: ${url}`);
  };
  const context = { window: { LABTECH: {}, addEventListener() {} }, document, localStorage, fetch, URLSearchParams, Date, console, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  return { api: context.window.LABTECH.api, calls };
}

function response(status, body) {
  return { ok: status < 400, status, text: async () => body === null ? "" : JSON.stringify(body) };
}

test("login rotates CSRF and me ignores a forged mock role", async () => {
  const { api, calls } = fixture();
  await api.auth.login({ identifier: "ana", password: "secret", perfil: "admin" });
  const me = await api.auth.me();
  assert.equal(me.id, 7);
  assert.equal(me.perfil, null);
  assert.equal(calls[1].opts.headers["X-CSRFToken"], "before");
  await api.auth.logout();
  assert.equal(calls.at(-1).opts.headers["X-CSRFToken"], "after");
});

test("spaces use only the integrated fields and route", async () => {
  const { api, calls } = fixture();
  const spaces = await api.spaces.listAll();
  assert.equal(spaces[0].codigo, "LAB-02");
  assert.equal(spaces[0].capacidade, undefined);
  assert.equal(spaces[0].status, undefined);
  assert.equal(calls[0].url, "/api/v1/spaces/");
});

test("booking list sends only implemented filters", async () => {
  const { api, calls } = fixture();
  await api.bookings.list({ sala_id: 2, mine: true, incluirCanceladas: true, de: "2026-11-23", ate: "2026-11-23" });
  const url = new URL(calls[0].url, "http://local.test");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["limit", "offset", "scope", "space_id"]);
  assert.equal(url.searchParams.get("scope"), "mine");
});

test("booking create sends only space and interval", async () => {
  const { api, calls } = fixture();
  await api.bookings.create({ sala_id: 2, data: "2026-11-23", inicio: "10:00", fim: "11:00", finalidade: "ignored", participantes: 99 });
  const body = JSON.parse(calls[0].opts.body);
  assert.deepEqual(Object.keys(body).sort(), ["end_at", "space_id", "start_at"]);
});

test("public agenda reads occupied windows without personal details", async () => {
  const { api, calls } = fixture();
  const occupied = await api.bookings.agenda(2, { de: "2026-11-23", ate: "2026-11-23" });
  assert.equal(occupied[0].inicio, "10:00");
  assert.equal(occupied[0].finalidade, undefined);
  assert.match(calls[0].url, /booking-agenda/);
});

test("agenda splits a booking crossing midnight into each day", async () => {
  const { api } = fixture([{ start_at: "2026-11-23T23:00:00-03:00", end_at: "2026-11-24T08:00:00-03:00" }]);
  const occupied = await api.bookings.agenda(2, { de: "2026-11-23", ate: "2026-11-24" });
  assert.equal(occupied.length, 2);
  assert.equal(occupied.map((part) => part.data).join(","), "2026-11-23,2026-11-24");
  assert.equal(occupied[0].fim, "24:00");
  assert.equal(occupied[1].fim, "08:00");
});

test("demonstration mode retains login and room data", async () => {
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  };
  const context = { window: { LABTECH: {}, addEventListener() {} }, document: { cookie: "" }, localStorage, URLSearchParams, Date, console, setTimeout, clearTimeout };
  vm.runInNewContext(seedSource, context);
  vm.runInNewContext(source, context);
  const L = context.window.LABTECH;
  const { user } = await L.api.auth.login({ identifier: "joao.silva@udf.edu.br", password: "labtech", perfil: "student" });
  assert.equal(user.perfil, "student");
  assert.ok((await L.api.spaces.list()).length > 0);
  await L.api.auth.logout();
  assert.equal(L.sessaoAtual(), null);
});
