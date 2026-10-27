/* Detalhes da Sala - cabeçalho, recursos, grade de disponibilidade, reservas, chaves */
(function () {
  const L = window.LABTECH;
  const id = parseInt(L.qs("id"), 10) || 1;
  const sala = L.SALAS.find((s) => s.id === id);
  const root = document.getElementById("detail");

  if (!sala) {
    root.innerHTML = `<div class="empty-state"><i class="fa-solid fa-door-closed"></i><b>Sala não encontrada.</b><br><a class="btn btn-primary" style="margin-top:14px" href="salas.html">Voltar para a lista</a></div>`;
    return;
  }

  document.title = `${sala.codigo} · ${sala.nome} - LabReserva UDF`;
  document.getElementById("bcAtual").textContent = sala.codigo;
  document.getElementById("topSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") location.href = `salas.html?q=${encodeURIComponent(e.target.value)}`;
  });

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

  function inicioSemana(offset) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const dow = d.getDay();               // 0 dom .. 6 sáb
    d.setDate(d.getDate() - ((dow + 6) % 7) + offset * 7); // segunda
    return d;
  }
  const fmt = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  /* ---------- grade semanal ---------- */
  function scheduleHTML() {
    const { dias, horas, grade } = L.gradeSemanal(sala, semana);
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
        const title = `${d} ${fmt(dt)} · ${String(hr).padStart(2, "0")}:00–${String(hr + 1).padStart(2, "0")}:00 · ${L.statusLabel(st)}`;
        h += `<div class="slot ${st} ${past ? "past" : ""} ${sel}" data-dia="${d}" data-hora="${hr}" data-data="${dt.toISOString().slice(0, 10)}" data-status="${st}" title="${esc(title)}" role="${st === "available" && !past ? "button" : "img"}" aria-label="${esc(title)}"></div>`;
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
        <span class="legend-item"><i class="dot occupied"></i> Ocupado (aula)</span>
        <span class="legend-item"><i class="dot reserved"></i> Reservado</span>
        <span class="legend-item"><i class="dot maintenance"></i> Manutenção</span>
      </div>
      <div class="schedule-wrap">${h}</div>
      <div class="schedule-foot">
        <span class="selection-hint" id="selHint">${hint}</span>
        <a class="btn btn-gold btn-sm ${selecao ? "" : "is-disabled"}" id="btnReservarSlot" href="#" data-action="nova-reserva" data-sala="${esc(sala.codigo)}"><i class="fa-regular fa-calendar-plus"></i> Reservar este horário</a>
      </div>`;
  }

  function renderSchedule() {
    const box = document.getElementById("schedulePanel");
    box.innerHTML = scheduleHTML();
    document.getElementById("prevWeek").onclick = () => { semana--; selecao = null; renderSchedule(); };
    document.getElementById("nextWeek").onclick = () => { semana++; selecao = null; renderSchedule(); };
    box.querySelectorAll(".slot.available:not(.past)").forEach((s) => {
      s.addEventListener("click", () => {
        selecao = { dia: s.dataset.dia, hora: parseInt(s.dataset.hora, 10), dt: new Date(s.dataset.data + "T00:00:00"), data: s.dataset.data };
        renderSchedule();
      });
    });
    const btn = document.getElementById("btnReservarSlot");
    if (selecao) {
      // quando a tela de Nova Reserva existir, basta ela ler estes parâmetros:
      btn.setAttribute("data-sala", `${sala.codigo} em ${L.fmtData(selecao.data)} às ${String(selecao.hora).padStart(2, "0")}:00`);
      btn.dataset.href = `nova-reserva.html?sala=${sala.id}&data=${selecao.data}&inicio=${String(selecao.hora).padStart(2, "0")}:00&fim=${String(selecao.hora + 1).padStart(2, "0")}:00`;
    }
  }

  /* ---------- reservas ---------- */
  function reservasHTML() {
    const lista = (L.RESERVAS[sala.id] || []).slice().sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
    if (!lista.length) return `<p class="muted" style="margin-top:8px">Nenhuma reserva futura para este espaço.</p>`;
    return `
      <div class="table-wrap" style="margin-top:8px">
        <table class="table">
          <thead><tr><th>Data</th><th>Horário</th><th>Solicitante</th><th>Finalidade</th><th>Status</th></tr></thead>
          <tbody>${lista.map((r) => `
            <tr>
              <td>${L.fmtData(r.data)}</td>
              <td>${esc(r.inicio)}–${esc(r.fim)}</td>
              <td>${esc(r.solicitante)}</td>
              <td>${esc(r.finalidade)}</td>
              <td><span class="res-status ${r.status}"><i class="fa-solid ${r.status === "confirmada" ? "fa-circle-check" : "fa-hourglass-half"}"></i>${r.status === "confirmada" ? "Confirmada" : "Pendente"}</span></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  /* ---------- página ---------- */
  const podeReservar = sala.status !== "maintenance";
  const cover = L.tipoCover(sala.tipo);
  const chave = keyLabel[sala.chave?.status || "nao_aplica"];
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
              <a class="btn btn-gold ${podeReservar ? "" : "is-disabled"}" href="#" data-action="nova-reserva" data-sala="${esc(sala.codigo)}"><i class="fa-regular fa-calendar-plus"></i> Reservar esta sala</a>
              <a class="btn btn-secondary" href="#" data-action="em-breve"><i class="fa-solid fa-triangle-exclamation"></i> Reportar problema</a>
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
          <div class="panel-head"><h3><span class="panel-icon"><i class="fa-regular fa-calendar-days"></i></span> Próximas reservas</h3><a class="btn btn-link btn-sm" href="#" data-action="em-breve">Ver todas</a></div>
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
          <div class="side-actions" style="margin-top:12px">
            <a class="btn btn-secondary btn-sm" href="#" data-action="em-breve"><i class="fa-solid fa-arrow-right-from-bracket"></i> Registrar retirada</a>
            <a class="btn btn-secondary btn-sm" href="#" data-action="em-breve"><i class="fa-solid fa-arrow-right-to-bracket"></i> Registrar devolução</a>
          </div>
        </article>

        <article class="panel side-card">
          <h3><span class="panel-icon"><i class="fa-solid fa-clipboard-list"></i></span> Regras de uso</h3>
          <ul class="rules">${regras.map((r) => `<li><i class="fa-solid fa-circle-check"></i><span>${esc(r)}</span></li>`).join("")}</ul>
        </article>

        <article class="panel side-card">
          <h3><span class="panel-icon"><i class="fa-solid fa-bolt"></i></span> Ações rápidas</h3>
          <div class="side-actions" style="margin-top:10px">
            <a class="btn btn-primary btn-sm ${podeReservar ? "" : "is-disabled"}" href="#" data-action="nova-reserva" data-sala="${esc(sala.codigo)}"><i class="fa-regular fa-calendar-plus"></i> Nova reserva</a>
            <a class="btn btn-secondary btn-sm" href="#" data-action="em-breve"><i class="fa-regular fa-bookmark"></i> Minhas reservas</a>
            <a class="btn btn-secondary btn-sm" href="salas.html?bloco=${esc(sala.bloco)}"><i class="fa-solid fa-building"></i> Outros espaços do bloco ${esc(sala.bloco)}</a>
          </div>
          <div class="admin-only">
            <small><i class="fa-solid fa-lock"></i> Somente administradores</small>
            <div class="side-actions">
              <a class="btn btn-secondary btn-sm" href="#" data-action="em-breve"><i class="fa-solid fa-pen"></i> Editar sala</a>
              <a class="btn btn-secondary btn-sm" href="#" data-action="em-breve"><i class="fa-solid fa-screwdriver-wrench"></i> Marcar manutenção</a>
            </div>
          </div>
        </article>
      </aside>
    </div>`;

  renderSchedule();
})();
