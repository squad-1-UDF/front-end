/* ============================================================
   Início / dashboard (autoria original: Luanna Priscila, branch dashboard)
   Estudantes consultam espaços e agenda; funcionários e administradores
   também consultam reservas e chaves.
   ============================================================ */
LABTECH.pronto.then(async (usuario) => {
  const L = LABTECH;
  const api = L.api;
  const $ = (id) => document.getElementById(id);
  if (L.pode("student")) {
    const nome = L.primeiroNome(usuario.nome);
    $("saudacao").textContent = nome ? `Olá, ${nome}!` : "Olá!";
    document.querySelector(".subtitle").textContent = "Consulte salas, laboratórios e a agenda de ocupação.";
    $("agendaHoje").textContent = "Hoje, " + new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    $("acoesRapidas").innerHTML = `<a class="btn btn-gold" href="salas.html">Laboratórios e salas</a><a class="btn btn-secondary" href="agenda.html">Agenda completa</a>`;
    const metric = $("qtdReservas").closest(".dash-reservas");
    metric.href = "salas.html";
    metric.querySelector("h2").textContent = "Espaços para consulta";
    $("verTodas").href = "salas.html";
    document.querySelector("#labsConteudo").closest("article").querySelector("h2").textContent = "Laboratórios e salas";
    document.querySelector("#agendaConteudo").closest("article").querySelector("h2").textContent = "Explore os espaços";
    document.querySelector("#notificacoesConteudo").closest("article").querySelector("h2").textContent = "Informações";
    $("cardChaves").innerHTML = `<h2><span class="panel-icon"><i class="fa-regular fa-calendar-check"></i></span> Agenda de ocupação</h2><p>Veja os horários ocupados de cada sala e laboratório.</p><a class="btn btn-link" href="agenda.html">Consultar agenda</a>`;
    $("notificacoesConteudo").innerHTML = `<p class="muted">Consulte os detalhes e a disponibilidade dos espaços antes de planejar sua visita.</p>`;
    try {
      const salas = await api.spaces.list();
      $("qtdReservas").textContent = salas.length;
      $("qtdReservasTxt").textContent = salas.length === 1 ? "espaço cadastrado" : "espaços cadastrados";
      const links = salas.map((s) => `<a class="lab-seat" href="sala-detalhes.html?id=${encodeURIComponent(s.id)}" title="${L.esc(s.nome)}"><i class="${L.tipoCover(s.tipo).icon}"></i><small>${L.esc(s.codigo)}</small></a>`).join("");
      $("labsConteudo").innerHTML = salas.length ? `<div class="labs-map-grid">${links}</div>` : `<p class="muted">Nenhum espaço cadastrado.</p>`;
      $("agendaConteudo").innerHTML = salas.length ? `<div class="list">${salas.slice(0, 6).map((s) => `<a class="list-item" href="sala-detalhes.html?id=${encodeURIComponent(s.id)}"><span class="list-icon"><i class="${L.tipoCover(s.tipo).icon}"></i></span><span class="list-main"><b>${L.esc(s.nome)}</b><span>${L.esc(s.codigo)}</span></span></a>`).join("")}</div>` : `<p class="muted">Consulte a agenda para ver a ocupação.</p>`;
    } catch (e) {
      L.erro(e);
      $("qtdReservas").textContent = "–";
      $("qtdReservasTxt").textContent = "não foi possível carregar";
      $("labsConteudo").innerHTML = `<p class="muted">Não foi possível carregar os espaços.</p>`;
      $("agendaConteudo").innerHTML = `<p class="muted">Não foi possível carregar os espaços.</p>`;
    }
    return;
  }
  $("qtdReservas").closest(".dash-reservas").href = "minhas-reservas.html";
  $("qtdReservas").closest(".dash-reservas").querySelector("h2").textContent = "Minhas reservas ativas";
  if (L.CONFIG.modo === "api") {
    // Modo API: números reais de /spaces/, /bookings/ (scope=mine) e, para a gestão, /key-loans/.
    // Reservas da API não trazem finalidade nem titular; espaços podem vir sem nome/capacidade.
    const gestao = L.pode("employee", "admin");
    const nome = L.primeiroNome(usuario.nome);
    $("saudacao").textContent = nome ? `Olá, ${nome}!` : "Olá!";
    document.querySelector(".subtitle").textContent = gestao ? "Consulte espaços, agenda, reservas e chaves." : "Consulte espaços, agenda e suas reservas.";
    $("agendaHoje").textContent = "Hoje, " + new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    $("acoesRapidas").innerHTML = `<a class="btn btn-gold" href="reservar-sala.html"><i class="fa-regular fa-calendar-plus" aria-hidden="true"></i>Nova reserva</a><a class="btn btn-secondary" href="agenda.html"><i class="fa-regular fa-calendar-days" aria-hidden="true"></i>Agenda completa</a>` +
      (gestao ? `<a class="btn btn-secondary" href="chaves.html"><i class="fa-solid fa-key" aria-hidden="true"></i>Retirada de chaves</a>` : `<a class="btn btn-secondary" href="salas.html"><i class="fa-solid fa-flask" aria-hidden="true"></i>Laboratórios e salas</a>`);
    $("verTodas").href = "minhas-reservas.html";
    document.querySelector("#labsConteudo").closest("article").querySelector("h2").textContent = "Laboratórios e salas";
    document.querySelector("#notificacoesConteudo").closest("article").querySelector("h2").textContent = "Resumo da conta";
    try {
      const [salas, reservas, ativos] = await Promise.all([
        api.spaces.list(), api.bookings.list({ incluirCanceladas: true }),
        gestao ? api.loans.list({ ativos: true }).catch((e) => { L.erro(e); return null; }) : Promise.resolve(null)
      ]);
      const porId = new Map(salas.map((s) => [s.id, s]));
      const nomeSala = (id) => { const s = porId.get(id); return s ? s.nome : `Espaço #${id}`; };
      const futuras = reservas.filter((r) => r.status !== "cancelada" && new Date(r.fim_em || `${r.data}T${r.fim}`) > new Date())
        .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
      // Card 1: espaços ativos (capacidade somada só quando informada)
      const comCap = salas.filter((s) => s.capacidade != null);
      const lugares = comCap.reduce((t, s) => t + s.capacidade, 0);
      $("labsConteudo").innerHTML = salas.length ? `
        <div class="lab-stats-top"><div class="lab-count-info"><strong>${salas.length}</strong><span>${salas.length === 1 ? "espaço ativo" : "espaços ativos"}${comCap.length ? ` · ${lugares} lugares em ${comCap.length} com capacidade informada` : ""}</span></div></div>
        <div class="labs-map-grid">${salas.map((s) => {
          const titulo = [s.codigo, s.nome !== s.codigo ? s.nome : "", s.capacidade != null ? `até ${s.capacidade} pessoas` : "", s.localizacao].filter(Boolean).join(" · ");
          return `<a class="lab-seat" href="sala-detalhes.html?id=${s.id}" title="${L.esc(titulo)}" aria-label="${L.esc(titulo)}"><i class="${L.tipoCover(s.tipo).icon}" aria-hidden="true"></i><small>${L.esc(s.codigo)}</small></a>`;
        }).join("")}</div>` : `<p class="muted">Nenhum espaço cadastrado.</p>`;
      $("qtdReservas").textContent = futuras.length;
      $("qtdReservasTxt").textContent = futuras.length === 1 ? "reserva ativa ou futura" : "reservas ativas ou futuras";
      // Card 3: chaves emprestadas (gestão) ou próxima reserva
      const proxima = futuras[0];
      if (gestao && ativos) {
        const n = ativos.length;
        $("cardChaves").innerHTML = `<h2><span class="panel-icon"><i class="fa-solid fa-key"></i></span> Chaves emprestadas agora</h2>
          <strong class="metric">${n}</strong><p>${n === 1 ? "chave com empréstimo ativo" : "chaves com empréstimo ativo"}</p>
          ${n ? `<div class="key-icons" aria-hidden="true">${'<i class="fa-solid fa-key"></i>'.repeat(Math.min(n, 8))}</div>` : ""}
          <a class="btn btn-link" href="chaves.html">Retirada e devolução <i class="fa-solid fa-arrow-right"></i></a>`;
      } else {
        $("cardChaves").innerHTML = `<h2><span class="panel-icon"><i class="fa-regular fa-clock"></i></span> Próxima reserva</h2>${proxima ? `<div class="proxima-sala">${L.esc(nomeSala(proxima.sala_id))}</div><div class="proxima-quando">${L.esc(L.fmtData(proxima.data))} · ${L.esc(proxima.inicio)}–${L.esc(proxima.fim)}</div>` : `<p class="proxima-vazia">Você não tem reservas futuras.</p>`}<a class="btn btn-link" href="minhas-reservas.html">Ver minhas reservas</a>`;
      }
      // Card 5: agenda (gestão vê também as chaves fora do balcão)
      let html = "";
      if (gestao && ativos && ativos.length) {
        html += `<p class="agenda-dia">Chaves emprestadas agora</p><div class="list">${ativos.slice(0, 4).map((e) => `
          <a class="list-item" href="chaves.html"><span class="list-icon warn"><i class="fa-solid fa-key"></i></span>
          <span class="list-main"><b>${L.esc((e.chave && e.chave.codigo) || "Chave")}${e.sala ? " · " + L.esc(e.sala.codigo) : ""}</b><span>Com ${L.esc((e.usuario && e.usuario.nome) || "usuário")} há ${L.esc(L.duracao(e.retirada_em))}</span></span>
          <span class="list-hora">${L.esc(L.fmtHora(e.retirada_em))}</span></a>`).join("")}</div>`;
        if (ativos.length > 4) html += `<p class="form-hint">+ ${ativos.length - 4} chave(s) emprestada(s). <a href="chaves.html">Ver todas</a></p>`;
      }
      if (futuras.length) html += `<p class="agenda-dia">Minhas próximas reservas</p><div class="list">${futuras.slice(0, 6).map((r) => `<a class="list-item" href="sala-detalhes.html?id=${r.sala_id}"><span class="list-icon"><i class="fa-regular fa-calendar"></i></span><span class="list-main"><b>${L.esc(nomeSala(r.sala_id))}</b><span>${L.esc(L.fmtData(r.data))}</span></span><span class="list-hora">${L.esc(r.inicio)}–${L.esc(r.fim)}</span></a>`).join("")}</div>`;
      $("agendaConteudo").innerHTML = html || `<p class="muted">Nenhuma reserva futura.</p>`;
      const canceladas = reservas.filter((r) => r.status === "cancelada").length;
      $("notificacoesConteudo").innerHTML = reservas.length
        ? `<p class="muted">${reservas.length} ${reservas.length === 1 ? "reserva registrada" : "reservas registradas"} na sua conta${canceladas ? ` (${canceladas} cancelada${canceladas === 1 ? "" : "s"})` : ""}.</p>`
        : `<p class="muted">Sem atividade recente.</p>`;
    } catch (e) {
      L.erro(e);
      ["labsConteudo", "agendaConteudo", "notificacoesConteudo"].forEach((id) => { $(id).innerHTML = `<p class="muted">Não foi possível carregar os dados.</p>`; });
    }
    return;
  }
  const gestao = L.pode("employee", "admin");
  const agora = new Date();

  /* ---------- utilidades da tela ---------- */
  const primeiroNome = (nome) => String(nome || "").replace(/^(Prof\.|Téc\.)\s*/i, "").split(/\s+/)[0] || "";
  const fimDe = (r) => new Date(`${r.data}T${r.fim}`);
  // reserva ainda válida (confirmada/pendente e não terminou)
  const ativa = (r) => ["confirmada", "pendente"].includes(r.situacao || r.status) && fimDe(r) > agora;
  const quandoReserva = (r) => {
    const dia = r.data === L.hojeISO() ? "Hoje" : r.data === L.hojeISO(1) ? "Amanhã" : L.fmtDataLonga(r.data);
    return `${dia} · ${r.inicio}–${r.fim}`;
  };
  const vazio = (icone, titulo, texto, link) => `<div class="empty-state"><i class="${icone}"></i><b>${L.esc(titulo)}</b><p>${L.esc(texto)}</p>${link || ""}</div>`;

  /* ---------- cabeçalho ---------- */
  const nome = primeiroNome(usuario.nome);
  $("saudacao").textContent = nome ? `Olá, ${nome}!` : "Olá!";
  $("agendaHoje").textContent = "Hoje, " + agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

  /* ---------- ações rápidas (só Nova reserva em dourado) ---------- */
  const acoes = [
    { href: "reservar-sala.html", icone: "fa-regular fa-calendar-plus", texto: "Nova reserva", cls: "btn-gold" },
    { href: "agenda.html", icone: "fa-regular fa-calendar-days", texto: "Agenda completa", cls: "btn-secondary" },
    gestao
      ? { href: "chaves.html", icone: "fa-solid fa-key", texto: "Retirada de chaves", cls: "btn-secondary" }
      : { href: "salas.html", icone: "fa-solid fa-flask", texto: "Laboratórios e salas", cls: "btn-secondary" }
  ];
  $("acoesRapidas").innerHTML = acoes.map((a) => `<a class="btn ${a.cls}" href="${a.href}"><i class="${a.icone}" aria-hidden="true"></i>${L.esc(a.texto)}</a>`).join("");
  $("verTodas").href = gestao ? "agenda.html" : "minhas-reservas.html";

  /* ---------- carregamento em paralelo ---------- */
  const pSalas = api.spaces.list();
  const pMinhas = api.bookings.list({ mine: true, de: L.hojeISO() });
  const pAtivos = gestao ? api.loans.list({ ativos: true }) : Promise.resolve([]);

  /* Card 1: laboratórios livres + mapa de quadradinhos */
  (async () => {
    const alvo = $("labsConteudo");
    try {
      const salas = (await pSalas).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true }));
      if (!salas.length) { alvo.innerHTML = vazio("fa-solid fa-flask", "Nenhuma sala cadastrada", "Os espaços aparecem aqui assim que forem cadastrados."); return; }
      const livres = salas.filter((s) => s.status === "available").length;
      const pct = Math.round((livres / salas.length) * 100);
      alvo.innerHTML = `
        <div class="lab-stats-top">
          <div class="lab-count-info"><strong>${livres}/${salas.length}</strong><span>salas e laboratórios livres agora</span></div>
          <div class="ring" style="--pct:${pct}%" role="img" aria-label="${pct}% dos espaços livres"><div><b>${pct}%</b><span>livres</span></div></div>
        </div>
        <div class="legend lab-legend">
          <span class="legend-item"><i class="dot available"></i> ${L.esc(L.statusLabel("available"))}</span>
          <span class="legend-item"><i class="dot occupied"></i> ${L.esc(L.statusLabel("occupied"))}</span>
          <span class="legend-item"><i class="dot maintenance"></i> ${L.esc(L.statusLabel("maintenance"))}</span>
        </div>
        <div class="labs-map-grid">${salas.map((s) => {
          const rotulo = String(s.codigo || s.id);
          const titulo = `${s.codigo} · ${s.nome} - ${L.statusLabel(s.status)}`;
          return `<a class="lab-seat ${L.esc(s.status)}" href="sala-detalhes.html?id=${encodeURIComponent(s.id)}" title="${L.esc(titulo)}" aria-label="${L.esc(titulo)}"><i class="${L.tipoCover(s.tipo).icon}" aria-hidden="true"></i><small>${L.esc(rotulo)}</small></a>`;
        }).join("")}</div>`;
    } catch (e) { alvo.innerHTML = vazio("fa-solid fa-triangle-exclamation", "Não foi possível carregar as salas", "Tente recarregar a página."); L.erro(e); }
  })();

  /* Card 2: minhas reservas ativas */
  (async () => {
    try {
      const qtd = (await pMinhas).filter(ativa).length;
      $("qtdReservas").textContent = qtd;
      $("qtdReservasTxt").textContent = qtd === 1 ? "reserva ativa ou futura" : "reservas ativas ou futuras";
    } catch (e) { $("qtdReservas").textContent = "–"; $("qtdReservasTxt").textContent = "não foi possível carregar"; L.erro(e); }
  })();

  /* Card 3: chaves emprestadas agora (gestão) ou próxima reserva (estudante) */
  (async () => {
    const card = $("cardChaves");
    try {
      if (gestao) {
        const ativos = await pAtivos;
        const n = ativos.length;
        card.innerHTML = `
          <h2><span class="panel-icon"><i class="fa-solid fa-key"></i></span> Chaves emprestadas agora</h2>
          <strong class="metric">${n}</strong>
          <p>${n === 1 ? "chave com empréstimo ativo" : "chaves com empréstimo ativo"}</p>
          ${n ? `<div class="key-icons" aria-hidden="true">${'<i class="fa-solid fa-key"></i>'.repeat(Math.min(n, 8))}</div>` : ""}
          <a class="btn btn-link" href="chaves.html">Retirada e devolução <i class="fa-solid fa-arrow-right"></i></a>`;
      } else {
        const prox = (await pMinhas).filter(ativa).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio))[0];
        card.innerHTML = `
          <h2><span class="panel-icon"><i class="fa-regular fa-clock"></i></span> Próxima reserva</h2>
          ${prox
            ? `<div class="proxima-sala">${L.esc((prox.sala && prox.sala.nome) || "Sala")}</div>
               <div class="proxima-quando">${L.esc(quandoReserva(prox))}</div>
               <p>${L.esc(prox.finalidade || "")}</p>
               <a class="btn btn-link" href="minhas-reservas.html">Ver minhas reservas <i class="fa-solid fa-arrow-right"></i></a>`
            : `<p class="proxima-vazia">Você não tem reservas futuras.</p>
               <a class="btn btn-link" href="reservar-sala.html">Reservar uma sala <i class="fa-solid fa-arrow-right"></i></a>`}`;
      }
    } catch (e) { card.innerHTML = vazio("fa-solid fa-triangle-exclamation", "Não foi possível carregar", "Tente recarregar a página."); L.erro(e); }
  })();

  /* Card 5: minha agenda (hoje e próximos dias; gestão vê também chaves emprestadas) */
  (async () => {
    const alvo = $("agendaConteudo");
    try {
      const [minhas, ativos] = await Promise.all([pMinhas, pAtivos]);
      const limite = L.hojeISO(6);
      const proximas = minhas.filter((r) => ativa(r) && r.data <= limite)
        .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio)).slice(0, 6);
      let html = "";

      if (gestao && ativos.length) {
        html += `<p class="agenda-dia">Chaves emprestadas agora</p><div class="list">${ativos.slice(0, 4).map((e) => `
          <a class="list-item" href="chaves.html">
            <span class="list-icon warn"><i class="fa-solid fa-key"></i></span>
            <span class="list-main"><b>${L.esc((e.chave && e.chave.codigo) || "Chave")} · ${L.esc((e.sala && e.sala.nome) || "")}</b><span>Com ${L.esc((e.usuario && e.usuario.nome) || "usuário")} há ${L.esc(L.duracao(e.retirada_em))}</span></span>
            <span class="list-hora">${L.esc(L.fmtHora(e.retirada_em))}</span>
          </a>`).join("")}</div>`;
        if (ativos.length > 4) html += `<p class="form-hint">+ ${ativos.length - 4} chave(s) emprestada(s). <a href="chaves.html">Ver todas</a></p>`;
      }

      // agrupa as reservas por dia
      let diaAtual = "";
      const itens = proximas.map((r) => {
        let cab = "";
        if (r.data !== diaAtual) {
          if (diaAtual) cab += "</div>";
          diaAtual = r.data;
          const rot = r.data === L.hojeISO() ? "Hoje" : r.data === L.hojeISO(1) ? "Amanhã" : L.fmtDataLonga(r.data);
          cab += `<p class="agenda-dia">${L.esc(rot)}</p><div class="list">`;
        }
        const emCurso = new Date(`${r.data}T${r.inicio}`) <= agora;
        return cab + `<a class="list-item" href="sala-detalhes.html?id=${encodeURIComponent(r.sala_id)}">
            <span class="list-icon${emCurso ? " ok" : ""}"><i class="${L.tipoCover(r.sala && r.sala.tipo).icon}"></i></span>
            <span class="list-main"><b>${L.esc((r.sala && r.sala.nome) || "Sala")}${emCurso ? " · em andamento" : ""}</b><span>${L.esc(r.finalidade || "Reserva")}</span></span>
            <span class="list-hora">${L.esc(r.inicio)}–${L.esc(r.fim)}</span>
          </a>`;
      }).join("");
      if (itens) html += itens + "</div>";

      alvo.innerHTML = html || vazio("fa-regular fa-calendar", "Agenda livre", "Nada marcado para hoje e os próximos dias.",
        `<p><a class="btn btn-secondary btn-sm" href="reservar-sala.html">Reservar uma sala</a></p>`);
    } catch (e) { alvo.innerHTML = vazio("fa-solid fa-triangle-exclamation", "Não foi possível carregar a agenda", "Tente recarregar a página."); L.erro(e); }
  })();

  /* Card 6: atividade recente (estudante só vê as próprias reservas; não chama loans.list) */
  (async () => {
    const alvo = $("notificacoesConteudo");
    try {
      const [reservas, emprestimos] = await Promise.all([
        gestao ? api.bookings.list({ de: L.hojeISO(-14), incluirCanceladas: true }) : api.bookings.list({ mine: true, incluirCanceladas: true }),
        gestao ? api.loans.list() : Promise.resolve([])
      ]);
      const eventos = [];
      reservas.forEach((r) => {
        const sala = (r.sala && r.sala.nome) || "Sala";
        const quem = gestao && r.usuario ? ` · ${r.usuario.nome}` : "";
        const href = `sala-detalhes.html?id=${encodeURIComponent(r.sala_id)}`;
        const criada = r.criada_em || `${r.data}T${r.inicio}`;
        eventos.push({ quando: criada, icone: "fa-solid fa-flask", cls: "", titulo: "Nova reserva", detalhe: `${sala}${quem} · para ${L.fmtData(r.data)} ${r.inicio}`, href });
        if (r.cancelada_em) eventos.push({ quando: r.cancelada_em, icone: "fa-solid fa-ban", cls: "danger", titulo: "Reserva cancelada", detalhe: `${sala}${quem} · ${L.fmtData(r.data)} ${r.inicio}`, href });
      });
      emprestimos.forEach((e) => {
        const chave = (e.chave && e.chave.codigo) || "Chave";
        const quem = (e.usuario && e.usuario.nome) || "";
        if (e.retirada_em) eventos.push({ quando: e.retirada_em, icone: "fa-solid fa-key", cls: "warn", titulo: "Registro de retirada", detalhe: `${chave}${quem ? " · " + quem : ""}`, href: "chave-historico.html" });
        if (e.devolvida_em) eventos.push({ quando: e.devolvida_em, icone: "fa-solid fa-clock-rotate-left", cls: "ok", titulo: "Devolução de chave", detalhe: `${chave}${quem ? " · " + quem : ""}`, href: "chave-historico.html" });
      });
      const lista = eventos.filter((ev) => new Date(ev.quando) <= agora)
        .sort((a, b) => new Date(b.quando) - new Date(a.quando)).slice(0, 6);

      alvo.innerHTML = lista.length
        ? `<div class="list notice-grid">${lista.map((ev) => `
            <a class="list-item" href="${ev.href}">
              <span class="list-icon ${ev.cls}"><i class="${ev.icone}"></i></span>
              <span class="list-main"><b>${L.esc(ev.titulo)}</b><span>${L.esc(ev.detalhe)}</span></span>
              <span class="list-hora">${L.esc(L.fmtDataHora(ev.quando))}</span>
            </a>`).join("")}</div>`
        : vazio("fa-regular fa-bell", "Sem atividade recente", "Suas reservas e movimentações aparecem aqui.");
    } catch (e) { alvo.innerHTML = vazio("fa-solid fa-triangle-exclamation", "Não foi possível carregar", "Tente recarregar a página."); L.erro(e); }
  })();
});
