/* Detalhes da Sala - cabeçalho, recursos, grade de disponibilidade, reservas, chaves */
LABTECH.pronto.then(async () => {
  const L = window.LABTECH;
  const real = L.CONFIG.modo === "api";
  const id = parseInt(L.qs("id"), 10) || (real ? 0 : 1);
  const root = document.getElementById("detail");
  root.innerHTML = '<div class="loading">Carregando sala...</div>';
  if (real) {
    const topSearch = document.getElementById("topSearch");
    if (topSearch) {
      topSearch.placeholder = "Buscar código do espaço";
      topSearch.setAttribute("aria-label", "Buscar código do espaço");
      topSearch.addEventListener("keydown", (e) => {
        if (e.key === "Enter") location.href = `salas.html?q=${encodeURIComponent(e.target.value)}`;
      });
    }
    let s;
    try { s = await L.api.spaces.get(id); }
    catch (e) {
      root.innerHTML = `<div class="empty-state"><i class="fa-solid fa-door-closed"></i><b>${e.status === 404 ? "Sala não encontrada." : "Não foi possível carregar a sala."}</b><br><a class="btn btn-primary" href="salas.html">Voltar para a lista</a></div>`;
      return;
    }
    document.title = `${s.codigo} · LabReserva UDF`;
    document.getElementById("breadcrumbAtual").textContent = s.codigo;
    const cover = L.tipoCover(s.tipo);
    root.innerHTML = `<div class="detail-layout"><div class="detail-main">
      <article class="panel room-hero"><div class="info"><span class="code">${L.esc(s.codigo)}</span><h1>${L.esc(s.codigo)}</h1>
      <div class="type"><i class="fa-solid fa-layer-group"></i> ${L.esc(L.tipoLabel(s.tipo))}</div>
      <div class="cta"><a class="btn btn-gold" href="reservar-sala.html?sala=${s.id}">Reservar esta sala</a>
      <a class="btn btn-secondary" href="agenda.html?sala=${s.id}">Ver agenda</a><a class="btn btn-ghost" href="salas.html">Voltar</a></div></div>
      <div class="visual ${cover.cls}"><div class="placeholder"><i class="${cover.icon}"></i></div><small>${L.esc(s.codigo)}</small></div></article>
      <article class="panel"><div class="panel-head"><h3><span class="panel-icon"><i class="fa-regular fa-calendar-check"></i></span> Disponibilidade</h3></div>
      <div class="form-grid" style="padding:16px"><div class="form-field"><label for="detData">Data</label><input id="detData" type="date"></div>
      <div class="form-field"><label for="detInicio">Início</label><input id="detInicio" type="time" value="10:00"></div>
      <div class="form-field"><label for="detFim">Fim</label><input id="detFim" type="time" value="11:00"></div>
      <button class="btn btn-primary" type="button" id="detConsultar">Consultar</button></div><p class="muted" id="detResultado" style="padding:0 16px 16px"></p></article>
      </div><aside class="detail-side"><article class="panel side-card"><h3>Ações rápidas</h3><div class="side-actions">
      <a class="btn btn-primary btn-sm" href="reservar-sala.html?sala=${s.id}">Nova reserva</a>
      <a class="btn btn-secondary btn-sm" href="minhas-reservas.html">Minhas reservas</a></div></article></aside></div>`;
    const data = document.getElementById("detData"); data.value = L.hojeISO();
    document.getElementById("detConsultar").addEventListener("click", async () => {
      const resultado = document.getElementById("detResultado");
      resultado.textContent = "Consultando...";
      try {
        const r = await L.api.spaces.availability(s.id, { data: data.value, inicio: document.getElementById("detInicio").value, fim: document.getElementById("detFim").value });
        resultado.textContent = r.available ? "Horário disponível para reserva." : "Horário ocupado. Escolha outro intervalo.";
      } catch (e) { resultado.textContent = e.message || "Falha ao consultar disponibilidade."; }
    });
    return;
  }
  let sala = null, chaves = [], proximas = [];
  try {
    sala = await L.api.spaces.get(id);
    const [todasChaves, lista] = await Promise.all([L.api.keys.list(), L.api.bookings.list({ sala_id: id, de: L.hojeISO(), ate: L.hojeISO(30) })]);
    chaves = todasChaves.filter((k) => k.sala_id === id);
    proximas = lista.filter((r) => r.situacao === "confirmada" || r.situacao === "pendente");
  } catch (e) { if (!e || e.code !== "NOT_FOUND") L.erro(e); }

  if (!sala) {
    root.innerHTML = `<div class="empty-state"><i class="fa-solid fa-door-closed"></i><b>Sala não encontrada.</b><br><a class="btn btn-primary" style="margin-top:14px" href="salas.html">Voltar para a lista</a></div>`;
    return;
  }

  document.title = `${sala.codigo} · ${sala.nome} - LabReserva UDF`;
  document.getElementById("breadcrumbAtual").textContent = sala.codigo;
  const topSearch = document.getElementById("topSearch");
  if (topSearch) topSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") location.href = `salas.html?q=${encodeURIComponent(e.target.value)}`;
  });
  const gestao = L.pode("employee", "admin"), admin = L.pode("admin");
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const paraMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  let reservasSemana = [];
  async function carregarSemana() {
    const seg = inicioSemana(semana), sab = new Date(seg); sab.setDate(seg.getDate() + 5);
    try { reservasSemana = await L.api.bookings.list({ sala_id: sala.id, de: isoLocal(seg), ate: isoLocal(sab) }); } catch (e) { L.erro(e); reservasSemana = []; }
  }
  // grade seg..sáb, 7h-22h montada a partir das reservas reais
  function montarGrade() {
    const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], horas = [];
    for (let h = 7; h < 22; h++) horas.push(h);
    const seg = inicioSemana(semana), grade = {}, info = {};
    dias.forEach((d, i) => {
      const dt = new Date(seg); dt.setDate(seg.getDate() + i); const iso = isoLocal(dt);
      grade[d] = {}; info[d] = {};
      horas.forEach((h) => {
        if (sala.status === "maintenance") { grade[d][h] = "maintenance"; return; }
        const r = reservasSemana.find((x) => x.data === iso && x.status !== "cancelada" && paraMin(x.inicio) < (h + 1) * 60 && h * 60 < paraMin(x.fim));
        grade[d][h] = r ? "reserved" : "available"; info[d][h] = r || null;
      });
    });
    return { dias, horas, grade, info };
  }

  let semana = 0;          // 0 = semana atual, -1 anterior, +1 próxima
  let selecao = null;      // { dia, hora }

  /* ---------- helpers ---------- */
  const esc = L.esc;
  const recursoItem = (key) => {
    const r = L.RECURSOS[key]; if (!r) return "";
    const q = sala.qtd && sala.qtd[key];
    return `<div class="resource"><i class="${r.icon}"></i><div><b>${esc(r.label)}</b>${q ? `<small>${q} unidade${q > 1 ? "s" : ""}</small>` : `<small>Disponível</small>`}</div></div>`;
  };
  const keyLabel = { disponivel: ["fa-solid fa-key", "Chave disponível para retirada"], retirada: ["fa-solid fa-user-clock", "Chave retirada (em uso)"], nao_aplica: ["fa-solid fa-ban", "Retirada suspensa"] };
  const linkReserva = (data, ini, fim) => `reservar-sala.html?sala=${sala.id}${data ? `&data=${data}&inicio=${ini}&fim=${fim}` : ""}`;

  function inicioSemana(offset) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const dow = d.getDay();               // 0 dom .. 6 sáb
    // domingo (fechado) já mostra a próxima semana
    d.setDate(d.getDate() - (dow === 0 ? -1 : dow - 1) + offset * 7); // segunda
    return d;
  }
  const fmt = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  /* ---------- grade semanal ---------- */
  function scheduleHTML() {
    const { dias, horas, grade, info } = montarGrade();
    const seg = inicioSemana(semana);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const agora = new Date();
    const sab = new Date(seg); sab.setDate(seg.getDate() + 5);

    let h = `<div class="schedule"><div class="head"></div>`;
    dias.forEach((d, i) => {
      const dt = new Date(seg); dt.setDate(seg.getDate() + i);
      const isToday = dt.getTime() === hoje.getTime();
      h += `<div class="head ${isToday ? "today" : ""}"><b>${d}</b>${fmt(dt)}</div>`;
    });
    horas.forEach((hr) => {
      h += `<div class="hour">${String(hr).padStart(2, "0")}h</div>`;
      dias.forEach((d, i) => {
        const dt = new Date(seg); dt.setDate(seg.getDate() + i); dt.setHours(hr);
        const past = dt < agora;
        const st = grade[d][hr];
        const sel = selecao && selecao.dia === d && selecao.hora === hr ? "selected" : "";
        const r = info[d][hr];
        const title = `${d} ${fmt(dt)} · ${String(hr).padStart(2, "0")}:00–${String(hr + 1).padStart(2, "0")}:00 · ${L.statusLabel(st)}${r ? ` · ${r.inicio}–${r.fim} ${r.finalidade}` : ""}`;
        h += `<div class="slot ${st} ${past ? "past" : ""} ${sel}" data-dia="${d}" data-hora="${hr}" data-data="${isoLocal(dt)}" data-status="${st}" title="${esc(title)}" role="${st === "available" && !past ? "button" : "img"}" aria-label="${esc(title)}"></div>`;
      });
    });
    h += `</div>`;

    const label = `${fmt(seg)} – ${fmt(sab)}`;
    const hint = selecao
      ? `<i class="fa-solid fa-circle-check" style="color:var(--ok-text)"></i> Selecionado: <b>${selecao.dia} ${fmt(selecao.dt)} · ${String(selecao.hora).padStart(2, "0")}:00–${String(selecao.hora + 1).padStart(2, "0")}:00</b>`
      : `<i class="fa-solid fa-hand-pointer"></i> Clique em um horário livre para iniciar uma reserva.`;

    return `
      <div class="panel-head">
        <h3><span class="panel-icon"><i class="fa-regular fa-calendar-check"></i></span> Disponibilidade</h3>
        <div class="week-nav">
          <button class="icon-btn" id="prevWeek" aria-label="Semana anterior"><i class="fa-solid fa-chevron-left"></i></button>
          <span class="label"><i class="fa-regular fa-calendar"></i> ${label}${semana === 0 ? " · esta semana" : ""}</span>
          <button class="icon-btn" id="nextWeek" aria-label="Próxima semana"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>
      <div class="legend">
        <span class="legend-item"><i class="dot available"></i> Livre</span>
        <span class="legend-item"><i class="dot reserved"></i> Reservado</span>
        <span class="legend-item"><i class="dot maintenance"></i> Manutenção</span>
      </div>
      <div class="schedule-wrap">${h}</div>
      <div class="schedule-foot">
        <span class="selection-hint" id="selHint">${hint}</span>
        <a class="btn btn-primary btn-sm ${selecao ? "" : "is-disabled"}" id="btnReservarSlot" href="${selecao ? linkReserva(selecao.data, pad2(selecao.hora) + ":00", pad2(selecao.hora + 1) + ":00") : "#"}"><i class="fa-regular fa-calendar-plus"></i> Reservar este horário</a>
      </div>`;
  }

  async function trocarSemana(delta) { semana += delta; selecao = null; await carregarSemana(); renderSchedule(); }
  function renderSchedule() {
    const box = document.getElementById("schedulePanel");
    box.innerHTML = scheduleHTML();
    document.getElementById("prevWeek").onclick = () => trocarSemana(-1);
    document.getElementById("nextWeek").onclick = () => trocarSemana(1);
    box.querySelectorAll(".slot.available:not(.past)").forEach((s) => {
      s.addEventListener("click", () => {
        selecao = { dia: s.dataset.dia, hora: parseInt(s.dataset.hora, 10), dt: new Date(s.dataset.data + "T00:00:00"), data: s.dataset.data };
        renderSchedule();
      });
    });
  }

  /* ---------- reservas ---------- */
  function reservasHTML() {
    const lista = proximas.slice(0, 8);
    if (!lista.length) return `<p class="muted" style="margin-top:8px">Nenhuma reserva nos próximos 30 dias.</p>`;
    return `
      <div class="table-wrap" style="margin-top:8px">
        <table class="table">
          <thead><tr><th>Data</th><th>Horário</th><th>Solicitante</th><th>Finalidade</th><th>Status</th></tr></thead>
          <tbody>${lista.map((r) => `
            <tr>
              <td>${L.fmtData(r.data)}</td>
              <td>${esc(r.inicio)}–${esc(r.fim)}</td>
              <td>${esc(r.usuario ? r.usuario.nome : "-")}</td>
              <td>${esc(r.finalidade)}</td>
              <td>${L.badgeReserva(r.situacao)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  /* ---------- página ---------- */
  const podeReservar = sala.status !== "maintenance";
  const cover = L.tipoCover(sala.tipo);
  const chave = keyLabel[sala.chave?.status || "nao_aplica"];
  const chaveLivre = chaves.find((k) => k.status === "disponivel");
  const chavesHTML = chaves.length ? `<ul class="list key-list">${chaves.map((k) => `
      <li class="list-item"><span class="list-icon ${k.status === "disponivel" ? "ok" : k.status === "emprestada" ? "warn" : ""}"><i class="fa-solid fa-key"></i></span>
        <div class="list-main"><b>${esc(k.codigo)}</b><span>${k.emprestimo && k.emprestimo.usuario ? `Com ${esc(k.emprestimo.usuario.nome)} desde ${esc(L.fmtHora(k.emprestimo.retirada_em))}` : esc(k.observacao || k.local || "")}</span></div>
        ${L.badgeChave(k.status)}</li>`).join("")}</ul>` : `<p class="muted">Nenhuma chave cadastrada para este espaço.</p>`;
  const regras = sala.regras || ["Mantenha o espaço organizado e limpo", "Respeite o horário reservado", "Comunique qualquer problema ao responsável"];

  root.innerHTML = `
    <div class="detail-layout">
      <div class="detail-main">

        <article class="panel room-hero">
          <div class="info">
            <span class="code">${esc(sala.codigo)}</span>
            <h1>${esc(sala.nome)}</h1>
            <div class="type"><i class="fa-solid fa-layer-group"></i> ${esc(L.tipoLabel(sala.tipo))}</div>
            <div class="status-row">${L.badge(sala.status)}<span class="muted"><i class="fa-regular fa-clock"></i> Próximo horário livre: ${esc(sala.proximoLivre)}</span></div>
            <div class="facts">
              <div class="fact"><i class="fa-solid fa-building"></i><div>Bloco ${esc(sala.bloco)} · ${esc(L.andarLabel(sala.andar))}<small>Localização</small></div></div>
              <div class="fact"><i class="fa-solid fa-user-group"></i><div>${sala.capacidade} lugares<small>Capacidade</small></div></div>
              <div class="fact"><i class="fa-solid fa-user-tie"></i><div>${esc(sala.responsavel)}<small>Responsável</small></div></div>
              <div class="fact"><i class="fa-solid fa-key"></i><div>${esc(sala.chave?.local || "-")}<small>Retirada de chave</small></div></div>
            </div>
            ${sala.descricao ? `<p class="desc">${esc(sala.descricao)}</p>` : ""}
            <div class="cta">
              <a class="btn btn-gold ${podeReservar ? "" : "is-disabled"}" href="${podeReservar ? linkReserva() : "#"}"><i class="fa-regular fa-calendar-plus"></i> Reservar esta sala</a>
              <a class="btn btn-secondary" href="agenda.html?sala=${sala.id}"><i class="fa-regular fa-calendar-days"></i> Ver agenda</a>
              <a class="btn btn-ghost" href="salas.html"><i class="fa-solid fa-arrow-left"></i> Voltar</a>
            </div>
          </div>
          <div class="visual ${cover.cls}">
            <div class="placeholder"><i class="${cover.icon}"></i>Foto do espaço (em breve)</div>
            <small>${esc(sala.codigo)}</small>
          </div>
        </article>

        <article class="panel">
          <div class="panel-head"><h3><span class="panel-icon"><i class="fa-solid fa-toolbox"></i></span> Recursos e equipamentos</h3><span class="muted">${(sala.recursos || []).length} itens</span></div>
          <div class="resources-grid">${(sala.recursos || []).map(recursoItem).join("")}</div>
          ${(sala.softwares || []).length ? `<div class="softwares"><h4><i class="fa-solid fa-compact-disc"></i> Softwares instalados</h4><div class="chips">${sala.softwares.map((s) => `<span class="chip"><i class="fa-solid fa-check"></i>${esc(s)}</span>`).join("")}</div></div>` : ""}
        </article>

        <article class="panel" id="schedulePanel"></article>

        <article class="panel">
          <div class="panel-head"><h3><span class="panel-icon"><i class="fa-regular fa-calendar-days"></i></span> Próximas reservas</h3><a class="btn btn-link btn-sm" href="agenda.html?sala=${sala.id}">Ver agenda completa</a></div>
          ${reservasHTML()}
        </article>
      </div>

      <aside class="detail-side">
        <article class="panel side-card">
          <h3><span class="panel-icon"><i class="fa-solid fa-key"></i></span> Chave</h3>
          <div class="kv">
            <div><i class="fa-solid fa-location-dot"></i><div>${esc(sala.chave?.local || "-")}<small>Onde retirar</small></div></div>
            <div><i class="${chave[0]}"></i><div><span class="key-status ${sala.chave?.status || "nao_aplica"}">${chave[1]}</span></div></div>
            <div><i class="fa-regular fa-clock"></i><div>Devolução até 22h<small>Prazo padrão</small></div></div>
          </div>
          ${chavesHTML}
          ${gestao ? `<div class="side-actions" style="margin-top:12px">
            <a class="btn btn-secondary btn-sm ${chaveLivre ? "" : "is-disabled"}" href="${chaveLivre ? `chaves.html?chave=${chaveLivre.id}` : "#"}"><i class="fa-solid fa-arrow-right-from-bracket"></i> Registrar retirada</a>
            <a class="btn btn-secondary btn-sm" href="chaves.html"><i class="fa-solid fa-arrow-right-to-bracket"></i> Registrar devolução</a>
            ${chaves[0] ? `<a class="btn btn-ghost btn-sm" href="chave-historico.html?chave=${chaves[0].id}"><i class="fa-solid fa-clock-rotate-left"></i> Histórico da chave</a>` : ""}
          </div>` : `<p class="form-hint" style="margin-top:10px">A retirada é registrada pelo funcionário no balcão.</p>`}
        </article>

        <article class="panel side-card">
          <h3><span class="panel-icon"><i class="fa-solid fa-clipboard-list"></i></span> Regras de uso</h3>
          <ul class="rules">${regras.map((r) => `<li><i class="fa-solid fa-circle-check"></i><span>${esc(r)}</span></li>`).join("")}</ul>
        </article>

        <article class="panel side-card">
          <h3><span class="panel-icon"><i class="fa-solid fa-bolt"></i></span> Ações rápidas</h3>
          <div class="side-actions" style="margin-top:10px">
            <a class="btn btn-primary btn-sm ${podeReservar ? "" : "is-disabled"}" href="${podeReservar ? linkReserva() : "#"}"><i class="fa-regular fa-calendar-plus"></i> Nova reserva</a>
            <a class="btn btn-secondary btn-sm" href="minhas-reservas.html"><i class="fa-regular fa-bookmark"></i> Minhas reservas</a>
            <a class="btn btn-secondary btn-sm" href="salas.html?bloco=${esc(sala.bloco)}"><i class="fa-solid fa-building"></i> Outros espaços do bloco ${esc(sala.bloco)}</a>
          </div>
          ${admin ? `<div class="admin-only">
            <small><i class="fa-solid fa-lock"></i> Somente administradores</small>
            <div class="side-actions">
              <a class="btn btn-secondary btn-sm" href="admin-salas.html?editar=${sala.id}"><i class="fa-solid fa-pen"></i> Editar sala</a>
              <button class="btn btn-secondary btn-sm" type="button" id="btnManutencao"><i class="fa-solid fa-screwdriver-wrench"></i> ${sala.manutencao ? "Encerrar manutenção" : "Marcar manutenção"}</button>
            </div>
          </div>` : ""}
        </article>
      </aside>
    </div>`;

  await carregarSemana();
  renderSchedule();

  // administrador: liga/desliga manutenção da sala
  const btnManut = document.getElementById("btnManutencao");
  if (btnManut) btnManut.addEventListener("click", async () => {
    const marcar = !sala.manutencao;
    const ok = await L.confirmar(marcar ? "Marcar manutenção" : "Encerrar manutenção",
      marcar ? "A sala deixa de aceitar novas reservas até a manutenção ser encerrada." : "A sala volta a aceitar reservas.", marcar ? "Marcar manutenção" : "Encerrar manutenção", marcar);
    if (!ok) return;
    try { await L.api.spaces.update(sala.id, { manutencao: marcar }); L.toast(marcar ? "Sala marcada em manutenção." : "Manutenção encerrada."); setTimeout(() => location.reload(), 600); }
    catch (e) { L.erro(e); }
  });
});
