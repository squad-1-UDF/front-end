/* Reservar sala - catálogo de salas, filtros e dialog de reserva com checagem de horário.
   Autoria original: Luiz Cláudio (branch feat/reservar-sala-minhas-reservas). Padronizado na integração.
   Parâmetros aceitos: ?sala=<id>&data=YYYY-MM-DD&inicio=HH:MM&fim=HH:MM (abre o dialog preenchido). */
LABTECH.pronto.then(async () => {
  const L = LABTECH;
  const api = L.api;
  const real = L.CONFIG.modo === "api";
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const paraMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
  const deMin = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const ABRE = paraMin((L.CONFIG && L.CONFIG.horaAbertura) || "07:00");
  const FECHA = paraMin((L.CONFIG && L.CONFIG.horaFechamento) || "22:00");
  const PASSO = 30;

  const el = {
    busca: $("fBusca"), tipo: $("fTipo"), cap: $("fCapacidade"), grade: $("gradeSalas"), contagem: $("contagem"),
    aviso: $("avisoReserva"), topo: $("topSearch"),
    dlg: $("dlgReserva"), form: $("formReserva"), titulo: $("dlgTitulo"), desc: $("dlgDescricao"),
    finalidade: $("rFinalidade"), data: $("rData"), part: $("rParticipantes"), ini: $("rInicio"), fim: $("rFim"),
    status: $("dispStatus"), ocupados: $("ocupadosLista"), erro: $("rErro"), confirmar: $("rConfirmar")
  };
  if (real) {
    el.cap.closest(".field").hidden = true;
    [el.finalidade, el.part].forEach((x) => { x.closest(".form-field").hidden = true; x.required = false; });
    el.busca.placeholder = "Código do espaço";
    el.form.querySelector(".modal-body > .form-hint").textContent = "Escolha um horário futuro. A disponibilidade é confirmada pela API no envio.";
  }

  let salas = [];
  let salaSel = null;

  /* ---------- opções fixas (tipos e horários) ---------- */
  el.tipo.insertAdjacentHTML("beforeend", Object.entries(L.TIPOS || {}).map(([k, v]) => `<option value="${L.esc(k)}">${L.esc(v)}</option>`).join(""));
  const opcoesHora = (de, ate) => { let h = ""; for (let m = de; m <= ate; m += PASSO) h += `<option value="${deMin(m)}">${deMin(m)}</option>`; return h; };
  el.ini.innerHTML = opcoesHora(ABRE, FECHA - PASSO);
  el.fim.innerHTML = opcoesHora(ABRE + PASSO, FECHA);
  // garante que um horário vindo da URL exista no select (ex.: 08:15)
  const definirHora = (sel, v) => {
    if (!v || !/^\d{2}:\d{2}$/.test(v)) return;
    if (![...sel.options].some((o) => o.value === v)) sel.insertAdjacentHTML("beforeend", `<option value="${L.esc(v)}">${L.esc(v)}</option>`);
    sel.value = v;
  };

  /* ---------- catálogo ---------- */
  const norm = (s) => String(s || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");

  function cardHTML(s) {
    if (real) {
      const capa = L.tipoCover(s.tipo);
      return `<article class="panel hover sala-card"><div class="sala-capa ${capa.cls}"><i class="${capa.icon}" aria-hidden="true"></i><span class="sala-codigo">${L.esc(s.codigo)}</span></div>
        <div class="sala-corpo"><span class="sala-tipo">${L.esc(L.tipoLabel(s.tipo))}</span><h3>${L.esc(s.codigo)}</h3><div class="sala-acoes">
        <button type="button" class="btn btn-primary btn-sm" data-reservar="${s.id}">Reservar</button>
        <a class="btn btn-secondary btn-sm" href="agenda.html?sala=${s.id}">Agenda</a></div></div></article>`;
    }
    const capa = L.tipoCover(s.tipo);
    const recursos = (s.recursos || []).slice(0, 4).map(L.recursoChip).join("");
    const extra = (s.recursos || []).length > 4 ? `<span class="chip">+${s.recursos.length - 4}</span>` : "";
    const manut = s.manutencao || s.status === "maintenance";
    return `<article class="panel hover sala-card">
      <div class="sala-capa ${capa.cls}">
        ${L.badge(s.status)}
        <i class="${capa.icon}" aria-hidden="true"></i>
        <span class="sala-codigo">${L.esc(s.codigo)}</span>
      </div>
      <div class="sala-corpo">
        <span class="sala-tipo">${L.esc(L.tipoLabel(s.tipo))}</span>
        <h3>${L.esc(s.nome)}</h3>
        <div class="meta">
          <span><i class="fa-solid fa-location-dot"></i>Bloco ${L.esc(s.bloco)} · ${L.esc(L.andarLabel(s.andar))}</span>
          <span><i class="fa-solid fa-users"></i>Até ${Number(s.capacidade) || 0} pessoas</span>
        </div>
        <div class="chips">${recursos}${extra}</div>
        ${manut ? `<p class="sala-aviso"><i class="fa-solid fa-screwdriver-wrench"></i> Em manutenção${s.previsaoManutencao ? ": " + L.esc(s.previsaoManutencao) : ""}</p>` : ""}
        <div class="sala-acoes">
          <button type="button" class="btn btn-primary btn-sm" data-reservar="${s.id}" ${manut ? "disabled" : ""}>
            <i class="fa-regular fa-calendar-plus"></i> ${manut ? "Indisponível" : "Reservar"}</button>
          <a class="btn btn-secondary btn-sm" href="agenda.html?sala=${s.id}" aria-label="Ver agenda de ${L.esc(s.nome)}"><i class="fa-regular fa-calendar"></i> Agenda</a>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const q = norm(el.busca.value.trim());
    const tipo = el.tipo.value;
    const cap = Number(el.cap.value) || 0;
    const lista = salas.filter((s) =>
      (!q || norm(`${s.nome} ${s.codigo} bloco ${s.bloco}`).includes(q)) &&
      (!tipo || s.tipo === tipo) &&
      (real || (Number(s.capacidade) || 0) >= cap));
    el.contagem.textContent = `${lista.length} ${lista.length === 1 ? "espaço encontrado" : "espaços encontrados"} no campus`;
    el.grade.innerHTML = lista.length ? lista.map(cardHTML).join("") :
      `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><b>Nenhum espaço encontrado</b><p>Tente outro nome ou ajuste os filtros.</p></div>`;
  }

  // busca da página e da topbar ficam sincronizadas
  el.busca.addEventListener("input", () => { if (el.topo) el.topo.value = el.busca.value; render(); });
  if (el.topo) el.topo.addEventListener("input", () => { el.busca.value = el.topo.value; render(); });
  el.tipo.addEventListener("change", render);
  el.cap.addEventListener("change", render);

  async function carregarSalas() {
    try {
      salas = await api.spaces.list();
      render();
    } catch (e) {
      L.erro(e);
      el.contagem.textContent = "";
      el.grade.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><b>Não foi possível carregar as salas</b><p>Recarregue a página para tentar de novo.</p></div>`;
    }
  }

  /* ---------- dialog: disponibilidade e horários ocupados ---------- */
  let seqDisp = 0, seqOcup = 0, timer = null;

  function mostrarStatus(tipo, icone, texto) {
    el.status.className = "disp-status" + (tipo ? " " + tipo : "");
    el.status.innerHTML = `<i class="${icone}"></i> ${L.esc(texto)}`;
  }
  const ehDomingo = (iso) => new Date(iso + "T12:00:00").getDay() === 0;

  async function verificar() {
    const seq = ++seqDisp;
    const data = el.data.value, inicio = el.ini.value, fim = el.fim.value;
    if (!salaSel) return;
    if (!data) return mostrarStatus("", "fa-regular fa-calendar", "Escolha a data para verificar o horário.");
    if (!real && ehDomingo(data)) return mostrarStatus("ocupado", "fa-solid fa-ban", "Domingo: o campus está fechado.");
    if (paraMin(inicio) >= paraMin(fim)) return mostrarStatus("ocupado", "fa-solid fa-circle-exclamation", "O término deve ser após o início.");
    if (new Date(`${data}T${inicio}`) < new Date()) return mostrarStatus("ocupado", "fa-solid fa-clock-rotate-left", "Escolha um horário futuro.");
    mostrarStatus("", "fa-solid fa-spinner fa-spin", "Verificando disponibilidade...");
    try {
      const r = await api.spaces.availability(salaSel.id, { data, inicio, fim });
      if (seq !== seqDisp) return; // resposta antiga: o usuário já mudou os campos
      if (r.available) mostrarStatus("livre", "fa-solid fa-circle-check", `Horário livre: ${inicio} às ${fim}.`);
      else mostrarStatus("ocupado", "fa-solid fa-circle-xmark", "Horário ocupado. Escolha outro intervalo.");
    } catch (e) {
      if (seq !== seqDisp) return;
      mostrarStatus("ocupado", "fa-solid fa-circle-exclamation", e.message || "Não foi possível verificar o horário.");
    }
  }

  async function carregarOcupados() {
    const seq = ++seqOcup;
    const data = el.data.value;
    if (!salaSel || !data) { el.ocupados.innerHTML = ""; return; }
    el.ocupados.innerHTML = `<span class="muted">Carregando...</span>`;
    try {
      const lista = real ? await api.bookings.agenda(salaSel.id, { de: data, ate: data }) : await api.bookings.list({ sala_id: salaSel.id, de: data, ate: data });
      if (seq !== seqOcup) return;
      const ativas = lista.filter((r) => r.situacao !== "cancelada" && r.status !== "cancelada");
      el.ocupados.innerHTML = ativas.length
        ? ativas.map((r) => `<span class="chip ocupado"><i class="fa-regular fa-clock"></i>${L.esc(r.inicio)} – ${L.esc(r.fim)}</span>`).join("")
        : `<span class="muted">Nenhuma reserva neste dia. A sala está livre o dia todo.</span>`;
    } catch (e) {
      if (seq !== seqOcup) return;
      el.ocupados.innerHTML = `<span class="muted">Não foi possível carregar os horários.</span>`;
    }
  }

  const agendarVerificacao = () => { clearTimeout(timer); timer = setTimeout(verificar, 250); };

  // se o término ficar antes do início, empurra para 1h depois
  el.ini.addEventListener("change", () => {
    if (paraMin(el.fim.value) <= paraMin(el.ini.value)) definirHora(el.fim, deMin(Math.min(paraMin(el.ini.value) + 60, FECHA)));
    agendarVerificacao();
  });
  el.fim.addEventListener("change", agendarVerificacao);
  el.data.addEventListener("change", () => { agendarVerificacao(); carregarOcupados(); });

  function abrirDialog(sala, pre = {}) {
    salaSel = sala;
    el.form.reset();
    el.erro.textContent = "";
    el.titulo.textContent = sala.nome;
    el.desc.textContent = real ? `${sala.codigo} · ${L.tipoLabel(sala.tipo)}` : `${sala.codigo} · Bloco ${sala.bloco} · Até ${sala.capacidade} pessoas`;
    if (!real) el.part.max = sala.capacidade;
    el.data.min = L.hojeISO();
    el.data.value = pre.data && /^\d{4}-\d{2}-\d{2}$/.test(pre.data) ? pre.data : L.hojeISO();
    // horário padrão: próxima meia hora cheia (dentro do funcionamento)
    const agora = new Date();
    let padrao = Math.ceil((agora.getHours() * 60 + agora.getMinutes() + 1) / PASSO) * PASSO;
    if (el.data.value !== L.hojeISO() || padrao < ABRE || padrao > FECHA - 60) padrao = 9 * 60;
    definirHora(el.ini, pre.inicio || deMin(padrao));
    definirHora(el.fim, pre.fim || deMin(Math.min(paraMin(el.ini.value) + 60, FECHA)));
    if (!el.dlg.open) el.dlg.showModal();
    (real ? el.data : el.finalidade).focus();
    verificar();
    carregarOcupados();
  }

  function fecharDialog() { if (el.dlg.open) el.dlg.close(); }
  el.dlg.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", fecharDialog));
  // clique fora da caixa fecha
  el.dlg.addEventListener("click", (e) => {
    if (e.target !== el.dlg) return;
    const r = el.dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) fecharDialog();
  });

  el.grade.addEventListener("click", (e) => {
    const b = e.target.closest("[data-reservar]");
    if (!b) return;
    const sala = salas.find((s) => s.id === Number(b.dataset.reservar));
    if (sala) abrirDialog(sala);
  });

  /* ---------- confirmação ---------- */
  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.erro.textContent = "";
    if (!salaSel) return;
    const dados = {
      sala_id: salaSel.id, data: el.data.value, inicio: el.ini.value, fim: el.fim.value,
      finalidade: el.finalidade.value.trim(), participantes: Number(el.part.value)
    };
    // validações rápidas antes de chamar a api
    if (!real && !dados.finalidade) { el.erro.textContent = "Informe a finalidade da reserva."; el.finalidade.focus(); return; }
    if (!dados.data) { el.erro.textContent = "Informe a data."; el.data.focus(); return; }
    if (!real && ehDomingo(dados.data)) { el.erro.textContent = "Domingo o campus está fechado. Escolha outro dia."; el.data.focus(); return; }
    if (!real && (!Number.isInteger(dados.participantes) || dados.participantes < 1 || dados.participantes > salaSel.capacidade)) {
      el.erro.textContent = `Confira a quantidade de participantes (1 a ${salaSel.capacidade}).`; el.part.focus(); return;
    }
    el.confirmar.disabled = true;
    try {
      const r = await api.bookings.create(dados);
      fecharDialog();
      L.toast("Reserva confirmada! Consulte os detalhes em Minhas reservas.");
      el.aviso.innerHTML = `<i class="fa-solid fa-circle-check"></i> Reserva de ${L.esc(salaSel.nome)} em ${L.esc(L.fmtData(r.data))}, ${L.esc(r.inicio)} às ${L.esc(r.fim)}, confirmada. <a href="minhas-reservas.html">Ver em Minhas reservas</a>`;
      el.aviso.hidden = false;
      carregarSalas(); // status das salas pode ter mudado
    } catch (err) {
      if (err && ["BOOKING_CONFLICT", "INVALID_INTERVAL", "VALIDATION", "SPACE_UNAVAILABLE"].includes(err.code)) {
        el.erro.textContent = err.message;
        if (err.code === "BOOKING_CONFLICT") { verificar(); carregarOcupados(); }
      } else {
        el.erro.textContent = (err && err.message) || "Não foi possível concluir a reserva.";
        console.error(err);
      }
    } finally {
      el.confirmar.disabled = false;
    }
  });

  /* ---------- início ---------- */
  await carregarSalas();

  // abre já preenchido quando vem de outra tela (detalhes, salas, agenda)
  const pSala = L.qs("sala");
  if (pSala && salas.length) {
    const sala = salas.find((s) => String(s.id) === pSala || String(s.codigo).toLowerCase() === pSala.toLowerCase());
    if (!sala) L.toast("Sala não encontrada ou inativa.", "info");
    else if (!real && (sala.manutencao || sala.status === "maintenance")) L.toast(`${sala.nome} está em manutenção e não aceita reservas.`, "info");
    else abrirDialog(sala, { data: L.qs("data"), inicio: L.qs("inicio"), fim: L.qs("fim") });
    // limpa a URL para não reabrir ao recarregar
    try { history.replaceState(null, "", location.pathname); } catch (e) { /* segue */ }
  }
});
