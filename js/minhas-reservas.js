/* Minhas reservas - abas Próximas / Histórico / Canceladas, resumo e cancelamento.
   Autoria original: Luiz Cláudio (branch feat/reservar-sala-minhas-reservas). Padronizado na integração. */
LABTECH.pronto.then(async () => {
  const L = LABTECH;
  const api = L.api;
  const $ = (id) => document.getElementById(id);
  const paraMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };

  const lista = $("listaReservas");
  let reservas = [];
  let aba = "proximas";

  // situação efetiva: usa "situacao" da api e, por segurança, a data de término
  function situacao(r) {
    const s = r.situacao || r.status;
    if (s === "cancelada" || s === "recusada") return "cancelada";
    if (s === "concluida" || new Date(`${r.data}T${r.fim}`) <= new Date()) return "concluida";
    return s || "confirmada";
  }
  const grupo = (r) => { const s = situacao(r); return s === "cancelada" ? "canceladas" : s === "concluida" ? "historico" : "proximas"; };
  const chave = (r) => r.data + r.inicio;

  /* ---------- resumo ---------- */
  function resumo() {
    const prox = reservas.filter((r) => grupo(r) === "proximas").sort((a, b) => chave(a).localeCompare(chave(b)));
    const validas = reservas.filter((r) => grupo(r) !== "canceladas");
    const mes = L.hojeISO().slice(0, 7);
    const minutosMes = validas.filter((r) => r.data.slice(0, 7) === mes).reduce((t, r) => t + Math.max(0, paraMin(r.fim) - paraMin(r.inicio)), 0);
    const horas = minutosMes / 60;
    $("stProximas").textContent = prox.length;
    $("stProxima").textContent = prox.length ? `Próxima: ${L.fmtDataLonga(prox[0].data)}, ${prox[0].inicio}` : "Nenhuma agendada";
    $("stHoras").textContent = Number.isInteger(horas) ? `${horas}h` : `${horas.toFixed(1).replace(".", ",")}h`;
    $("stMes").textContent = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    $("stSalas").textContent = new Set(validas.map((r) => r.sala_id)).size;
    const concl = reservas.filter((r) => grupo(r) === "historico").length;
    $("stConcluidas").textContent = `${concl} ${concl === 1 ? "reserva concluída" : "reservas concluídas"}`;
    $("cProximas").textContent = prox.length;
    $("cHistorico").textContent = concl;
    $("cCanceladas").textContent = reservas.filter((r) => grupo(r) === "canceladas").length;
  }

  /* ---------- lista ---------- */
  const VAZIO = {
    proximas: ["fa-regular fa-calendar-plus", "Seu próximo encontro começa aqui", "Você ainda não tem reservas agendadas. Encontre um espaço e reserve um tempo para suas ideias.", true],
    historico: ["fa-solid fa-clock-rotate-left", "Nenhuma reserva concluída", "As reservas aparecerão aqui quando forem concluídas.", false],
    canceladas: ["fa-regular fa-calendar-xmark", "Nenhuma reserva cancelada", "As reservas aparecerão aqui quando forem canceladas.", false]
  };

  function itemHTML(r) {
    const d = new Date(r.data + "T12:00:00");
    const s = situacao(r);
    const sala = r.sala || {};
    const acoes = aba === "proximas"
      ? `<button type="button" class="btn btn-secondary btn-sm" data-cancelar="${r.id}"><i class="fa-regular fa-calendar-xmark"></i> Cancelar</button>`
      : aba === "historico"
        ? `<a class="btn btn-secondary btn-sm" href="reservar-sala.html?sala=${encodeURIComponent(r.sala_id)}"><i class="fa-solid fa-rotate-right"></i> Reservar de novo</a>`
        : "";
    return `<article class="reserva-item${s === "cancelada" ? " cancelada" : ""}">
      <div class="date-box" aria-hidden="true">${L.esc(d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""))}<strong>${d.getDate()}</strong></div>
      <div class="reserva-detalhe">
        <h3>${L.esc(sala.nome || "Sala removida")}</h3>
        <p>${L.esc(r.finalidade)}</p>
        <div class="meta">
          <span><i class="fa-regular fa-calendar"></i>${L.esc(L.fmtDataLonga(r.data))} · ${L.esc(L.fmtData(r.data))}</span>
          <span><i class="fa-regular fa-clock"></i>${L.esc(r.inicio)} – ${L.esc(r.fim)}</span>
          ${sala.bloco ? `<span><i class="fa-solid fa-location-dot"></i>${L.esc(sala.codigo || "")} · Bloco ${L.esc(sala.bloco)}</span>` : ""}
          <span><i class="fa-solid fa-users"></i>${Number(r.participantes) || 1} ${Number(r.participantes) === 1 ? "pessoa" : "pessoas"}</span>
        </div>
      </div>
      <div class="reserva-acoes">${L.badgeReserva(s)}${acoes}</div>
    </article>`;
  }

  function render() {
    const doGrupo = reservas.filter((r) => grupo(r) === aba)
      .sort((a, b) => aba === "proximas" ? chave(a).localeCompare(chave(b)) : chave(b).localeCompare(chave(a)));
    if (!doGrupo.length) {
      const [icone, titulo, texto, cta] = VAZIO[aba];
      lista.innerHTML = `<div class="empty-state"><i class="${icone}"></i><b>${titulo}</b><p>${texto}</p>${cta ? `<a class="btn btn-primary" href="reservar-sala.html">Explorar espaços <i class="fa-solid fa-arrow-right"></i></a>` : ""}</div>`;
      return;
    }
    lista.innerHTML = doGrupo.map(itemHTML).join("");
  }

  async function carregar() {
    try {
      reservas = await api.bookings.list({ mine: true, incluirCanceladas: true });
      resumo();
      render();
    } catch (e) {
      L.erro(e);
      lista.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><b>Não foi possível carregar suas reservas</b><p>Recarregue a página para tentar de novo.</p></div>`;
    }
  }

  /* ---------- eventos ---------- */
  document.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => {
    aba = b.dataset.aba;
    document.querySelectorAll("[data-aba]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-selected", String(x === b)); });
    render();
  }));

  lista.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cancelar]");
    if (!b) return;
    const r = reservas.find((x) => x.id === Number(b.dataset.cancelar));
    if (!r) return;
    const nome = (r.sala && r.sala.nome) || "esta sala";
    // L.modal (em vez de L.confirmar) para o botão de saída dizer "Manter reserva", como no original
    const ok = await L.modal({
      titulo: "Cancelar reserva?", perigo: true, confirmar: "Cancelar reserva", cancelar: "Manter reserva",
      corpo: `<p class="muted"><b>${L.esc(nome)}</b>, ${L.esc(L.fmtData(r.data))} das ${L.esc(r.inicio)} às ${L.esc(r.fim)}.</p>
              <p class="muted">O espaço será liberado e a reserva ficará no histórico de canceladas.</p>`
    });
    if (!ok) return;
    try {
      await api.bookings.cancel(r.id);
      L.toast("Reserva cancelada. O espaço está livre para novas ideias.");
    } catch (err) {
      L.erro(err);
    }
    carregar();
  });

  await carregar();
});
