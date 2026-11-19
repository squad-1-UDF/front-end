/* Lista de Salas / Laboratórios - filtros, ordenação, cards/tabela, paginação */
LABTECH.pronto.then(async () => {
  const L = window.LABTECH;
  const real = L.CONFIG.modo === "api";
  const PAGE_SIZE = 9;
  const results = document.getElementById("results");
  results.innerHTML = '<div class="loading">Carregando espaços...</div>';
  let SALAS = [];
  try { SALAS = await L.api.spaces.list(); }
  catch (e) { L.erro(e); results.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><b>Não foi possível carregar as salas.</b></div>'; return; }
  // reservas do dia escolhido no filtro de data/horário (carregadas sob demanda)
  const reservasPorData = {};
  async function carregarReservasDoDia(dataISO) {
    if (!dataISO || reservasPorData[dataISO]) return;
    try { reservasPorData[dataISO] = await L.api.bookings.list({ de: dataISO, ate: dataISO }); } catch (e) { L.erro(e); reservasPorData[dataISO] = []; }
  }

  const $ = (id) => document.getElementById(id);
  const el = {
    busca: $("fBusca"), tipo: $("fTipo"), bloco: $("fBloco"), status: $("fStatus"), cap: $("fCap"),
    data: $("fData"), ini: $("fIni"), fim: $("fFim"),
    aplicar: $("btnAplicar"), limpar: $("btnLimpar"), sort: $("sort"),
    viewCards: $("viewCards"), viewTable: $("viewTable"),
    results: $("results"), pagination: $("pagination"), count: $("countLabel"), topSearch: $("topSearch")
  };
  if (real) {
    [el.bloco, el.status, el.cap].forEach((x) => x.closest(".field").hidden = true);
    document.querySelectorAll(".hero-stat").forEach((x, i) => { if (i > 0) x.hidden = true; });
    document.querySelector(".results-bar .legend").hidden = true;
    el.busca.placeholder = "Código do espaço";
    el.sort.querySelectorAll('option[value="status"], option[value="capacidade"]').forEach((x) => x.remove());
    el.sort.value = "codigo";
    const hero = document.querySelector(".hero p");
    if (hero) hero.textContent = "Consulte os espaços cadastrados e verifique a disponibilidade para o período desejado.";
  }
  let disponiveis = null;

  let visao = "cards"; try { visao = localStorage.getItem("labtech_salas_visao") || "cards"; } catch (e) { /* sem storage */ }
  let state = { view: visao, page: 1 };

  /* ---------- resumo ---------- */
  $("statTotal").textContent = SALAS.length;
  $("statLivres").textContent = SALAS.filter((s) => s.status === "available").length;
  $("statOcupados").textContent = SALAS.filter((s) => s.status === "occupied").length;
  $("statManut").textContent = SALAS.filter((s) => s.status === "maintenance").length;

  /* ---------- opções de bloco ---------- */
  [...new Set(SALAS.map((s) => s.bloco))].sort().forEach((b) => {
    const o = document.createElement("option"); o.value = b; o.textContent = `Bloco ${b}`; el.bloco.appendChild(o);
  });

  /* ---------- filtro por data/horário (reservas reais da sala) ---------- */
  const paraMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  function livreNoPeriodo(sala, dataISO, ini, fim) {
    if (real) return !disponiveis || disponiveis.has(sala.id);
    if (!dataISO && !ini && !fim) return true;
    if (sala.status === "maintenance") return false;
    const data = dataISO || L.hojeISO();
    if (new Date(data + "T12:00:00").getDay() === 0) return false; // domingo fechado
    const a = paraMin(ini || "07:00"), b = fim ? paraMin(fim) : a + 60;
    return !(reservasPorData[data] || []).some((r) => r.sala_id === sala.id && paraMin(r.inicio) < b && a < paraMin(r.fim));
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

  // link para a tela de reserva já com a sala e, se houver, o período filtrado
  function linkReserva(s) {
    const p = new URLSearchParams({ sala: s.id });
    if (el.data.value) p.set("data", el.data.value);
    if (el.ini.value) p.set("inicio", el.ini.value);
    if (el.fim.value) p.set("fim", el.fim.value);
    return "reservar-sala.html?" + p.toString();
  }

  /* ---------- render ---------- */
  function cardHTML(s) {
    if (real) {
      const cover = L.tipoCover(s.tipo);
      return `<article class="panel hover room-card"><div class="cover ${cover.cls}"><i class="${cover.icon}"></i><small>${L.esc(s.codigo)}</small></div>
        <div class="body"><div class="ey">${L.esc(L.tipoLabel(s.tipo))}</div><h3>${L.esc(s.codigo)}</h3>
        <div class="actions"><a class="btn btn-secondary btn-sm" href="sala-detalhes.html?id=${s.id}">Ver detalhes</a>
        <a class="btn btn-primary btn-sm" href="${linkReserva(s)}">Reservar</a></div></div></article>`;
    }
    const link = `sala-detalhes.html?id=${s.id}`;
    const podeReservar = s.status !== "maintenance";
    const cover = L.tipoCover(s.tipo);
    const recursos = s.recursos || [];
    return `
      <article class="panel hover room-card ${s.status}">
        <div class="cover ${cover.cls}">
          ${L.badge(s.status)}
          <i class="${cover.icon}"></i>
          <small>${L.esc(s.codigo)}</small>
        </div>
        <div class="body">
          <div class="ey" style="color:var(--${cover.cls}-text)">${L.esc(L.tipoLabel(s.tipo))}</div>
          <h3>${L.esc(s.nome)}</h3>
          <div class="meta">
            <span><i class="fa-solid fa-location-dot"></i> Bloco ${L.esc(s.bloco)} · ${L.esc(L.andarLabel(s.andar))}</span>
            <span><i class="fa-solid fa-user"></i> Até ${s.capacidade}</span>
          </div>
          <div class="chips">${recursos.slice(0, 3).map(L.recursoChip).join("")}${recursos.length > 3 ? `<span class="chip">+${recursos.length - 3}</span>` : ""}</div>
          <div class="next"><i class="fa-regular fa-clock"></i> Próximo horário livre: <b>${L.esc(s.proximoLivre)}</b></div>
          <div class="actions">
            <a class="btn btn-secondary btn-sm" href="${link}"><i class="fa-solid fa-circle-info"></i> Ver detalhes</a>
            <a class="btn btn-primary btn-sm ${podeReservar ? "" : "is-disabled"}" href="${linkReserva(s)}"${podeReservar ? "" : ' aria-disabled="true" tabindex="-1"'}><i class="fa-regular fa-calendar-plus"></i> Reservar</a>
          </div>
        </div>
      </article>`;
  }

  function tableHTML(lista) {
    if (real) return `<div class="table-wrap rooms-table"><table class="table"><thead><tr><th>Código</th><th>Tipo</th><th></th></tr></thead><tbody>${lista.map((s) =>
      `<tr><td class="code">${L.esc(s.codigo)}</td><td>${L.esc(L.tipoLabel(s.tipo))}</td><td class="actions"><a class="btn btn-secondary btn-sm" href="sala-detalhes.html?id=${s.id}">Detalhes</a> <a class="btn btn-primary btn-sm" href="${linkReserva(s)}">Reservar</a></td></tr>`).join("")}</tbody></table></div>`;
    const rows = lista.map((s) => `
      <tr>
        <td class="code">${L.esc(s.codigo)}</td>
        <td class="name"><a href="sala-detalhes.html?id=${s.id}">${L.esc(s.nome)}</a></td>
        <td>${L.esc(L.tipoLabel(s.tipo))}</td>
        <td>Bloco ${L.esc(s.bloco)} · ${L.esc(L.andarLabel(s.andar))}</td>
        <td>${s.capacidade}</td>
        <td class="res">${(s.recursos || []).map(L.recursoIcon).join("")}</td>
        <td>${L.badge(s.status)}</td>
        <td>${L.esc(s.proximoLivre)}</td>
        <td class="actions">
          <a class="btn btn-secondary btn-sm" href="sala-detalhes.html?id=${s.id}">Detalhes</a>
          <a class="btn btn-primary btn-sm ${s.status === "maintenance" ? "is-disabled" : ""}" href="${linkReserva(s)}">Reservar</a>
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
      el.results.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><b>Nenhuma sala encontrada com esses filtros.</b><br><small>Tente limpar os filtros ou mudar a data/horário.</small></div>`;
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
    state.view = v; try { localStorage.setItem("labtech_salas_visao", v); } catch (e) { /* sem storage */ }
    el.viewCards.classList.toggle("active", v === "cards"); el.viewCards.setAttribute("aria-pressed", v === "cards");
    el.viewTable.classList.toggle("active", v === "table"); el.viewTable.setAttribute("aria-pressed", v === "table");
    render();
  }
  el.viewCards.addEventListener("click", () => setView("cards"));
  el.viewTable.addEventListener("click", () => setView("table"));

  el.aplicar.addEventListener("click", async () => {
    state.page = 1;
    if (real) {
      disponiveis = null;
      if ([el.data.value, el.ini.value, el.fim.value].some(Boolean) && ![el.data.value, el.ini.value, el.fim.value].every(Boolean)) {
        L.toast("Informe data, início e fim para filtrar por disponibilidade.", "info");
        return;
      }
      if (el.data.value && el.ini.value && el.fim.value) {
        try {
          const resultados = await Promise.all(SALAS.map((s) => L.api.spaces.availability(s.id, { data: el.data.value, inicio: el.ini.value, fim: el.fim.value })));
          disponiveis = new Set(SALAS.filter((_, i) => resultados[i].available).map((s) => s.id));
        } catch (e) { L.erro(e); }
      }
    } else await carregarReservasDoDia(el.data.value || ((el.ini.value || el.fim.value) ? L.hojeISO() : ""));
    render();
  });
  el.limpar.addEventListener("click", () => {
    ["busca", "tipo", "bloco", "status", "cap", "data", "ini", "fim"].forEach((k) => (el[k].value = ""));
    disponiveis = null;
    if (el.topSearch) el.topSearch.value = ""; state.page = 1; render();
  });
  [el.tipo, el.bloco, el.status, el.sort].forEach((c) => c.addEventListener("change", () => { state.page = 1; render(); }));
  let t; const debounce = () => { clearTimeout(t); t = setTimeout(() => { state.page = 1; render(); }, 180); };
  [el.busca, el.cap].forEach((c) => c.addEventListener("input", debounce));
  if (el.topSearch) el.topSearch.addEventListener("input", () => { el.busca.value = el.topSearch.value; debounce(); });
  el.pagination.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]"); if (!b || b.disabled) return;
    state.page = parseInt(b.dataset.page, 10); render();
    el.results.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  // "Ver mapa" leva para a agenda do dia com todas as salas
  $("btnMapa").setAttribute("href", "agenda.html");

  // filtros vindos pela URL (ex.: salas.html?status=available&tipo=laboratorio)
  ["tipo", "bloco", "status", "cap", "data", "ini", "fim"].forEach((k) => { const v = L.qs(k); if (v) el[k].value = v; });
  if (L.qs("q")) { el.busca.value = L.qs("q"); if (el.topSearch) el.topSearch.value = L.qs("q"); }
  if (!real) await carregarReservasDoDia(el.data.value || ((el.ini.value || el.fim.value) ? L.hojeISO() : ""));

  setView(state.view);
});
