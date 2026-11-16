/* ============================================================
   Camada de dados do LabReserva (única porta de entrada das telas).

   As telas NUNCA leem localStorage ou fazem fetch direto: sempre
   chamam LABTECH.api.<recurso>.<ação>(), que devolve uma Promise.

   Dois modos:
   - "mock" (padrão): dados de data/seed.js salvos no localStorage.
     Serve para apresentar e testar sem back-end.
   - "api": chama o Django em /api/v1/ (ver back-end/docs/API_CONTRATOS_MVP.md).
     Ative com  localStorage.setItem('labtech_api_modo', 'api')  ou mudando
     CONFIG.modo abaixo. A autenticação segue o contrato implementado
     (CSRF + sessão). Os demais endpoints ainda são PROPOSTAS no back-end:
     os nomes de campos são traduzidos nas funções de/para (deApi*) e
     podem precisar de ajuste quando o contrato for aprovado.

   Erros: sempre LABTECH.ApiError { status, code, message }.
   Códigos usados (iguais aos do contrato): BOOKING_CONFLICT,
   KEY_UNAVAILABLE, LOAN_ALREADY_RETURNED, INVALID_INTERVAL,
   NOT_FOUND, FORBIDDEN, UNAUTHENTICATED, VALIDATION.
   ============================================================ */
(function () {
  const L = (window.LABTECH = window.LABTECH || {});

  const CONFIG = (L.CONFIG = {
    modo: (function () { try { return localStorage.getItem("labtech_api_modo") || "mock"; } catch (e) { return "mock"; } })(),
    base: "/api/v1",
    senhaDemo: "labtech",
    horaAbertura: "07:00",
    horaFechamento: "22:00"
  });

  class ApiError extends Error {
    constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
  }
  L.ApiError = ApiError;

  /* ---------- utilidades de data ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const paraMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  // intervalos [início, fim): 10:00-11:00 e 11:00-12:00 NÃO conflitam (regra da PR #2 do back)
  const sobrepoe = (a, b) => a.data === b.data && paraMin(a.inicio) < paraMin(b.fim) && paraMin(b.inicio) < paraMin(a.fim);
  const ativa = (r) => r.status === "confirmada" || r.status === "pendente";

  /* ============================================================
     MODO MOCK
     ============================================================ */
  const DB_KEY = "labtech_db_v1";
  const SESSAO_KEY = "labtech_sessao";
  let cache = null;

  function db() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(DB_KEY) || "null"); } catch (e) { cache = null; }
    if (!cache || cache.versao !== 2) { cache = L.gerarSeed(); salvar(); }
    return cache;
  }
  // outra aba alterou os dados: descarta o cache para reler do localStorage
  window.addEventListener("storage", (e) => { if (e.key === DB_KEY) cache = null; });
  function salvar() { try { localStorage.setItem(DB_KEY, JSON.stringify(cache)); } catch (e) { /* modo privado: segue em memória */ } }
  const proxId = (lista) => lista.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const atraso = (v) => new Promise((ok) => setTimeout(() => ok(copia(v)), 120)); // simula rede
  const falha = (status, code, message, details) => Promise.reject(new ApiError(status, code, message, details));

  function sessao() { try { return JSON.parse(localStorage.getItem(SESSAO_KEY) || "null"); } catch (e) { return null; } }
  function exigeSessao(perfis) {
    const s = sessao();
    if (!s) throw new ApiError(401, "UNAUTHENTICATED", "Faça login para continuar.");
    if (perfis && !perfis.includes(s.perfil)) throw new ApiError(403, "FORBIDDEN", "Seu perfil não tem permissão para esta ação.");
    return s;
  }
  const GESTAO = ["employee", "admin"];
  const ADMIN = ["admin"];

  // Situação da sala agora: manutenção > ocupada (reserva em andamento) > livre
  function statusSala(sala, d) {
    if (sala.manutencao) return "maintenance";
    const agora = new Date();
    const hoje = isoDia(agora), min = agora.getHours() * 60 + agora.getMinutes();
    const emUso = d.reservas.some((r) => r.sala_id === sala.id && ativa(r) && r.data === hoje && paraMin(r.inicio) <= min && min < paraMin(r.fim));
    return emUso ? "occupied" : "available";
  }
  function proximoLivre(sala, d) {
    if (sala.manutencao) return sala.previsaoManutencao || "Em manutenção";
    const agora = new Date(); const hoje = isoDia(agora); let min = agora.getHours() * 60 + agora.getMinutes();
    const doDia = d.reservas.filter((r) => r.sala_id === sala.id && ativa(r) && r.data === hoje).sort((a, b) => paraMin(a.inicio) - paraMin(b.inicio));
    let mudou = false;
    doDia.forEach((r) => { if (paraMin(r.inicio) <= min && min < paraMin(r.fim)) { min = paraMin(r.fim); mudou = true; } });
    if (!mudou) return "Agora";
    if (min >= paraMin(CONFIG.horaFechamento)) return "Amanhã, " + CONFIG.horaAbertura;
    return `Hoje, ${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  }
  function emprestimoAtivo(chaveId, d) { return d.emprestimos.find((e) => e.chave_id === chaveId && !e.devolvida_em) || null; }
  function statusChave(c, d) { if (!c.ativo) return "inativa"; return emprestimoAtivo(c.id, d) ? "emprestada" : "disponivel"; }

  function salaCompleta(s, d) {
    const chaves = d.chaves.filter((c) => c.sala_id === s.id);
    const chaveDisp = chaves.find((c) => statusChave(c, d) === "disponivel");
    return {
      ...s, status: statusSala(s, d), proximoLivre: proximoLivre(s, d),
      chave: { local: s.localChave, status: !chaves.length || chaves.every((c) => !c.ativo) ? "nao_aplica" : chaveDisp ? "disponivel" : "retirada", total: chaves.length }
    };
  }
  function usuarioPublico(u) { if (!u) return null; const { senha, ...resto } = u; return resto; }
  function reservaCompleta(r, d) {
    const s = d.salas.find((x) => x.id === r.sala_id); const u = d.usuarios.find((x) => x.id === r.usuario_id);
    let status = r.status;
    if (ativa(r) && new Date(`${r.data}T${r.fim}`) <= new Date()) status = r.status === "confirmada" ? "concluida" : status;
    return { ...r, situacao: status, sala: s ? { id: s.id, codigo: s.codigo, nome: s.nome, tipo: s.tipo, bloco: s.bloco } : null, usuario: u ? { id: u.id, nome: u.nome } : null };
  }
  function emprestimoCompleto(e, d) {
    const c = d.chaves.find((x) => x.id === e.chave_id); const s = c && d.salas.find((x) => x.id === c.sala_id);
    const u = d.usuarios.find((x) => x.id === e.usuario_id); const r = d.usuarios.find((x) => x.id === e.registrado_por);
    return { ...e, chave: c ? { id: c.id, codigo: c.codigo } : null, sala: s ? { id: s.id, codigo: s.codigo, nome: s.nome } : null,
      usuario: u ? { id: u.id, nome: u.nome, matricula: u.matricula } : null, registrado_por_nome: r ? r.nome : "" };
  }
  function validaIntervalo(p) {
    if (!p.data || !/^\d{4}-\d{2}-\d{2}$/.test(p.data)) throw new ApiError(400, "VALIDATION", "Informe a data.");
    if (!p.inicio || !p.fim) throw new ApiError(400, "VALIDATION", "Informe início e término.");
    if (paraMin(p.inicio) >= paraMin(p.fim)) throw new ApiError(400, "INVALID_INTERVAL", "O início deve ser anterior ao término.");
    if (paraMin(p.inicio) < paraMin(CONFIG.horaAbertura) || paraMin(p.fim) > paraMin(CONFIG.horaFechamento))
      throw new ApiError(400, "INVALID_INTERVAL", `Horário de funcionamento: ${CONFIG.horaAbertura} às ${CONFIG.horaFechamento}.`);
    if (new Date(p.data + "T12:00:00").getDay() === 0) throw new ApiError(400, "INVALID_INTERVAL", "Domingo o campus está fechado.");
  }

  const mock = {
    auth: {
      async login({ identifier, password, perfil }) {
        const d = db();
        const id = String(identifier || "").trim().toLowerCase();
        const u = d.usuarios.find((x) => x.email.toLowerCase() === id || String(x.matricula).toLowerCase() === id);
        if (!u || password !== (u.senha || CONFIG.senhaDemo)) return falha(401, "UNAUTHENTICATED", "E-mail ou senha inválidos.");
        if (!u.ativo) return falha(401, "UNAUTHENTICATED", "Usuário inativo. Procure o administrador.");
        if (perfil && perfil !== u.perfil) return falha(403, "FORBIDDEN", `Este usuário não tem o perfil "${L.PERFIS[perfil]}".`);
        const s = usuarioPublico(u);
        localStorage.setItem(SESSAO_KEY, JSON.stringify(s));
        return atraso({ user: s });
      },
      async logout() { localStorage.removeItem(SESSAO_KEY); return atraso({ status: "signed_out" }); },
      async me() { const s = sessao(); if (!s) return falha(403, "UNAUTHENTICATED", "Sem sessão."); return atraso(s); }
    },

    users: {
      async list() { exigeSessao(GESTAO); return atraso(db().usuarios.map(usuarioPublico)); },
      async create(dados) {
        exigeSessao(ADMIN); const d = db();
        if (!dados.nome || !dados.email) return falha(400, "VALIDATION", "Nome e e-mail são obrigatórios.");
        if (d.usuarios.some((u) => u.email.toLowerCase() === dados.email.toLowerCase())) return falha(409, "DUPLICATE", "Já existe usuário com este e-mail.");
        const u = { id: proxId(d.usuarios), nome: dados.nome, email: dados.email, matricula: dados.matricula || "", perfil: dados.perfil || "student", ativo: dados.ativo !== false };
        d.usuarios.push(u); salvar(); return atraso(usuarioPublico(u));
      },
      async update(id, patch) {
        const s = exigeSessao(ADMIN); const d = db(); const u = d.usuarios.find((x) => x.id === Number(id));
        if (!u) return falha(404, "NOT_FOUND", "Usuário não encontrado.");
        if (patch.email && d.usuarios.some((x) => x.id !== u.id && x.email.toLowerCase() === patch.email.toLowerCase())) return falha(409, "DUPLICATE", "Já existe usuário com este e-mail.");
        if (u.id === s.id && (patch.ativo === false || (patch.perfil && patch.perfil !== "admin"))) return falha(409, "SELF_LOCK", "Você não pode desativar nem rebaixar o próprio usuário.");
        Object.assign(u, patch); salvar(); return atraso(usuarioPublico(u));
      }
    },

    spaces: {
      async list() { exigeSessao(); const d = db(); return atraso(d.salas.filter((s) => s.ativo !== false).map((s) => salaCompleta(s, d))); },
      async listAll() { exigeSessao(ADMIN); const d = db(); return atraso(d.salas.map((s) => salaCompleta(s, d))); },
      async get(id) { exigeSessao(); const d = db(); const s = d.salas.find((x) => x.id === Number(id)); if (!s) return falha(404, "NOT_FOUND", "Sala não encontrada."); return atraso(salaCompleta(s, d)); },
      async create(dados) {
        exigeSessao(ADMIN); const d = db();
        if (!dados.codigo || !dados.nome) return falha(400, "VALIDATION", "Código e nome são obrigatórios.");
        if (d.salas.some((s) => s.codigo.toLowerCase() === dados.codigo.toLowerCase())) return falha(409, "DUPLICATE", "Já existe sala com este código.");
        const s = { id: proxId(d.salas), recursos: [], qtd: {}, softwares: [], regras: [], descricao: "", responsavel: "", localChave: "", manutencao: false, previsaoManutencao: "", andar: 0, ativo: true, ...dados };
        d.salas.push(s); salvar(); return atraso(salaCompleta(s, d));
      },
      async update(id, patch) {
        exigeSessao(ADMIN); const d = db(); const s = d.salas.find((x) => x.id === Number(id));
        if (!s) return falha(404, "NOT_FOUND", "Sala não encontrada.");
        if (patch.codigo && d.salas.some((x) => x.id !== s.id && x.codigo.toLowerCase() === patch.codigo.toLowerCase())) return falha(409, "DUPLICATE", "Já existe sala com este código.");
        Object.assign(s, patch); salvar(); return atraso(salaCompleta(s, d));
      },
      // Disponibilidade de horário da SALA (não confundir com disponibilidade de CHAVE)
      async availability(id, { data, inicio, fim }) {
        exigeSessao(); validaIntervalo({ data, inicio, fim }); const d = db(); const s = d.salas.find((x) => x.id === Number(id));
        if (!s) return falha(404, "NOT_FOUND", "Sala não encontrada.");
        const livre = !s.manutencao && !d.reservas.some((r) => r.sala_id === s.id && ativa(r) && sobrepoe(r, { data, inicio, fim }));
        return atraso({ space_id: s.id, data, inicio, fim, available: livre });
      }
    },

    bookings: {
      // filtros: { sala_id, mine, de, ate, incluirCanceladas }
      async list(f = {}) {
        const s = exigeSessao(); const d = db();
        let lista = d.reservas.slice();
        if (f.sala_id) lista = lista.filter((r) => r.sala_id === Number(f.sala_id));
        if (f.mine) lista = lista.filter((r) => r.usuario_id === s.id);
        if (f.de) lista = lista.filter((r) => r.data >= f.de);
        if (f.ate) lista = lista.filter((r) => r.data <= f.ate);
        if (!f.incluirCanceladas) lista = lista.filter((r) => r.status !== "cancelada");
        lista.sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
        return atraso(lista.map((r) => reservaCompleta(r, d)));
      },
      async get(id) { exigeSessao(); const d = db(); const r = d.reservas.find((x) => x.id === Number(id)); if (!r) return falha(404, "NOT_FOUND", "Reserva não encontrada."); return atraso(reservaCompleta(r, d)); },
      async create(p) {
        const s = exigeSessao(); const d = db();
        validaIntervalo(p);
        const sala = d.salas.find((x) => x.id === Number(p.sala_id));
        if (!sala) return falha(404, "NOT_FOUND", "Sala não encontrada.");
        if (sala.manutencao) return falha(409, "SPACE_UNAVAILABLE", "Sala em manutenção.");
        if (new Date(`${p.data}T${p.inicio}`) < new Date()) return falha(400, "INVALID_INTERVAL", "Escolha um horário futuro.");
        if (!p.finalidade || !String(p.finalidade).trim()) return falha(400, "VALIDATION", "Informe a finalidade.");
        const part = Number(p.participantes || 1);
        if (part < 1 || part > sala.capacidade) return falha(400, "VALIDATION", `A sala comporta até ${sala.capacidade} pessoas.`);
        const conflito = d.reservas.find((r) => r.sala_id === sala.id && ativa(r) && sobrepoe(r, p));
        if (conflito) return falha(409, "BOOKING_CONFLICT", `Horário indisponível: já existe reserva das ${conflito.inicio} às ${conflito.fim}.`, { space_id: sala.id });
        const r = { id: proxId(d.reservas), sala_id: sala.id, usuario_id: s.id, data: p.data, inicio: p.inicio, fim: p.fim, finalidade: String(p.finalidade).trim(), participantes: part, status: "confirmada", criada_em: new Date().toISOString() };
        d.reservas.push(r); salvar(); return atraso(reservaCompleta(r, d));
      },
      async cancel(id) {
        const s = exigeSessao(); const d = db(); const r = d.reservas.find((x) => x.id === Number(id));
        if (!r) return falha(404, "NOT_FOUND", "Reserva não encontrada.");
        if (r.usuario_id !== s.id && !GESTAO.includes(s.perfil)) return falha(403, "FORBIDDEN", "Só o titular ou a gestão podem cancelar.");
        if (r.status === "cancelada") return falha(409, "ALREADY_CANCELLED", "Reserva já cancelada.");
        if (new Date(`${r.data}T${r.fim}`) <= new Date()) return falha(409, "BOOKING_FINISHED", "Reserva já encerrada.");
        r.status = "cancelada"; r.cancelada_em = new Date().toISOString(); salvar(); return atraso(reservaCompleta(r, d));
      }
    },

    keys: {
      async list() {
        exigeSessao(); const d = db();
        return atraso(d.chaves.map((c) => {
          const s = d.salas.find((x) => x.id === c.sala_id); const e = emprestimoAtivo(c.id, d);
          return { ...c, status: statusChave(c, d), sala: s ? { id: s.id, codigo: s.codigo, nome: s.nome, bloco: s.bloco } : null, emprestimo: e ? emprestimoCompleto(e, d) : null };
        }));
      },
      async create(dados) {
        exigeSessao(ADMIN); const d = db();
        if (!dados.codigo || !dados.sala_id) return falha(400, "VALIDATION", "Código e sala são obrigatórios.");
        if (!d.salas.some((s) => s.id === Number(dados.sala_id))) return falha(404, "NOT_FOUND", "Sala não encontrada.");
        if (d.chaves.some((c) => c.codigo.toLowerCase() === dados.codigo.toLowerCase())) return falha(409, "DUPLICATE", "Já existe chave com este código.");
        const c = { id: proxId(d.chaves), codigo: dados.codigo, sala_id: Number(dados.sala_id), local: dados.local || "", ativo: dados.ativo !== false, observacao: dados.observacao || "" };
        d.chaves.push(c); salvar(); return atraso(c);
      },
      async update(id, patch) {
        exigeSessao(ADMIN); const d = db(); const c = d.chaves.find((x) => x.id === Number(id));
        if (!c) return falha(404, "NOT_FOUND", "Chave não encontrada.");
        if (patch.ativo === false && emprestimoAtivo(c.id, d)) return falha(409, "KEY_UNAVAILABLE", "Registre a devolução antes de desativar a chave.");
        if (patch.sala_id != null) patch.sala_id = Number(patch.sala_id);
        Object.assign(c, patch); salvar(); return atraso(c);
      },
      // UC007: só informa se há empréstimo ativo (igual ao contrato)
      async loanAvailability(id) { exigeSessao(); const d = db(); const c = d.chaves.find((x) => x.id === Number(id)); if (!c) return falha(404, "NOT_FOUND", "Chave não encontrada."); return atraso({ key_id: c.id, has_active_loan: !!emprestimoAtivo(c.id, d) }); },
      // UC008: movimentações (retiradas e devoluções) da chave
      async movements(id) {
        exigeSessao(GESTAO); const d = db(); const c = d.chaves.find((x) => x.id === Number(id));
        if (!c) return falha(404, "NOT_FOUND", "Chave não encontrada.");
        const eventos = [];
        d.emprestimos.filter((e) => e.chave_id === c.id).forEach((e) => {
          const ec = emprestimoCompleto(e, d);
          eventos.push({ tipo: "retirada", emprestimo_id: e.id, ocorrido_em: e.retirada_em, usuario: ec.usuario, registrado_por_nome: ec.registrado_por_nome });
          if (e.devolvida_em) eventos.push({ tipo: "devolucao", emprestimo_id: e.id, ocorrido_em: e.devolvida_em, usuario: ec.usuario, registrado_por_nome: ec.registrado_por_nome });
        });
        eventos.sort((a, b) => b.ocorrido_em.localeCompare(a.ocorrido_em));
        return atraso({ key_id: c.id, eventos });
      }
    },

    loans: {
      // filtros: { ativos, chave_id }
      async list(f = {}) {
        exigeSessao(GESTAO); const d = db(); let lista = d.emprestimos.slice();
        if (f.ativos) lista = lista.filter((e) => !e.devolvida_em);
        if (f.chave_id) lista = lista.filter((e) => e.chave_id === Number(f.chave_id));
        lista.sort((a, b) => (b.devolvida_em || b.retirada_em).localeCompare(a.devolvida_em || a.retirada_em));
        return atraso(lista.map((e) => emprestimoCompleto(e, d)));
      },
      // UC005: entrega (retirada) da chave
      async checkout({ chave_id, usuario_id }) {
        const s = exigeSessao(GESTAO); const d = db();
        const c = d.chaves.find((x) => x.id === Number(chave_id)); const u = d.usuarios.find((x) => x.id === Number(usuario_id));
        if (!c) return falha(404, "NOT_FOUND", "Chave não encontrada.");
        if (!u) return falha(404, "NOT_FOUND", "Usuário não encontrado.");
        if (!u.ativo) return falha(409, "USER_INACTIVE", "Usuário inativo não pode retirar chave.");
        if (!c.ativo) return falha(409, "KEY_UNAVAILABLE", "Chave inativa.");
        if (emprestimoAtivo(c.id, d)) return falha(409, "KEY_UNAVAILABLE", "Chave com empréstimo ativo.", { key_id: c.id });
        const e = { id: proxId(d.emprestimos), chave_id: c.id, usuario_id: u.id, registrado_por: s.id, retirada_em: new Date().toISOString(), devolvida_em: null };
        d.emprestimos.push(e); salvar(); return atraso(emprestimoCompleto(e, d));
      },
      // UC006: devolução
      async return(id) {
        exigeSessao(GESTAO); const d = db(); const e = d.emprestimos.find((x) => x.id === Number(id));
        if (!e) return falha(404, "NOT_FOUND", "Empréstimo não encontrado.");
        if (e.devolvida_em) return falha(409, "LOAN_ALREADY_RETURNED", "Empréstimo já encerrado.");
        e.devolvida_em = new Date().toISOString(); salvar(); return atraso(emprestimoCompleto(e, d));
      }
    },

    demo: {
      reset() { cache = L.gerarSeed(); salvar(); return atraso({ ok: true }); }
    }
  };

  /* ============================================================
     MODO API (Django). Mesmas funções, chamando /api/v1/.
     ============================================================ */
  function cookie(nome) { const m = document.cookie.match(new RegExp("(?:^|; )" + nome + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : ""; }
  async function http(metodo, caminho, corpo) {
    const opts = { method: metodo, credentials: "same-origin", headers: { Accept: "application/json" } };
    if (metodo !== "GET") {
      if (!cookie("csrftoken")) await fetch(CONFIG.base + "/auth/csrf/", { credentials: "same-origin" });
      opts.headers["Content-Type"] = "application/json";
      opts.headers["X-CSRFToken"] = cookie("csrftoken");
      opts.body = JSON.stringify(corpo || {});
    }
    const resp = await fetch(CONFIG.base + caminho, opts);
    const texto = await resp.text(); let json = null; try { json = texto ? JSON.parse(texto) : null; } catch (e) { /* sem JSON */ }
    if (!resp.ok) {
      const err = (json && json.error) || {};
      throw new ApiError(resp.status, err.code || (resp.status === 401 ? "UNAUTHENTICATED" : resp.status === 403 ? "FORBIDDEN" : "HTTP_" + resp.status),
        err.message || (typeof json?.error === "string" ? json.error : "") || "Não foi possível concluir a operação.", err.details);
    }
    return json;
  }
  const qs = (o) => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, v); }); const s = p.toString(); return s ? "?" + s : ""; };
  const tz = () => { const o = -new Date().getTimezoneOffset(); return (o >= 0 ? "+" : "-") + pad(Math.floor(Math.abs(o) / 60)) + ":" + pad(Math.abs(o) % 60); };
  const isoHora = (data, hhmm) => `${data}T${hhmm}:00${tz()}`;
  const separar = (iso) => { const d = new Date(iso); return { data: isoDia(d), hora: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };

  // Tradução API (inglês, contrato) -> modelo do front (português). Ajustar aqui quando o contrato fechar.
  const deApiSala = (s) => ({ id: s.id, codigo: s.code, nome: s.name || s.code, tipo: s.kind === "laboratory" ? "laboratorio" : (s.kind || "sala"), bloco: s.block || "", andar: s.floor ?? 0,
    capacidade: s.capacity ?? 0, manutencao: s.status === "maintenance", status: s.status || "available", recursos: s.resources || [], qtd: {}, softwares: s.softwares || [],
    responsavel: s.responsible || "", descricao: s.description || "", regras: s.rules || [], proximoLivre: s.next_free || "", chave: { local: s.key_location || "", status: "disponivel" }, ativo: s.active !== false });
  const paraApiSala = (s) => ({ code: s.codigo, name: s.nome, kind: s.tipo === "laboratorio" ? "laboratory" : s.tipo, block: s.bloco, floor: s.andar, capacity: s.capacidade,
    status: s.manutencao ? "maintenance" : "available", resources: s.recursos, description: s.descricao, rules: s.regras, responsible: s.responsavel, active: s.ativo });
  const deApiReserva = (b) => { const i = separar(b.start_at), f = separar(b.end_at); return { id: b.id, sala_id: b.space_id, usuario_id: b.user_id, data: i.data, inicio: i.hora, fim: f.hora,
    finalidade: b.purpose || "", participantes: b.attendees || 1, criada_em: b.created_at || null, cancelada_em: b.cancelled_at || null, status: b.status === "cancelled" ? "cancelada" : "confirmada", situacao: b.status === "cancelled" ? "cancelada" : "confirmada",
    sala: b.space ? deApiSala(b.space) : null, usuario: b.user ? { id: b.user.id, nome: b.user.name } : null }; };
  const deApiChave = (k) => ({ id: k.id, codigo: k.code || String(k.id), sala_id: k.space_id, local: k.location || "", ativo: k.active !== false, observacao: k.notes || "",
    status: k.active === false ? "inativa" : k.has_active_loan ? "emprestada" : "disponivel", sala: k.space ? { id: k.space.id, codigo: k.space.code, nome: k.space.name } : null, emprestimo: null });
  const deApiEmprestimo = (l) => ({ id: l.id, chave_id: l.key_id, usuario_id: l.responsible_user_id, retirada_em: l.checked_out_at, devolvida_em: l.returned_at || null, chave: null, sala: null, usuario: null });
  const deApiUsuario = (u) => ({ id: u.id, nome: u.name || u.username || "", email: u.email || "", matricula: u.registration || "", perfil: u.role || "student", ativo: u.is_active !== false });

  const api = {
    auth: {
      async login({ identifier, password }) {
        await http("GET", "/auth/csrf/");
        const r = await http("POST", "/auth/login/", { identifier, password });
        // o contrato atual devolve só {user:{id}}; nome/perfil virão quando o banco existir
        const s = { id: r.user.id, nome: identifier, email: identifier, perfil: r.user.role || "student", ...r.user };
        localStorage.setItem(SESSAO_KEY, JSON.stringify(s)); return { user: s };
      },
      async logout() { try { await http("POST", "/auth/logout/", {}); } finally { localStorage.removeItem(SESSAO_KEY); } return { status: "signed_out" }; },
      async me() { const r = await http("GET", "/auth/me/"); return { ...(sessao() || {}), ...r }; }
    },
    users: {
      async list() { return (await http("GET", "/users/")).map(deApiUsuario); },
      async create(u) { return deApiUsuario(await http("POST", "/users/", { name: u.nome, email: u.email, registration: u.matricula, role: u.perfil, is_active: u.ativo })); },
      async update(id, p) { return deApiUsuario(await http("PATCH", `/users/${id}/`, { name: p.nome, email: p.email, registration: p.matricula, role: p.perfil, is_active: p.ativo })); }
    },
    spaces: {
      async list() { return (await http("GET", "/spaces/")).map(deApiSala); },
      async listAll() { return (await http("GET", "/spaces/?include_inactive=1")).map(deApiSala); },
      async get(id) { return deApiSala(await http("GET", `/spaces/${id}/`)); },
      async create(s) { return deApiSala(await http("POST", "/spaces/", paraApiSala(s))); },
      async update(id, s) { return deApiSala(await http("PATCH", `/spaces/${id}/`, paraApiSala(s))); },
      async availability(id, { data, inicio, fim }) { const r = await http("GET", `/spaces/${id}/booking-availability/` + qs({ start_at: isoHora(data, inicio), end_at: isoHora(data, fim) })); return { space_id: id, data, inicio, fim, available: r.available }; }
    },
    bookings: {
      async list(f = {}) { return (await http("GET", "/bookings/" + qs({ space_id: f.sala_id, mine: f.mine ? 1 : "", include_cancelled: f.incluirCanceladas ? 1 : "", start_at: f.de ? isoHora(f.de, "00:00") : "", end_at: f.ate ? isoHora(f.ate, "23:59") : "" }))).map(deApiReserva); },
      async get(id) { return deApiReserva(await http("GET", `/bookings/${id}/`)); },
      async create(p) { return deApiReserva(await http("POST", "/bookings/", { space_id: p.sala_id, start_at: isoHora(p.data, p.inicio), end_at: isoHora(p.data, p.fim), purpose: p.finalidade, attendees: p.participantes })); },
      async cancel(id) { return http("POST", `/bookings/${id}/cancel/`, {}); }
    },
    keys: {
      async list() { return (await http("GET", "/keys/")).map(deApiChave); },
      async create(c) { return deApiChave(await http("POST", "/keys/", { code: c.codigo, space_id: c.sala_id, location: c.local, active: c.ativo, notes: c.observacao })); },
      async update(id, c) { return deApiChave(await http("PATCH", `/keys/${id}/`, { code: c.codigo, space_id: c.sala_id, location: c.local, active: c.ativo, notes: c.observacao })); },
      async loanAvailability(id) { return http("GET", `/keys/${id}/loan-availability/`); },
      async movements(id) { const r = await http("GET", `/keys/${id}/movements/`); return { key_id: r.key_id, eventos: (r.events || []).map((e) => ({ tipo: e.type === "return" ? "devolucao" : "retirada", emprestimo_id: e.loan_id, ocorrido_em: e.occurred_at, usuario: null })) }; }
    },
    loans: {
      async list(f = {}) { return (await http("GET", "/key-loans/" + qs({ active: f.ativos ? 1 : "", key_id: f.chave_id }))).map(deApiEmprestimo); },
      async checkout({ chave_id, usuario_id }) { return deApiEmprestimo(await http("POST", "/key-loans/", { key_id: chave_id, responsible_user_id: usuario_id })); },
      async return(id) { return deApiEmprestimo(await http("POST", `/key-loans/${id}/return/`, {})); }
    },
    demo: { reset() { return Promise.resolve({ ok: false }); } }
  };

  L.api = CONFIG.modo === "api" ? api : mock;
  L.sessaoAtual = sessao;
})();
