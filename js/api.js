/* ============================================================
   Camada de dados do LabReserva (única porta de entrada das telas).

   As telas NUNCA leem localStorage ou fazem fetch direto: sempre
   chamam LABTECH.api.<recurso>.<ação>(), que devolve uma Promise.

   Dois modos:
   - "mock" (padrão): dados de data/seed.js salvos no localStorage.
     Serve para apresentar e testar sem back-end.
   - "api": chama o Django em /api/v1/ (ver back-end/docs/GUIA_FRONTEND_MVP.md).
     Ative com  localStorage.setItem('labtech_api_modo', 'api')  ou mudando
     CONFIG.modo abaixo. Sessão, perfis (/auth/me/ com role), usuários,
     espaços, chaves, empréstimos e reservas seguem o contrato combinado
     da etapa final. As telas recebem sempre os mesmos campos em português
     nos dois modos (funções deApi* e paraApi*).

   Erros: sempre LABTECH.ApiError { status, code, message }.
   Códigos usados (iguais aos do contrato): BOOKING_CONFLICT,
   KEY_UNAVAILABLE, LOAN_ALREADY_RETURNED, INVALID_INTERVAL,
   NOT_FOUND, FORBIDDEN, UNAUTHENTICATED, VALIDATION.
   ============================================================ */
(function () {
  const L = (window.LABTECH = window.LABTECH || {});

  const CONFIG = (L.CONFIG = {
    // Publicado (fora do PC local) já abre ligado ao Django; localmente segue em demonstração.
    // localStorage "labtech_api_modo" continua valendo para forçar um dos dois modos.
    modo: (function () {
      const local = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(typeof location === "undefined" ? "" : location.hostname);
      const padrao = local ? "mock" : "api";
      try { return localStorage.getItem("labtech_api_modo") || padrao; } catch (e) { return padrao; }
    })(),
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
  // estado administrativo da chave (igual ao campo status da API): available | maintenance | lost | inactive
  const estadoChave = (c) => (c.ativo === false ? "inactive" : c.estado || "available");
  // situação mostrada nas telas: empréstimo ativo tem prioridade sobre o estado administrativo
  const SITUACAO_ESTADO = { available: "disponivel", maintenance: "manutencao", lost: "perdida", inactive: "inativa" };
  function statusChave(c, d) { if (emprestimoAtivo(c.id, d)) return "emprestada"; return SITUACAO_ESTADO[estadoChave(c)] || "inativa"; }

  function salaCompleta(s, d) {
    const chaves = d.chaves.filter((c) => c.sala_id === s.id);
    const chaveDisp = chaves.find((c) => statusChave(c, d) === "disponivel");
    return {
      ...s, status: statusSala(s, d), proximoLivre: proximoLivre(s, d),
      chave: { local: s.localChave, status: !chaves.length || chaves.every((c) => c.ativo === false) ? "nao_aplica" : chaveDisp ? "disponivel" : "retirada", total: chaves.length }
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
      // filtros: { q, perfil, ativo, limite } (mesmos da API: q, role, is_active, limit)
      async list(f = {}) {
        exigeSessao(GESTAO);
        const termo = String(f.q || "").trim().toLowerCase();
        let lista = db().usuarios.filter((u) => (!termo || [u.nome, u.email, u.matricula, u.usuario].join(" ").toLowerCase().includes(termo))
          && (!f.perfil || u.perfil === f.perfil) && (f.ativo == null || u.ativo === f.ativo));
        lista = lista.slice().sort((a, b) => a.nome.localeCompare(b.nome));
        if (f.limite) lista = lista.slice(0, f.limite);
        return atraso(lista.map(usuarioPublico));
      },
      async create(dados) {
        exigeSessao(ADMIN); const d = db();
        if (!dados.nome || !dados.email) return falha(400, "VALIDATION", "Nome e e-mail são obrigatórios.");
        if (d.usuarios.some((u) => u.email.toLowerCase() === dados.email.toLowerCase())) return falha(409, "DUPLICATE", "Já existe usuário com este e-mail.");
        const u = { id: proxId(d.usuarios), nome: dados.nome, email: dados.email, matricula: dados.matricula || "", usuario: dados.usuario || "", perfil: dados.perfil || "student", ativo: dados.ativo !== false };
        if (dados.senha) u.senha = dados.senha;
        d.usuarios.push(u); salvar(); return atraso(usuarioPublico(u));
      },
      async update(id, patch) {
        const s = exigeSessao(ADMIN); const d = db(); const u = d.usuarios.find((x) => x.id === Number(id));
        if (!u) return falha(404, "NOT_FOUND", "Usuário não encontrado.");
        if (patch.email && d.usuarios.some((x) => x.id !== u.id && x.email.toLowerCase() === patch.email.toLowerCase())) return falha(409, "DUPLICATE", "Já existe usuário com este e-mail.");
        if (u.id === s.id && (patch.ativo === false || (patch.perfil && patch.perfil !== "admin"))) return falha(409, "SELF_LOCK", "Você não pode desativar nem rebaixar o próprio usuário.");
        const { senha, ...resto } = patch;
        Object.assign(u, resto); if (senha) u.senha = senha; salvar(); return atraso(usuarioPublico(u));
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
        const s = exigeSessao(GESTAO); const d = db();
        let lista = d.reservas.slice();
        if (f.sala_id) lista = lista.filter((r) => r.sala_id === Number(f.sala_id));
        if (f.mine) lista = lista.filter((r) => r.usuario_id === s.id);
        if (f.de) lista = lista.filter((r) => r.data >= f.de);
        if (f.ate) lista = lista.filter((r) => r.data <= f.ate);
        if (!f.incluirCanceladas) lista = lista.filter((r) => r.status !== "cancelada");
        lista.sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
        return atraso(lista.map((r) => reservaCompleta(r, d)));
      },
      async agenda(id, { de, ate }) {
        exigeSessao(); const d = db();
        return atraso(d.reservas.filter((r) => r.sala_id === Number(id) && ativa(r) && r.data >= de && r.data <= ate)
          .map((r) => ({ sala_id: r.sala_id, data: r.data, inicio: r.inicio, fim: r.fim, status: "confirmada", situacao: "confirmada" })));
      },
      async get(id) { exigeSessao(GESTAO); const d = db(); const r = d.reservas.find((x) => x.id === Number(id)); if (!r) return falha(404, "NOT_FOUND", "Reserva não encontrada."); return atraso(reservaCompleta(r, d)); },
      async create(p) {
        const s = exigeSessao(GESTAO); const d = db();
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
        const s = exigeSessao(GESTAO); const d = db(); const r = d.reservas.find((x) => x.id === Number(id));
        if (!r) return falha(404, "NOT_FOUND", "Reserva não encontrada.");
        if (r.usuario_id !== s.id && !GESTAO.includes(s.perfil)) return falha(403, "FORBIDDEN", "Só o titular ou a gestão podem cancelar.");
        if (r.status === "cancelada") return falha(409, "ALREADY_CANCELLED", "Reserva já cancelada.");
        if (new Date(`${r.data}T${r.fim}`) <= new Date()) return falha(409, "BOOKING_FINISHED", "Reserva já encerrada.");
        r.status = "cancelada"; r.cancelada_em = new Date().toISOString(); salvar(); return atraso(reservaCompleta(r, d));
      }
    },

    keys: {
      // filtros: { sala_id }
      async list(f = {}) {
        exigeSessao(GESTAO); const d = db();
        return atraso(d.chaves.filter((c) => !f.sala_id || c.sala_id === Number(f.sala_id)).map((c) => {
          const s = d.salas.find((x) => x.id === c.sala_id); const e = emprestimoAtivo(c.id, d);
          return { ...c, estado: estadoChave(c), status: statusChave(c, d), sala: s ? { id: s.id, codigo: s.codigo, nome: s.nome, bloco: s.bloco } : null, emprestimo: e ? emprestimoCompleto(e, d) : null };
        }));
      },
      async create(dados) {
        exigeSessao(ADMIN); const d = db();
        if (!dados.codigo || !dados.sala_id) return falha(400, "VALIDATION", "Código e sala são obrigatórios.");
        if (!d.salas.some((s) => s.id === Number(dados.sala_id))) return falha(404, "NOT_FOUND", "Sala não encontrada.");
        if (d.chaves.some((c) => c.codigo.toLowerCase() === dados.codigo.toLowerCase())) return falha(409, "DUPLICATE", "Já existe chave com este código.");
        const estado = dados.estado || (dados.ativo === false ? "inactive" : "available");
        const c = { id: proxId(d.chaves), codigo: dados.codigo, sala_id: Number(dados.sala_id), local: dados.local || "", estado, ativo: estado !== "inactive", observacao: dados.observacao || "" };
        d.chaves.push(c); salvar(); return atraso(c);
      },
      async update(id, patch) {
        exigeSessao(ADMIN); const d = db(); const c = d.chaves.find((x) => x.id === Number(id));
        if (!c) return falha(404, "NOT_FOUND", "Chave não encontrada.");
        patch = { ...patch };
        if (patch.estado) patch.ativo = patch.estado !== "inactive";
        else if (patch.ativo != null) patch.estado = patch.ativo ? "available" : "inactive";
        if (patch.ativo === false && emprestimoAtivo(c.id, d)) return falha(409, "KEY_UNAVAILABLE", "Registre a devolução antes de desativar a chave.");
        if (patch.codigo && d.chaves.some((x) => x.id !== c.id && x.codigo.toLowerCase() === patch.codigo.toLowerCase())) return falha(409, "DUPLICATE", "Já existe chave com este código.");
        if (patch.sala_id != null) patch.sala_id = Number(patch.sala_id);
        Object.assign(c, patch); salvar(); return atraso(c);
      },
      // UC007: só informa se há empréstimo ativo (igual ao contrato)
      async loanAvailability(id) { exigeSessao(GESTAO); const d = db(); const c = d.chaves.find((x) => x.id === Number(id)); if (!c) return falha(404, "NOT_FOUND", "Chave não encontrada."); return atraso({ key_id: c.id, has_active_loan: !!emprestimoAtivo(c.id, d) }); },
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
      // filtros: { ativos, status: "active"|"returned", chave_id, sala_id, usuario_id } (iguais aos da API)
      async list(f = {}) {
        exigeSessao(GESTAO); const d = db(); let lista = d.emprestimos.slice();
        if (f.ativos || f.status === "active") lista = lista.filter((e) => !e.devolvida_em);
        if (f.status === "returned") lista = lista.filter((e) => e.devolvida_em);
        if (f.chave_id) lista = lista.filter((e) => e.chave_id === Number(f.chave_id));
        if (f.usuario_id) lista = lista.filter((e) => e.usuario_id === Number(f.usuario_id));
        if (f.sala_id) lista = lista.filter((e) => { const c = d.chaves.find((x) => x.id === e.chave_id); return c && c.sala_id === Number(f.sala_id); });
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
        if (emprestimoAtivo(c.id, d)) return falha(409, "KEY_UNAVAILABLE", "Chave com empréstimo ativo.", { key_id: c.id });
        if (estadoChave(c) !== "available") return falha(409, "KEY_UNAVAILABLE", "Chave fora de circulação (inativa, em manutenção ou extraviada).", { key_id: c.id });
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
  const tz = (data) => { const o = -new Date(`${data}T12:00:00`).getTimezoneOffset(); return (o >= 0 ? "+" : "-") + pad(Math.floor(Math.abs(o) / 60)) + ":" + pad(Math.abs(o) % 60); };
  const isoHora = (data, hhmm) => `${data}T${hhmm}:00${tz(data)}`;
  const separar = (iso) => { const d = new Date(iso); return { data: isoDia(d), hora: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };

  // Remove campos indefinidos: PATCH é parcial e só envia o que a tela mudou
  const limpo = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const PERFIS_VALIDOS = ["admin", "employee", "student"];

  /* ----- espaços: {id, code, kind, name, capacity, location, is_active} ----- */
  const TIPO_DE_API = { laboratory: "laboratorio", room: "sala" };
  const TIPO_PARA_API = { laboratorio: "laboratory", sala: "room", reuniao: "room", auditorio: "room" };
  // name/capacity/location podem vir vazios: as telas usam o código e escondem o que faltar
  const deApiSala = (s) => ({
    id: s.id, codigo: s.code, nome: (s.name || "").trim() || s.code, tipo: TIPO_DE_API[s.kind] || s.kind,
    capacidade: s.capacity == null ? null : Number(s.capacity), localizacao: (s.location || "").trim(), ativo: s.is_active !== false
  });
  const paraApiSala = (s) => limpo({
    code: s.codigo, kind: s.tipo === undefined ? undefined : TIPO_PARA_API[s.tipo] || s.tipo, name: s.nome,
    capacity: s.capacidade === undefined ? undefined : s.capacidade === "" || s.capacidade == null ? null : Number(s.capacidade),
    location: s.localizacao, is_active: s.ativo
  });

  /* ----- chaves: KeyOut ----- */
  const deApiChave = (k, sala) => {
    const estado = k.status || "available";
    const emprestada = !!(k.has_active_loan || k.active_loan);
    const l = k.active_loan;
    return {
      id: k.id, codigo: k.label || `CHAVE-${k.id}`, sala_id: k.space_id, estado, ativo: estado !== "inactive",
      status: emprestada ? "emprestada" : ({ available: "disponivel", maintenance: "manutencao", lost: "perdida", inactive: "inativa" }[estado] || "inativa"),
      local: (sala && sala.localizacao) || "", observacao: "",
      // nome vazio quando o espaço não tem nome próprio (as telas mostram só o código)
      sala: { id: k.space_id, codigo: k.space_code || (sala && sala.codigo) || `#${k.space_id}`, nome: sala && sala.nome !== sala.codigo ? sala.nome : "", bloco: "" },
      emprestimo: l ? { id: l.id, chave_id: k.id, usuario_id: l.responsible_user_id, retirada_em: l.checked_out_at, devolvida_em: null,
        usuario: { id: l.responsible_user_id, nome: l.responsible_name || `Usuário #${l.responsible_user_id}` } } : null
    };
  };
  const paraApiChave = (c) => limpo({
    label: c.codigo, space_id: c.sala_id == null || c.sala_id === "" ? undefined : Number(c.sala_id),
    status: c.estado || (c.ativo === false ? "inactive" : c.ativo === true ? "available" : undefined)
  });

  /* ----- empréstimos: LoanOut ----- */
  const deApiEmprestimo = (l) => ({
    id: l.id, chave_id: l.key_id, usuario_id: l.responsible_user_id, registrado_por: l.checkout_operator_id ?? null,
    devolvido_para: l.return_operator_id ?? null, retirada_em: l.checked_out_at, devolvida_em: l.returned_at || null,
    chave: l.key_label ? { id: l.key_id, codigo: l.key_label } : null,
    sala: l.space_code ? { id: l.space_id, codigo: l.space_code, nome: "" } : null,
    usuario: l.responsible_name ? { id: l.responsible_user_id, nome: l.responsible_name, matricula: "" } : null,
    registrado_por_nome: ""
  });

  /* ----- usuários: {id, username, name, email, role, is_active, date_joined} ----- */
  const deApiUsuario = (u) => ({
    id: u.id, nome: u.name || u.username || "", usuario: u.username || "", email: u.email || "", matricula: "",
    perfil: PERFIS_VALIDOS.includes(u.role) ? u.role : "student", ativo: u.is_active !== false, criado_em: u.date_joined || null
  });
  // criação: username, name, email, role, password. Edição (parcial): name, email, role, is_active, password
  const paraApiUsuario = (u, novo) => limpo({
    username: novo ? u.usuario : undefined, name: u.nome, email: u.email, role: u.perfil,
    is_active: novo ? undefined : u.ativo, password: u.senha ? u.senha : undefined
  });

  // Lê todas as páginas de uma listagem com limit/offset
  async function todasAsPaginas(caminho, filtros, limite) {
    if (limite) return http("GET", caminho + qs({ ...filtros, limit: limite }));
    const todas = []; let offset = 0;
    while (true) {
      const pagina = await http("GET", caminho + qs({ ...filtros, limit: 100, offset }));
      todas.push(...pagina);
      if (pagina.length < 100) break;
      offset += 100;
    }
    return todas;
  }
  const bool = (v) => (v == null ? undefined : v ? "true" : "false");

  const deApiReserva = (b) => { const i = separar(b.start_at), f = separar(b.end_at); return { id: b.id, sala_id: b.space_id, data: i.data, inicio: i.hora, fim: f.hora, inicio_em: b.start_at, fim_em: b.end_at,
    criada_em: b.created_at || null, cancelada_em: b.cancelled_at || null, status: b.status === "cancelled" ? "cancelada" : "confirmada", situacao: b.status === "cancelled" ? "cancelada" : "confirmada" }; };

  const api = {
    auth: {
      async login({ identifier, password }) {
        await http("GET", "/auth/csrf/");
        const r = await http("POST", "/auth/login/", { identifier, password });
        // O login renova o CSRF; a próxima escrita relê o cookie atualizado.
        return { user: { id: r.user.id } };
      },
      async logout() { return http("POST", "/auth/logout/", {}); },
      // O papel vem SEMPRE do servidor (nunca do localStorage). Sem "role" (back antigo), só is_staff conta.
      async me() {
        const r = await http("GET", "/auth/me/");
        const perfil = PERFIS_VALIDOS.includes(r.role) ? r.role : r.is_staff === true ? "employee" : null;
        return { id: r.id, nome: r.name || r.username || `Usuário #${r.id}`, usuario: r.username || "", email: r.email || "", perfil };
      }
    },
    users: {
      // filtros: { q, perfil, ativo, limite }
      async list(f = {}) { return (await todasAsPaginas("/users/", { q: f.q, role: f.perfil, is_active: bool(f.ativo) }, f.limite)).map(deApiUsuario); },
      async get(id) { return deApiUsuario(await http("GET", `/users/${id}/`)); },
      async create(u) { return deApiUsuario(await http("POST", "/users/", paraApiUsuario(u, true))); },
      async update(id, p) { return deApiUsuario(await http("PATCH", `/users/${id}/`, paraApiUsuario(p, false))); }
    },
    spaces: {
      async list() { return (await http("GET", "/spaces/?is_active=true")).map(deApiSala).filter((s) => s.ativo); },
      async listAll() { return (await http("GET", "/spaces/")).map(deApiSala); },
      async get(id) { return deApiSala(await http("GET", `/spaces/${id}/`)); },
      async create(s) { return deApiSala(await http("POST", "/spaces/", paraApiSala(s))); },
      async update(id, s) { return deApiSala(await http("PATCH", `/spaces/${id}/`, paraApiSala(s))); },
      async availability(id, { data, inicio, fim }) { const r = await http("GET", `/spaces/${id}/booking-availability/` + qs({ start_at: isoHora(data, inicio), end_at: isoHora(data, fim) })); return { space_id: id, data, inicio, fim, available: r.available }; }
    },
    bookings: {
      // f.todas = true pede scope=all (só staff); o padrão é scope=mine
      async list(f = {}) {
        const todas = await todasAsPaginas("/bookings/", { space_id: f.sala_id, status: f.status, scope: f.todas ? "all" : "mine" });
        return todas.map(deApiReserva).filter((r) => (!f.de || r.data >= f.de) && (!f.ate || r.data <= f.ate) && (f.incluirCanceladas || r.status !== "cancelada"));
      },
      async agenda(id, { de, ate }) {
        const r = await http("GET", `/spaces/${id}/booking-agenda/` + qs({ start_at: isoHora(de, "00:00"), end_at: isoHora(ate, "23:59") }));
        return r.occupied.flatMap((x) => {
          const partes = [];
          let inicio = new Date(Math.max(new Date(x.start_at), new Date(`${de}T00:00:00`)));
          const fim = new Date(Math.min(new Date(x.end_at), new Date(`${ate}T23:59:00`)));
          while (inicio < fim) {
            const data = isoDia(inicio);
            const proximoDia = new Date(inicio); proximoDia.setHours(24, 0, 0, 0);
            const fimParte = new Date(Math.min(fim, proximoDia));
            partes.push({ sala_id: id, data, inicio: separar(inicio).hora, fim: fimParte.getTime() === proximoDia.getTime() ? "24:00" : separar(fimParte).hora, status: "confirmada", situacao: "confirmada" });
            inicio = fimParte;
          }
          return partes;
        });
      },
      async get(id) { return deApiReserva(await http("GET", `/bookings/${id}/`)); },
      async create(p) { return deApiReserva(await http("POST", "/bookings/", { space_id: p.sala_id, start_at: isoHora(p.data, p.inicio), end_at: isoHora(p.data, p.fim) })); },
      async cancel(id) { return http("POST", `/bookings/${id}/cancel/`, {}); }
    },
    keys: {
      // filtros: { sala_id, estado, emprestada }. Completa nome/local da sala com /spaces/ (se falhar, usa só o código).
      async list(f = {}) {
        const [ks, salas] = await Promise.all([
          http("GET", "/keys/" + qs({ space_id: f.sala_id, status: f.estado, has_active_loan: bool(f.emprestada) })),
          http("GET", "/spaces/").then((l) => l.map(deApiSala)).catch(() => [])
        ]);
        const porId = new Map(salas.map((s) => [s.id, s]));
        return ks.map((k) => deApiChave(k, porId.get(k.space_id)));
      },
      async get(id) { return deApiChave(await http("GET", `/keys/${id}/`)); },
      async create(c) { return deApiChave(await http("POST", "/keys/", paraApiChave(c))); },
      async update(id, c) { return deApiChave(await http("PATCH", `/keys/${id}/`, paraApiChave(c))); },
      async loanAvailability(id) { return http("GET", `/keys/${id}/loan-availability/`); },
      // movements só traz tipo/data; os empréstimos da chave completam responsável e operador
      async movements(id) {
        const [r, emprestimos] = await Promise.all([
          http("GET", `/keys/${id}/movements/`),
          todasAsPaginas("/key-loans/", { key_id: id }).then((l) => l.map(deApiEmprestimo)).catch(() => [])
        ]);
        const porEmp = new Map(emprestimos.map((e) => [e.id, e]));
        return { key_id: r.key_id, eventos: (r.events || []).map((ev) => {
          const e = porEmp.get(ev.loan_id);
          return { tipo: ev.type === "return" ? "devolucao" : "retirada", emprestimo_id: ev.loan_id, ocorrido_em: ev.occurred_at,
            usuario: e ? e.usuario : null, registrado_por: e ? e.registrado_por : null, registrado_por_nome: "" };
        }) };
      }
    },
    loans: {
      // filtros: { ativos, status, chave_id, sala_id, usuario_id }
      async list(f = {}) {
        const status = f.ativos ? "active" : f.status;
        return (await todasAsPaginas("/key-loans/", { status, key_id: f.chave_id, space_id: f.sala_id, responsible_user_id: f.usuario_id })).map(deApiEmprestimo);
      },
      async checkout({ chave_id, usuario_id }) { return deApiEmprestimo(await http("POST", "/key-loans/", { key_id: Number(chave_id), responsible_user_id: Number(usuario_id) })); },
      async return(id) { return deApiEmprestimo(await http("POST", `/key-loans/${id}/return/`, {})); }
    },
    demo: { reset() { return Promise.resolve({ ok: false }); } }
  };

  // Expostos só para os testes de contrato (tests/api-contract.test.cjs)
  L._mapa = { deApiSala, paraApiSala, deApiChave, paraApiChave, deApiEmprestimo, deApiUsuario, paraApiUsuario };

  L.api = CONFIG.modo === "api" ? api : mock;
  L.sessaoAtual = CONFIG.modo === "api" ? () => null : sessao;
})();
