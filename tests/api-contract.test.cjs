const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

// A UI exibe horários no fuso do navegador; fixe o fuso do teste em qualquer runner.
process.env.TZ = "America/Sao_Paulo";

const source = fs.readFileSync(path.join(__dirname, "../js/api.js"), "utf8");
const seedSource = fs.readFileSync(path.join(__dirname, "../data/seed.js"), "utf8");
const coreSource = fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8");
const dashboardSource = fs.readFileSync(path.join(__dirname, "../js/dashboard.js"), "utf8");
const detailSource = fs.readFileSync(path.join(__dirname, "../js/sala-detalhes.js"), "utf8");

// rotas: função opcional (url, opts) => resposta, consultada antes das rotas padrão
function fixture(occupied = [{ start_at: "2026-11-23T10:00:00-03:00", end_at: "2026-11-23T11:00:00-03:00" }], rotas = () => null) {
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
    const extra = rotas(url, opts, document);
    if (extra) return extra;
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
  return { api: context.window.LABTECH.api, L: context.window.LABTECH, calls, document };
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
  // contrato antigo (sem os campos novos): nome cai para o código e capacidade fica nula
  assert.equal(spaces[0].nome, "LAB-02");
  assert.equal(spaces[0].capacidade, null);
  assert.equal(spaces[0].localizacao, "");
  assert.equal(spaces[0].ativo, true);
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

/* ------------------------------------------------------------
   Contrato da etapa final: perfis, usuários, espaços, chaves e empréstimos
   ------------------------------------------------------------ */
const json = (status, body) => response(status, body);
const corpo = (call) => JSON.parse(call.opts.body);
const params = (call) => Object.fromEntries(new URL(call.url, "http://local.test").searchParams);
const escrita = (calls) => calls.filter((c) => c.opts.method && c.opts.method !== "GET");

const KEY_OUT = {
  id: 4, space_id: 2, space_code: "LAB-02", label: "CH-LAB-02", status: "available", has_active_loan: true,
  active_loan: { id: 9, responsible_user_id: 7, responsible_name: "Ana Costa", checked_out_at: "2026-11-21T08:00:00-03:00" }
};
const LOAN_OUT = {
  id: 9, key_id: 4, key_label: "CH-LAB-02", space_id: 2, space_code: "LAB-02", responsible_user_id: 7, responsible_name: "Ana Costa",
  checkout_operator_id: 1, checked_out_at: "2026-11-21T08:00:00-03:00", returned_at: null, return_operator_id: null, status: "active"
};

test("me uses the server role, name and email", async () => {
  const { api } = fixture(undefined, (url) => url.endsWith("/auth/me/")
    ? json(200, { id: 7, username: "ana", name: "Ana Costa", email: "ana@udf.edu.br", role: "admin", is_staff: true }) : null);
  const me = await api.auth.me();
  assert.equal(me.perfil, "admin");
  assert.equal(me.nome, "Ana Costa");
  assert.equal(me.email, "ana@udf.edu.br");
  assert.equal(me.usuario, "ana");
});

test("me rejects unknown roles and falls back to is_staff", async () => {
  const { api } = fixture(undefined, (url) => url.endsWith("/auth/me/") ? json(200, { id: 7, username: "rafa", role: "root", is_staff: true }) : null);
  const me = await api.auth.me();
  assert.equal(me.perfil, "employee");
  assert.equal(me.nome, "rafa");
});

test("spaces map the new fields and list only active ones", async () => {
  const { api, calls } = fixture(undefined, (url) => url === "/api/v1/spaces/?is_active=true"
    ? json(200, [{ id: 2, code: "LAB-02", kind: "laboratory", name: "Informática 2", capacity: 30, location: "Bloco A", is_active: true },
      { id: 3, code: "SALA-1", kind: "room", name: "", capacity: null, location: "", is_active: false }]) : null);
  const spaces = await api.spaces.list();
  assert.equal(params(calls[0]).is_active, "true");
  assert.equal(spaces.length, 1);
  assert.equal(spaces[0].nome, "Informática 2");
  assert.equal(spaces[0].capacidade, 30);
  assert.equal(spaces[0].localizacao, "Bloco A");
  assert.equal(spaces[0].tipo, "laboratorio");
});

test("space create and partial update send contract fields with CSRF", async () => {
  const { api, calls } = fixture(undefined, (url, opts) => /\/spaces\/(\d+\/)?$/.test(url) && opts.method !== "GET"
    ? json(opts.method === "POST" ? 201 : 200, { id: 5, code: "LAB-16", kind: "room", name: "", capacity: null, location: "", is_active: false }) : null);
  await api.spaces.create({ codigo: "LAB-16", tipo: "sala", nome: "Sala 16", capacidade: null, localizacao: "Bloco D", ativo: true });
  await api.spaces.update(5, { ativo: false });
  const [criar, desativar] = escrita(calls);
  assert.deepEqual(corpo(criar), { code: "LAB-16", kind: "room", name: "Sala 16", capacity: null, location: "Bloco D", is_active: true });
  assert.equal(desativar.opts.method, "PATCH");
  assert.deepEqual(corpo(desativar), { is_active: false });
  assert.equal(criar.opts.headers["X-CSRFToken"], "before");
  assert.equal(desativar.opts.headers["X-CSRFToken"], "before");
});

test("keys map KeyOut with the active loan and the space name", async () => {
  const { api, calls } = fixture(undefined, (url) => {
    if (url.startsWith("/api/v1/keys/?")) return json(200, [KEY_OUT, { ...KEY_OUT, id: 5, label: "CH-B", status: "maintenance", has_active_loan: false, active_loan: null }]);
    if (url === "/api/v1/spaces/") return json(200, [{ id: 2, code: "LAB-02", kind: "laboratory", name: "Informática 2", capacity: 30, location: "Bloco A", is_active: true }]);
    return null;
  });
  const keys = await api.keys.list({ sala_id: 2, emprestada: false });
  const filtros = params(calls.find((c) => c.url.startsWith("/api/v1/keys/")));
  assert.deepEqual(filtros, { space_id: "2", has_active_loan: "false" });
  assert.equal(keys[0].codigo, "CH-LAB-02");
  assert.equal(keys[0].status, "emprestada");
  assert.equal(keys[0].emprestimo.usuario.nome, "Ana Costa");
  assert.equal(keys[0].sala.nome, "Informática 2");
  assert.equal(keys[0].local, "Bloco A");
  assert.equal(keys[1].status, "manutencao");
  assert.equal(keys[1].estado, "maintenance");
  assert.equal(keys[1].ativo, true);
});

test("key create and update send label, space and status with CSRF", async () => {
  const { api, calls } = fixture(undefined, (url, opts) => url.includes("/keys/") && opts.method !== "GET" ? json(201, { ...KEY_OUT, active_loan: null, has_active_loan: false }) : null);
  await api.keys.create({ codigo: "CH-LAB-02", sala_id: "2", estado: "available", local: "ignorado", observacao: "ignorado" });
  await api.keys.update(4, { ativo: false });
  await api.keys.update(4, { estado: "lost", codigo: "CH-X" });
  const [criar, desativar, perdida] = escrita(calls);
  assert.deepEqual(corpo(criar), { label: "CH-LAB-02", space_id: 2, status: "available" });
  assert.deepEqual(corpo(desativar), { status: "inactive" });
  assert.deepEqual(corpo(perdida), { label: "CH-X", status: "lost" });
  assert.equal(desativar.opts.method, "PATCH");
  assert.ok(escrita(calls).every((c) => c.opts.headers["X-CSRFToken"] === "before"));
});

test("loan list sends contract filters, paginates and maps LoanOut", async () => {
  const pagina = Array.from({ length: 100 }, (_, i) => ({ ...LOAN_OUT, id: i + 1 }));
  const { api, calls } = fixture(undefined, (url) => {
    if (!url.startsWith("/api/v1/key-loans/?")) return null;
    return json(200, new URL(url, "http://x").searchParams.get("offset") === "0" ? pagina : [{ ...LOAN_OUT, id: 101, status: "returned", returned_at: "2026-11-21T09:00:00-03:00" }]);
  });
  const loans = await api.loans.list({ ativos: true, chave_id: 4, sala_id: 2, usuario_id: 7 });
  assert.equal(calls.length, 2);
  assert.deepEqual(params(calls[0]), { status: "active", key_id: "4", space_id: "2", responsible_user_id: "7", limit: "100", offset: "0" });
  assert.equal(params(calls[1]).offset, "100");
  assert.equal(loans.length, 101);
  assert.equal(loans[0].chave.codigo, "CH-LAB-02");
  assert.equal(loans[0].usuario.nome, "Ana Costa");
  assert.equal(loans[0].registrado_por, 1);
  assert.equal(loans[100].devolvida_em, "2026-11-21T09:00:00-03:00");
});

test("checkout and return post with CSRF and expose KEY_UNAVAILABLE", async () => {
  let ocupada = false;
  const { api, L, calls } = fixture(undefined, (url, opts) => {
    if (url === "/api/v1/key-loans/" && opts.method === "POST") {
      if (ocupada) return json(409, { error: { code: "KEY_UNAVAILABLE", message: "Chave indisponível.", details: { key_id: 4 } } });
      ocupada = true; return json(201, LOAN_OUT);
    }
    if (url === "/api/v1/key-loans/9/return/") return json(200, { ...LOAN_OUT, status: "returned", returned_at: "2026-11-21T09:00:00-03:00" });
    return null;
  });
  const e = await api.loans.checkout({ chave_id: "4", usuario_id: "7" });
  assert.equal(e.retirada_em, LOAN_OUT.checked_out_at);
  assert.deepEqual(corpo(calls[0]), { key_id: 4, responsible_user_id: 7 });
  assert.equal(calls[0].opts.headers["X-CSRFToken"], "before");
  await assert.rejects(api.loans.checkout({ chave_id: 4, usuario_id: 7 }), (err) => err instanceof L.ApiError && err.status === 409 && err.code === "KEY_UNAVAILABLE");
  const devolvido = await api.loans.return(9);
  assert.ok(devolvido.devolvida_em);
  assert.deepEqual(corpo(calls.at(-1)), {});
  assert.equal(calls.at(-1).opts.headers["X-CSRFToken"], "before");
});

test("key movements are completed with the loan responsible", async () => {
  const { api } = fixture(undefined, (url) => {
    if (url === "/api/v1/keys/4/movements/") return json(200, { key_id: 4, events: [{ type: "return", loan_id: 9, occurred_at: "2026-11-21T09:00:00-03:00" }, { type: "checkout", loan_id: 9, occurred_at: "2026-11-21T08:00:00-03:00" }] });
    if (url.startsWith("/api/v1/key-loans/?")) return json(200, [LOAN_OUT]);
    return null;
  });
  const r = await api.keys.movements(4);
  assert.equal(r.eventos.map((e) => e.tipo).join(","), "devolucao,retirada");
  assert.equal(r.eventos[0].usuario.nome, "Ana Costa");
  assert.equal(r.eventos[1].registrado_por, 1);
});

test("users list, create and update follow the contract", async () => {
  const usuario = { id: 8, username: "joao", name: "João Silva", email: "joao@udf.edu.br", role: "student", is_active: true, date_joined: "2026-01-01T00:00:00Z" };
  const { api, calls } = fixture(undefined, (url, opts) => {
    if (url.startsWith("/api/v1/users/?")) return json(200, [usuario]);
    if (url === "/api/v1/users/" && opts.method === "POST") return json(201, usuario);
    if (url === "/api/v1/users/8/") return json(200, { ...usuario, is_active: false });
    return null;
  });
  const lista = await api.users.list({ q: "jo", ativo: true, limite: 30 });
  assert.deepEqual(params(calls[0]), { q: "jo", is_active: "true", limit: "30" });
  assert.equal(lista[0].nome, "João Silva");
  assert.equal(lista[0].usuario, "joao");
  assert.equal(lista[0].perfil, "student");
  await api.users.create({ usuario: "joao", nome: "João Silva", email: "joao@udf.edu.br", perfil: "student", senha: "S3nha-forte!", matricula: "ignorada" });
  assert.deepEqual(corpo(calls.at(-1)), { username: "joao", name: "João Silva", email: "joao@udf.edu.br", role: "student", password: "S3nha-forte!" });
  const atualizado = await api.users.update(8, { ativo: false, usuario: "outro" });
  assert.equal(calls.at(-1).opts.method, "PATCH");
  assert.deepEqual(corpo(calls.at(-1)), { is_active: false });
  assert.equal(atualizado.ativo, false);
  assert.ok(escrita(calls).every((c) => c.opts.headers["X-CSRFToken"] === "before"));
});

test("booking list can ask staff scope", async () => {
  const { api, calls } = fixture();
  await api.bookings.list({ todas: true });
  assert.equal(params(calls[0]).scope, "all");
});

test("demonstration mode keeps keys, loans and users rules", async () => {
  const storage = new Map();
  const localStorage = { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const context = { window: { LABTECH: {}, addEventListener() {} }, document: { cookie: "" }, localStorage, URLSearchParams, Date, console, setTimeout, clearTimeout };
  vm.runInNewContext(seedSource, context);
  vm.runInNewContext(source, context);
  const L = context.window.LABTECH;
  await L.api.auth.login({ identifier: "rafael.nunes@udf.edu.br", password: "labtech", perfil: "employee" });
  const busca = await L.api.users.list({ q: "silva", ativo: true });
  assert.ok(busca.length > 0 && busca.every((u) => /silva/i.test(u.nome + u.email)));
  const livre = (await L.api.keys.list()).find((k) => k.status === "disponivel");
  assert.equal(livre.estado, "available");
  // chave em manutenção não pode ser retirada (KEY_UNAVAILABLE), como no contrato
  await L.api.auth.logout();
  await L.api.auth.login({ identifier: "ana.costa@udf.edu.br", password: "labtech", perfil: "admin" });
  await L.api.keys.update(livre.id, { estado: "maintenance" });
  const manut = (await L.api.keys.list()).find((k) => k.id === livre.id);
  assert.equal(manut.status, "manutencao");
  await assert.rejects(L.api.loans.checkout({ chave_id: livre.id, usuario_id: 4 }), (e) => e.code === "KEY_UNAVAILABLE");
  await L.api.keys.update(livre.id, { estado: "available" });
  const e = await L.api.loans.checkout({ chave_id: livre.id, usuario_id: 4 });
  assert.equal((await L.api.loans.list({ ativos: true, usuario_id: 4 })).some((x) => x.id === e.id), true);
});

test("student in demonstration mode can inspect occupancy but cannot access records or keys", async () => {
  const storage = new Map();
  const localStorage = { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const context = { window: { LABTECH: {}, addEventListener() {} }, document: { cookie: "" }, localStorage, URLSearchParams, Date, console, setTimeout, clearTimeout };
  vm.runInNewContext(seedSource, context);
  vm.runInNewContext(source, context);
  const api = context.window.LABTECH.api;
  await api.auth.login({ identifier: "joao.silva@udf.edu.br", password: "labtech", perfil: "student" });
  const salas = await api.spaces.list();
  assert.ok(salas.length > 0);
  assert.equal((await api.spaces.get(salas[0].id)).id, salas[0].id);
  const date = new Date(); date.setDate(date.getDate() + 45);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  const data = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  await api.spaces.availability(salas[0].id, { data, inicio: "10:00", fim: "11:00" });
  const agenda = await api.bookings.agenda(salas[0].id, { de: data, ate: data });
  assert.ok(agenda.every((row) => !("usuario_id" in row) && !("finalidade" in row)));
  for (const request of [
    () => api.bookings.list(), () => api.bookings.get(1), () => api.bookings.create({}), () => api.bookings.cancel(1),
    () => api.keys.list(), () => api.keys.loanAvailability(1), () => api.keys.movements(1),
    () => api.loans.list(), () => api.loans.checkout({}), () => api.loans.return(1), () => api.users.list()
  ]) await assert.rejects(request, (e) => e.status === 403 && e.code === "FORBIDDEN");
});

test("employee and admin can still create and cancel bookings in demonstration mode", async () => {
  const storage = new Map();
  const localStorage = { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const context = { window: { LABTECH: {}, addEventListener() {} }, document: { cookie: "" }, localStorage, URLSearchParams, Date, console, setTimeout, clearTimeout };
  vm.runInNewContext(seedSource, context);
  vm.runInNewContext(source, context);
  const api = context.window.LABTECH.api;
  const date = new Date(); date.setDate(date.getDate() + 45);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  const data = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  for (const [identifier, perfil] of [["rafael.nunes@udf.edu.br", "employee"], ["ana.costa@udf.edu.br", "admin"]]) {
    await api.auth.login({ identifier, password: "labtech", perfil });
    const sala = (await api.spaces.list()).find((s) => s.status !== "maintenance" && s.capacidade > 0);
    const reserva = await api.bookings.create({ sala_id: sala.id, data, inicio: perfil === "admin" ? "13:00" : "10:00", fim: perfil === "admin" ? "14:00" : "11:00", finalidade: "Atividade", participantes: 1 });
    assert.equal((await api.bookings.get(reserva.id)).id, reserva.id);
    assert.equal((await api.bookings.cancel(reserva.id)).status, "cancelada");
    await api.auth.logout();
  }
});

test("reservation pages reject the server-reported student role", async () => {
  for (const page of ["reservar-sala.html", "minhas-reservas.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", page), "utf8");
    assert.match(html, /data-roles="employee,admin"/);
    const redirects = [];
    const sessionStorage = { setItem() {}, getItem() { return null; }, removeItem() {} };
    const document = { readyState: "complete", body: { dataset: { roles: "employee,admin" } } };
    const location = { pathname: "/" + page, search: "", replace: (url) => redirects.push(url) };
    const L = { CONFIG: { modo: "api" }, api: { auth: { me: async () => ({ id: 7, perfil: "student", nome: "Aluno" }) } } };
    const context = { window: { LABTECH: L }, document, location, sessionStorage, localStorage: { getItem() { return null; } }, URLSearchParams, Date, console, setTimeout, clearTimeout };
    vm.runInNewContext(coreSource, context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(redirects, ["index.html"]);
    const principal = L.MENU.find((s) => s.secao === "Principal");
    assert.ok(principal.itens.filter((i) => !i.perfis || i.perfis.includes("student")).every((i) => !["reservar", "minhas-reservas"].includes(i.id)));
  }
});

test("student dashboard reads only spaces in API and demonstration modes", async () => {
  for (const modo of ["api", "mock"]) {
    const nodes = new Map();
    const makeNode = () => ({ innerHTML: "", textContent: "", href: "", closest() { return this; }, querySelector() { return makeNode(); } });
    const get = (id) => { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); };
    const document = { getElementById: get, querySelector: (sel) => sel.startsWith("#") ? get(sel.slice(1)) : makeNode() };
    const calls = [];
    const L = {
      pronto: Promise.resolve({ perfil: "student", nome: "João" }), CONFIG: { modo },
      pode: (...roles) => roles.includes("student"), primeiroNome: (name) => name.split(" ")[0],
      esc: String, tipoCover: () => ({ icon: "fa-solid fa-flask" }),
      api: { spaces: { list: async () => { calls.push("spaces"); return [{ id: 2, nome: "Laboratório", codigo: "LAB-02", tipo: "laboratorio" }]; } },
        bookings: { list: () => { calls.push("bookings"); throw new Error("bookings forbidden"); } },
        loans: { list: () => { calls.push("loans"); throw new Error("loans forbidden"); } } }
    };
    vm.runInNewContext(dashboardSource, { LABTECH: L, document, Date, console, encodeURIComponent });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, ["spaces"]);
    assert.equal(get("qtdReservas").textContent, 1);
    assert.equal(get("qtdReservas").href, "salas.html");
    assert.doesNotMatch([...nodes.values()].map((n) => n.innerHTML).join(" "), /reservar-sala\.html|minhas-reservas\.html|chaves\.html/);
  }
});

test("student room detail only reads the space and its availability", async () => {
  for (const modo of ["api", "mock"]) {
    const nodes = new Map();
    const node = (id) => {
      if (!nodes.has(id)) nodes.set(id, { innerHTML: "", textContent: "", value: "", addEventListener(type, listener) { this[type] = listener; }, setAttribute() {} });
      return nodes.get(id);
    };
    const calls = [];
    const sala = { id: 2, codigo: "LAB-02", nome: "Laboratório", tipo: "laboratorio", localizacao: "Bloco A", capacidade: 30 };
    const L = {
      pronto: Promise.resolve({ perfil: "student" }), CONFIG: { modo }, pode: (...roles) => roles.includes("student"), qs: () => "2",
      api: {
        spaces: {
          get: async () => { calls.push("space"); return sala; },
          availability: async () => { calls.push("availability"); return { available: true }; }
        },
        bookings: { list: () => { throw new Error("bookings forbidden"); } },
        keys: { list: () => { throw new Error("keys forbidden"); } }
      },
      esc: String, tipoCover: () => ({ cls: "cover-lab", icon: "fa-solid fa-flask" }),
      tipoLabel: () => "Laboratório", hojeISO: () => "2026-11-26"
    };
    const document = { getElementById: node, title: "" };
    vm.runInNewContext(detailSource, { LABTECH: L, window: { LABTECH: L }, document, parseInt, encodeURIComponent });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, ["space"]);
    assert.doesNotMatch(node("detail").innerHTML, /reservar-sala\.html|minhas-reservas\.html|chaves\.html/);
    await node("detConsultar").click();
    assert.deepEqual(calls, ["space", "availability"]);
    assert.match(node("detResultado").textContent, /disponível/);
  }
});
