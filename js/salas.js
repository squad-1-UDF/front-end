/* Lista de Salas / Laboratórios - filtros, ordenação, cards/tabela, paginação */
(function () {
  const L = window.LABTECH;
  const SALAS = L.SALAS;
  const PAGE_SIZE = 9;

  const $ = (id) => document.getElementById(id);
  const el = {
    busca: $("fBusca"), tipo: $("fTipo"), bloco: $("fBloco"), status: $("fStatus"), cap: $("fCap"),
    data: $("fData"), ini: $("fIni"), fim: $("fFim"),
    aplicar: $("btnAplicar"), limpar: $("btnLimpar"), sort: $("sort"),
    viewCards: $("viewCards"), viewTable: $("viewTable"),
    results: $("results"), pagination: $("pagination"), count: $("countLabel"), topSearch: $("topSearch")
  };

  let state = { view: localStorage.getItem("labtech.salas.view") || "cards", page: 1 };

  /* ---------- resumo ---------- */
  $("statTotal").textContent = SALAS.length;
  $("statLivres").textContent = SALAS.filter((s) => s.status === "available").length;
  $("statOcupados").textContent = SALAS.filter((s) => s.status === "occupied").length;
  $("statManut").textContent = SALAS.filter((s) => s.status === "maintenance").length;

  /* ---------- opções de bloco ---------- */
  [...new Set(SALAS.map((s) => s.bloco))].sort().forEach((b) => {
    const o = document.createElement("option"); o.value = b; o.textContent = `Bloco ${b}`; el.bloco.appendChild(o);
  });

  /* ---------- filtro por data/horário (usa a grade fictícia) ---------- */
  function livreNoPeriodo(sala, dataISO, ini, fim) {
    if (!dataISO && !ini && !fim) return true;
    if (sala.status === "maintenance") return false;
    const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const d = dataISO ? new Date(dataISO + "T00:00:00") : new Date();
    const dia = dias[d.getDay()];
    if (dia === "Dom") return false;
    const h0 = ini ? parseInt(ini.split(":")[0], 10) : 7;
    const h1 = fim ? Math.max(h0 + 1, Math.ceil(parseInt(fim.split(":")[0], 10) + (fim.split(":")[1] !== "00" ? 1 : 0))) : h0 + 1;
    const { grade } = L.gradeSemanal(sala, 0);
    for (let h = h0; h < h1; h++) {
      const s = grade[dia] && grade[dia][h];
      if (s !== "available") return false;
    }
    return true;
  }

  /* ---------- aplicar filtros ---------- */
  function filtrar() {
    const q = (el.busca.value || "").trim().toLowerCase();
    const tipo = el.tipo.value, bloco = el.bloco.value, status = el.status.value;
    const cap = parseInt(el.cap.value, 10) || 0;
    return SALAS.filter((s) => {
      if (q) {
        const alvo = [s.codigo, s.nome, ...(s.softwares || []), ...(s.recursos || []).map((r) => L.RECURSOS[r]?.label || r)].join(" ").toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      if (tipo && s.tipo !== tipo) return false;
      if (bloco && s.bloco !== bloco) return false;
      if (status && s.status !== status) return false;
      if (cap && s.capacidade < cap) return false;
      if (!livreNoPeriodo(s, el.data.value, el.ini.value, el.fim.value)) return false;
      return true;
    });
  }

  function ordenar(lista) {
    const by = el.sort.value;
    const rank = { available: 0, occupied: 1, maintenance: 2 };
    return [...lista].sort((a, b) => {
      if (by === "status") return (rank[a.status] - rank[b.status]) || a.codigo.localeCompare(b.codigo);
      if (by === "capacidade") return b.capacidade - a.capacidade;
      return String(a[by]).localeCompare(String(b[by]), "pt-BR", { numeric: true });
    });
  }

  /* ---------- render ---------- */
  function cardHTML(s) {
    const link = `sala-detalhes.html?id=${s.id}`;
    const podeReservar = s.status !== "maintenance";
    return `
      <article class="panel room-card ${s.status}">
        <div class="top">
          <div>
            <div class="code">${L.esc(s.codigo)}</div>
            <h3>${L.esc(s.nome)}</h3>
            <div class="type"><i class="fa-solid fa-layer-group"></i> ${L.esc(L.tipoLabel(s.tipo))}</div>
          </div>
          ${L.badge(s.status)}
        </div>
        <div class="meta">
          <span><i class="fa-solid fa-building"></i> Bloco ${L.esc(s.bloco)} · ${L.esc(L.andarLabel(s.andar))}</span>
          <span><i class="fa-solid fa-user-group"></i> ${s.capacidade} lugares</span>
        </div>
        <div class="resources">${(s.recursos || []).map(L.recursoIcon).join("")}</div>
        <div class="next"><i class="fa-regular fa-clock"></i> Próximo horário livre: <b>${L.esc(s.proximoLivre)}</b></div>
        <div class="actions">
          <a class="btn btn-outline btn-sm" href="${link}"><i class="fa-solid fa-circle-info"></i> Ver detalhes</a>
          <a class="btn btn-primary btn-sm ${podeReservar ? "" : "is-disabled"}" href="#" data-action="nova-reserva" data-sala="${L.esc(s.codigo)}"><i class="fa-regular fa-calendar-plus"></i> Reservar</a>
        </div>
        <img class="cat-peek" src="assets/gato${(s.id % 4) + 1}.png" alt="">
      </article>`;
  }

  function tableHTML(lista) {
    const rows = lista.map((s) => `
      <tr>
        <td class="code">${L.esc(s.codigo)}</td>
        <td class="name"><a href="sala-detalhes.html?id=${s.id}" style="text-decoration:none;color:inherit">${L.esc(s.nome)}</a></td>
        <td>${L.esc(L.tipoLabel(s.tipo))}</td>
        <td>Bloco ${L.esc(s.bloco)} · ${L.esc(L.andarLabel(s.andar))}</td>
        <td>${s.capacidade}</td>
        <td class="res">${(s.recursos || []).map(L.recursoIcon).join("")}</td>
        <td>${L.badge(s.status)}</td>
        <td>${L.esc(s.proximoLivre)}</td>
        <td class="actions">
          <a class="btn btn-outline btn-sm" href="sala-detalhes.html?id=${s.id}">Detalhes</a>
          <a class="btn btn-primary btn-sm ${s.status === "maintenance" ? "is-disabled" : ""}" href="#" data-action="nova-reserva" data-sala="${L.esc(s.codigo)}">Reservar</a>
        </td>
      </tr>`).join("");
    return `
      <div class="table-wrap rooms-table">
        <table class="table">
          <thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>Local</th><th>Cap.</th><th>Recursos</th><th>Status</th><th>Próx. livre</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function render() {
    const lista = ordenar(filtrar());
    const totalPages = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const inicio = (state.page - 1) * PAGE_SIZE;
    const pagina = state.view === "table" ? lista : lista.slice(inicio, inicio + PAGE_SIZE);

    el.count.innerHTML = `Mostrando <b>${pagina.length}</b> de <b>${lista.length}</b> espaços`;

    if (!lista.length) {
      el.results.innerHTML = `<div class="empty-state"><img src="assets/gato3.png" alt=""><i class="fa-solid fa-magnifying-glass"></i>Nenhuma sala encontrada com esses filtros.<br><small>Tente limpar os filtros ou mudar a data/horário.</small></div>`;
      el.pagination.innerHTML = "";
      return;
    }

    el.results.innerHTML = state.view === "table"
      ? tableHTML(pagina)
      : `<div class="rooms-grid">${pagina.map(cardHTML).join("")}</div>`;

    // paginação só na visão em cards
    if (state.view === "table" || totalPages === 1) { el.pagination.innerHTML = ""; return; }
    let h = `<button ${state.page === 1 ? "disabled" : ""} data-page="${state.page - 1}" aria-label="Anterior"><i class="fa-solid fa-chevron-left"></i></button>`;
    for (let p = 1; p <= totalPages; p++) h += `<button class="${p === state.page ? "active" : ""}" data-page="${p}">${p}</button>`;
    h += `<button ${state.page === totalPages ? "disabled" : ""} data-page="${state.page + 1}" aria-label="Próxima"><i class="fa-solid fa-chevron-right"></i></button>`;
    el.pagination.innerHTML = h;
  }

  /* ---------- eventos ---------- */
  function setView(v) {
    state.view = v; localStorage.setItem("labtech.salas.view", v);
    el.viewCards.classList.toggle("active", v === "cards"); el.viewCards.setAttribute("aria-pressed", v === "cards");
    el.viewTable.classList.toggle("active", v === "table"); el.viewTable.setAttribute("aria-pressed", v === "table");
    render();
  }
  el.viewCards.addEventListener("click", () => setView("cards"));
  el.viewTable.addEventListener("click", () => setView("table"));

  el.aplicar.addEventListener("click", () => { state.page = 1; render(); });
  el.limpar.addEventListener("click", () => {
    ["busca", "tipo", "bloco", "status", "cap", "data", "ini", "fim"].forEach((k) => (el[k].value = ""));
    el.topSearch.value = ""; state.page = 1; render();
  });
  [el.tipo, el.bloco, el.status, el.sort].forEach((c) => c.addEventListener("change", () => { state.page = 1; render(); }));
  let t; const debounce = () => { clearTimeout(t); t = setTimeout(() => { state.page = 1; render(); }, 180); };
  [el.busca, el.cap].forEach((c) => c.addEventListener("input", debounce));
  el.topSearch.addEventListener("input", () => { el.busca.value = el.topSearch.value; debounce(); });
  el.pagination.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]"); if (!b || b.disabled) return;
    state.page = parseInt(b.dataset.page, 10); render();
    el.results.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("btnMapa").addEventListener("click", (e) => { e.preventDefault(); L.toast("Mapa dos blocos: em construção", "fa-solid fa-map"); });

  // filtros vindos pela URL (ex.: salas.html?status=available&tipo=laboratorio)
  ["tipo", "bloco", "status", "cap", "data", "ini", "fim"].forEach((k) => { const v = L.qs(k); if (v) el[k].value = v; });
  if (L.qs("q")) el.busca.value = L.qs("q");

  setView(state.view);
})();
