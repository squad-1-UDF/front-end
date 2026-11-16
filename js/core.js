/* ============================================================
   Núcleo compartilhado por todas as telas internas.
   - Monta a sidebar, a topbar e o rodapé (iguais em todas as telas)
   - Protege a página: sem login volta para login.html; perfil
     sem permissão volta para index.html
   - Tema claro/escuro (chave labtech_theme), toast, modal, helpers

   Como usar numa tela nova:
     <body data-page="agenda" data-title="Agenda" data-roles="employee,admin">
       <div class="app-shell">
         <aside class="sidebar" id="app-sidebar"></aside>
         <main class="main">
           <header class="topbar" id="app-topbar"></header>
           <div class="content"> ...conteúdo... </div>
           <footer class="page-footer" id="app-footer"></footer>
         </main>
       </div>
       <div class="toast" id="toast" role="status" aria-live="polite"></div>
       <script src="data/seed.js"></script>
       <script src="js/api.js"></script>
       <script src="js/core.js"></script>
       <script src="js/agenda.js"></script>
     </body>
   data-roles vazio = qualquer usuário logado.
   ============================================================ */
(function () {
  const L = (window.LABTECH = window.LABTECH || {});

  /* ---------- helpers ---------- */
  L.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  L.qs = (name) => new URLSearchParams(location.search).get(name);
  L.$ = (sel, el = document) => el.querySelector(sel);
  L.$$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, "0");
  L.hojeISO = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  L.fmtData = (iso) => { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
  L.fmtDataLonga = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  L.fmtDataHora = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString("pt-BR") + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  L.fmtHora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  L.duracao = (desdeIso) => { const min = Math.max(0, Math.round((Date.now() - new Date(desdeIso)) / 60000)); return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${pad(min % 60)}`; };
  L.iniciais = (nome) => String(nome || "?").replace(/^(Prof\.|Téc\.)\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

  L.primeiroNome = (nome) => String(nome || "").replace(/^(Prof\.|Téc\.)\s*/i, "").split(/\s+/)[0] || "";

  L.TIPOS = L.TIPOS || {};
  L.STATUS = { available: "Livre", occupied: "Ocupado", maintenance: "Manutenção", reserved: "Reservado" };
  L.STATUS_RESERVA = { confirmada: ["Confirmada", "available"], pendente: ["Pendente", "reserved"], cancelada: ["Cancelada", "neutral"], concluida: ["Concluída", "occupied"], recusada: ["Recusada", "maintenance"] };
  L.STATUS_CHAVE = { disponivel: ["Disponível", "available"], emprestada: ["Emprestada", "reserved"], inativa: ["Inativa", "neutral"], retirada: ["Retirada", "reserved"], nao_aplica: ["Sem chave", "neutral"] };
  L.statusLabel = (s) => L.STATUS[s] || s;
  L.tipoLabel = (t) => L.TIPOS[t] || t;
  L.badge = (status, texto) => `<span class="badge ${status}">${L.esc(texto || L.statusLabel(status))}</span>`;
  L.badgeReserva = (s) => { const [t, c] = L.STATUS_RESERVA[s] || [s, "neutral"]; return L.badge(c, t); };
  L.badgeChave = (s) => { const [t, c] = L.STATUS_CHAVE[s] || [s, "neutral"]; return L.badge(c, t); };
  L.recursoIcon = (k) => { const r = L.RECURSOS && L.RECURSOS[k]; return r ? `<i class="${r.icon}" title="${L.esc(r.label)}" aria-label="${L.esc(r.label)}"></i>` : ""; };
  L.recursoChip = (k) => { const r = L.RECURSOS && L.RECURSOS[k]; return r ? `<span class="chip"><i class="${r.icon}"></i>${L.esc(r.label)}</span>` : ""; };
  L.tipoCover = (tipo) => ({
    laboratorio: { cls: "cover-lab", icon: "fa-solid fa-flask" },
    sala: { cls: "cover-study", icon: "fa-solid fa-book-open" },
    reuniao: { cls: "cover-meeting", icon: "fa-solid fa-users" },
    auditorio: { cls: "cover-aud", icon: "fa-solid fa-people-roof" }
  }[tipo] || { cls: "cover-meeting", icon: "fa-solid fa-door-open" });
  L.andarLabel = (a) => (Number(a) === 0 ? "Térreo" : `${a}º andar`);

  L.toast = (msg, tipo = "ok") => {
    const el = document.getElementById("toast"); if (!el) return;
    const icon = { ok: "fa-solid fa-circle-check", erro: "fa-solid fa-circle-exclamation", info: "fa-solid fa-circle-info" }[tipo] || tipo;
    el.className = "toast show" + (tipo === "erro" ? " toast-erro" : "");
    el.innerHTML = `<i class="${icon}"></i> ${L.esc(msg)}`;
    clearTimeout(L._toastT); L._toastT = setTimeout(() => el.classList.remove("show"), 3200);
  };
  // Mostra erro de API de forma amigável
  L.erro = (e) => { console.error(e); L.toast((e && e.message) || "Algo deu errado. Tente novamente.", "erro"); };

  /* Modal simples. L.modal({ titulo, corpo (HTML), confirmar:'Salvar', perigo:false, aoConfirmar: async (dialog) => true|false }) */
  L.modal = ({ titulo, eyebrow = "", corpo, confirmar = "Confirmar", cancelar = "Cancelar", perigo = false, aoConfirmar, largura }) => new Promise((ok) => {
    const dlg = document.createElement("dialog"); dlg.className = "modal";
    if (largura) dlg.style.width = `min(${largura}, calc(100vw - 32px))`;
    dlg.innerHTML = `<form method="dialog" class="modal-form" novalidate>
      <div class="modal-head"><div>${eyebrow ? `<span class="eyebrow">${L.esc(eyebrow)}</span>` : ""}<h2>${L.esc(titulo)}</h2></div>
      <button type="button" class="icon-btn" data-fechar aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="modal-body">${corpo || ""}</div>
      <p class="form-error" role="alert"></p>
      <div class="modal-actions"><button type="button" class="btn btn-secondary" data-fechar>${L.esc(cancelar)}</button>
      ${confirmar ? `<button type="submit" class="btn ${perigo ? "btn-danger" : "btn-primary"}">${L.esc(confirmar)}</button>` : ""}</div></form>`;
    document.body.appendChild(dlg);
    const fechar = (v) => { dlg.close(); dlg.remove(); ok(v); };
    dlg.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => fechar(false)));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); fechar(false); });
    dlg.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const erroEl = dlg.querySelector(".form-error"); erroEl.textContent = "";
      const btn = dlg.querySelector('button[type="submit"]');
      const form = dlg.querySelector("form");
      if (!form.checkValidity()) { const inv = form.querySelector(":invalid"); erroEl.textContent = inv?.dataset.msg || "Preencha os campos obrigatórios."; inv?.focus(); return; }
      if (!aoConfirmar) return fechar(true);
      btn.disabled = true;
      try { const r = await aoConfirmar(dlg); if (r !== false) fechar(r ?? true); }
      catch (err) { erroEl.textContent = err.message || "Não foi possível salvar."; }
      finally { btn.disabled = false; }
    });
    dlg.showModal();
    const primeiro = dlg.querySelector(".modal-body input, .modal-body select, .modal-body textarea"); if (primeiro) primeiro.focus();
  });
  L.confirmar = (titulo, texto, botao = "Confirmar", perigo = true) => L.modal({ titulo, corpo: `<p class="muted">${L.esc(texto)}</p>`, confirmar: botao, perigo });

  // Lê os campos [name] de um formulário/dialog num objeto
  L.lerForm = (el) => {
    const o = {};
    el.querySelectorAll("[name]").forEach((i) => {
      if (i.type === "checkbox") { if (i.dataset.lista != null) { (o[i.name] = o[i.name] || []); if (i.checked) o[i.name].push(i.value); } else o[i.name] = i.checked; }
      else if (i.type === "number") o[i.name] = i.value === "" ? null : Number(i.value);
      else o[i.name] = i.value.trim();
    });
    return o;
  };

  /* ---------- tema ---------- */
  const THEME_KEY = "labtech_theme";
  L.applyTheme = (t) => {
    if (t === "dark") document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
      const i = b.querySelector("i"); if (i) i.className = t === "dark" ? "fa-regular fa-sun" : "fa-regular fa-moon";
      const lbl = b.querySelector(".label"); if (lbl) lbl.textContent = t === "dark" ? "Tema claro" : "Tema escuro";
      b.setAttribute("aria-pressed", String(t === "dark"));
    });
  };
  L.toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* sem storage */ }
    L.applyTheme(next);
  };

  /* ---------- menu (um lugar só para todas as telas) ---------- */
  L.MENU = [
    { secao: "Principal", itens: [
      { id: "inicio", href: "index.html", icon: "fa-solid fa-house", label: "Início" },
      { id: "salas", href: "salas.html", icon: "fa-solid fa-flask", label: "Laboratórios e salas" },
      { id: "agenda", href: "agenda.html", icon: "fa-regular fa-calendar-check", label: "Agenda" },
      { id: "reservar", href: "reservar-sala.html", icon: "fa-solid fa-table-cells", label: "Reservar sala" },
      { id: "minhas-reservas", href: "minhas-reservas.html", icon: "fa-regular fa-rectangle-list", label: "Minhas reservas" }
    ] },
    { secao: "Chaves", perfis: ["employee", "admin"], itens: [
      { id: "chaves", href: "chaves.html", icon: "fa-solid fa-key", label: "Retirada e devolução" },
      { id: "chave-historico", href: "chave-historico.html", icon: "fa-solid fa-clock-rotate-left", label: "Histórico de chaves" }
    ] },
    { secao: "Administração", perfis: ["admin"], itens: [
      { id: "admin", href: "admin.html", icon: "fa-solid fa-shield-halved", label: "Painel administrativo" },
      { id: "admin-usuarios", href: "admin-usuarios.html", icon: "fa-solid fa-users", label: "Usuários" },
      { id: "admin-salas", href: "admin-salas.html", icon: "fa-solid fa-building", label: "Salas e chaves" }
    ] }
  ];
  // páginas que acendem outro item do menu
  const ATIVO_ALIAS = { "sala-detalhes": "salas" };

  L.usuario = null;
  L.pode = (...perfis) => !!L.usuario && perfis.includes(L.usuario.perfil);

  function montarShell() {
    const body = document.body;
    const page = body.dataset.page || "";
    const titulo = body.dataset.title || document.title;
    const ativo = ATIVO_ALIAS[page] || page;
    const u = L.usuario;

    const side = document.getElementById("app-sidebar");
    if (side) {
      const secoes = L.MENU.filter((s) => !s.perfis || s.perfis.includes(u.perfil)).map((s) => `
        <div class="nav-section">${L.esc(s.secao)}</div>
        <nav aria-label="${L.esc(s.secao)}">${s.itens.map((i) => `<a class="nav-item${i.id === ativo ? " active" : ""}" href="${i.href}"${i.id === ativo ? ' aria-current="page"' : ""}><i class="${i.icon}"></i><span class="label">${L.esc(i.label)}</span></a>`).join("")}</nav>`).join("");
      side.innerHTML = `
        <a class="logo" href="index.html" aria-label="LabReserva UDF - início">
          <div class="logo-mark">L</div>
          <div><b>LabReserva<span>.</span></b><small>UDF Centro Universitário</small></div>
        </a>
        ${secoes}
        <div class="sidebar-promo"><i class="fa-regular fa-star"></i><b>Um espaço para suas ideias</b>Encontre o ambiente ideal para aprender e colaborar.</div>
        <button class="theme-toggle" type="button" data-theme-toggle aria-pressed="false"><i class="fa-regular fa-moon"></i><span class="label">Tema escuro</span><span class="switch"></span></button>
        <div class="sidebar-user">
          <div class="avatar">${L.esc(L.iniciais(u.nome))}</div>
          <div class="sidebar-user-info"><b>${L.esc(u.nome)}</b><span>${L.esc((L.PERFIS && L.PERFIS[u.perfil]) || u.perfil)}</span></div>
          <button class="icon-btn" type="button" id="btnSair" title="Sair" aria-label="Sair do sistema"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
        </div>`;
    }

    const top = document.getElementById("app-topbar");
    if (top) {
      const busca = body.dataset.search; // placeholder da busca da topbar (opcional)
      top.innerHTML = `
        <nav class="breadcrumb" aria-label="Navegação">
          <a href="index.html">Portal acadêmico</a><i class="fa-solid fa-chevron-right"></i>
          ${body.dataset.parent ? `<a href="${L.esc(body.dataset.parentHref || "#")}">${L.esc(body.dataset.parent)}</a><i class="fa-solid fa-chevron-right"></i>` : ""}
          <span class="current" id="breadcrumbAtual">${L.esc(titulo)}</span>
        </nav>
        <div class="topbar-right">
          <span class="topbar-date">${new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}</span>
          ${busca ? `<label class="search"><i class="fa-solid fa-magnifying-glass search-icon"></i><input id="topSearch" type="search" placeholder="${L.esc(busca)}" aria-label="${L.esc(busca)}"></label>` : ""}
          ${L.CONFIG && L.CONFIG.modo === "mock" ? `<span class="mode-pill" title="Dados de demonstração salvos neste navegador. Sem back-end.">Demonstração</span>` : ""}
        </div>`;
    }

    const foot = document.getElementById("app-footer");
    if (foot) foot.innerHTML = `<span><b>UDF</b> Organização · Pesquisa · Conhecimento</span><span>LabReserva · Squad 1 · LabTech UDF</span>`;

    L.applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.addEventListener("click", L.toggleTheme));
    const sair = document.getElementById("btnSair");
    if (sair) sair.addEventListener("click", async () => { try { await L.api.auth.logout(); } catch (e) { /* segue */ } location.href = "login.html"; });
  }

  /* ---------- proteção da página ---------- */
  // L.pronto: Promise resolvida com o usuário logado depois que o shell estiver montado.
  // As telas fazem:  LABTECH.pronto.then(async (usuario) => { ... });
  L.pronto = new Promise((resolve) => {
    const iniciar = () => {
      const s = L.sessaoAtual ? L.sessaoAtual() : null;
      if (!s) { location.replace("login.html?voltar=" + encodeURIComponent(location.pathname.split("/").pop() + location.search)); return; }
      L.usuario = s;
      const perfis = (document.body.dataset.roles || "").split(",").map((x) => x.trim()).filter(Boolean);
      if (perfis.length && !perfis.includes(s.perfil)) { sessionStorage.setItem("labtech_aviso", "Seu perfil não tem acesso àquela tela."); location.replace("index.html"); return; }
      montarShell();
      const aviso = sessionStorage.getItem("labtech_aviso");
      if (aviso) { sessionStorage.removeItem("labtech_aviso"); setTimeout(() => L.toast(aviso, "info"), 300); }
      resolve(s);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
  });
})();
