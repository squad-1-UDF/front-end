/* Agenda - grade de ocupação das salas.
   Modo "semana": uma sala, segunda a sábado, 7h às 22h, células de 1h.
   Modo "dia": todas as salas (linhas) x horas (colunas) numa data.
   Parâmetros: ?sala=<id> (abre a semana dessa sala, com prioridade sobre a
   sala lembrada) e ?data=YYYY-MM-DD (abre na semana/dia dessa data).
   Tela nova da integração, no padrão das telas de reserva. */
LABTECH.pronto.then(async (usuario) => {
  const L = LABTECH;
  const api = L.api;
  const real = L.CONFIG.modo === "api";
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const paraMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
  const H_INI = Math.floor(paraMin((L.CONFIG && L.CONFIG.horaAbertura) || "07:00") / 60);
  const H_FIM = Math.ceil(paraMin((L.CONFIG && L.CONFIG.horaFechamento) || "22:00") / 60);
  const HORAS = Array.from({ length: H_FIM - H_INI }, (_, i) => H_INI + i); // 7..21 (início de cada célula)
  const CHAVE_SALA = "labtech_agenda_sala"; // só preferência de tela

  const el = {
    sala: $("aSala"), tipo: $("aTipo"), data: $("aData"), campoSala: $("campoSala"), campoTipo: $("campoTipo"),
    ant: $("btnAnterior"), hoje: $("btnHoje"), prox: $("btnProximo"), periodo: $("periodo"),
    info: $("salaInfo"), grade: $("gradeAgenda")
  };
  if (real) {
    const legenda = document.querySelectorAll(".agenda-topo .legend-item");
    legenda[3].hidden = true; // manutenção não consta no contrato de espaços
    legenda[5].hidden = true; // a API aceita reservas aos domingos
    document.querySelector(".agenda-nota").textContent = "A grade exibe intervalos de 7h às 22h. A disponibilidade e o horário são confirmados pela API ao reservar.";
  }

  /* ---------- datas ---------- */
  const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dataDe = (iso) => new Date(iso + "T12:00:00");
  const somaDias = (iso, n) => { const d = dataDe(iso); d.setDate(d.getDate() + n); return isoDe(d); };
  const diaSemana = (iso) => dataDe(iso).getDay();
  // segunda-feira da semana; domingo pula para a semana seguinte (domingo é fechado)
  const segundaDe = (iso) => { const w = diaSemana(iso); return w === 0 ? somaDias(iso, real ? -6 : 1) : somaDias(iso, 1 - w); };
  const validaISO = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(dataDe(v))) ? v : null;
  const fmtCurta = (iso) => dataDe(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const nomeDia = (iso) => dataDe(iso).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

  /* ---------- estado ---------- */
  let salas = [];
  let modo = "semana";
  let salaId = null;
  let dataRef = validaISO(L.qs("data")) || L.hojeISO();
  let seq = 0; // evita que uma resposta antiga sobrescreva a grade

  const lerPref = () => { try { return localStorage.getItem(CHAVE_SALA); } catch (e) { return null; } };
  const gravarPref = (id) => { try { localStorage.setItem(CHAVE_SALA, String(id)); } catch (e) { /* sem storage */ } };

  /* ---------- célula ---------- */
  const ativa = (r) => (r.situacao || r.status) !== "cancelada";

  function celula(sala, data, h, reservasDia) {
    const ini = h * 60, fim = ini + 60;
    const faixa = `${pad(h)}:00 às ${pad(h + 1)}:00`;
    const passado = new Date(`${data}T${pad(h)}:00`) <= new Date();
    if (sala.manutencao || sala.status === "maintenance") {
      return `<td><div class="slot manutencao" title="Em manutenção"><span>Manutenção</span></div></td>`;
    }
    const sobre = reservasDia.filter((r) => paraMin(r.inicio) < fim && ini < paraMin(r.fim));
    if (sobre.length) {
      const r = sobre[0];
      const comeca = paraMin(r.inicio) >= ini || h === H_INI;
      const minha = sobre.some((x) => x.usuario_id === usuario.id);
      const titulo = sobre.map((x) => `${x.inicio}–${x.fim}${x.finalidade ? " · " + x.finalidade : ""}${x.usuario_id === usuario.id ? " (sua reserva)" : ""}`).join("\n");
      const cls = `slot ocupado${minha ? " minha" : ""}${comeca ? "" : " cont"}${passado ? " passado" : ""}`;
      const corpo = comeca
        ? `<b>${L.esc(r.finalidade || "Ocupado")}</b><span>${L.esc(r.inicio)}–${L.esc(r.fim)}${sobre.length > 1 ? ` +${sobre.length - 1}` : ""}</span>`
        : `<span aria-hidden="true">↳</span><span class="sr-only">continuação</span>`;
      return `<td><div class="${cls}" title="${L.esc(titulo)}"><span class="sr-only">Ocupado, ${faixa}: </span>${corpo}</div></td>`;
    }
    if (passado) return `<td><div class="slot passado" title="Horário encerrado"><span class="sr-only">Encerrado, ${faixa}</span></div></td>`;
    const p = new URLSearchParams({ sala: sala.id, data, inicio: `${pad(h)}:00`, fim: `${pad(h + 1)}:00` });
    return `<td><a class="slot livre" href="reservar-sala.html?${p}" aria-label="Livre: ${L.esc(sala.nome)}, ${L.esc(L.fmtData(data))}, ${faixa}. Reservar"></a></td>`;
  }

  const porSalaEDia = (lista) => {
    const m = new Map();
    lista.filter(ativa).forEach((r) => { const k = r.sala_id + "|" + r.data; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return (salaIdX, data) => m.get(salaIdX + "|" + data) || [];
  };

  /* ---------- modo semana (uma sala) ---------- */
  async function renderSemana(minhaSeq) {
    const sala = salas.find((s) => s.id === salaId);
    if (!sala) { el.grade.innerHTML = `<div class="empty-state"><i class="fa-solid fa-door-closed"></i><b>Nenhuma sala disponível</b></div>`; el.info.innerHTML = ""; return; }
    const seg = segundaDe(dataRef);
    const dias = Array.from({ length: real ? 7 : 6 }, (_, i) => somaDias(seg, i));
    el.periodo.textContent = `${fmtCurta(dias[0])} a ${fmtCurta(dias.at(-1))}`;
    el.info.innerHTML = `<b>${L.esc(sala.nome)}</b> ${real ? "" : L.badge(sala.status)}
      ${real ? `<span>${[sala.nome !== sala.codigo ? sala.codigo : "", sala.localizacao, sala.capacidade != null ? `até ${sala.capacidade} pessoas` : ""].filter(Boolean).map(L.esc).join(" · ")}</span>` : `<span>${L.esc(sala.codigo)} · Bloco ${L.esc(sala.bloco)} · até ${Number(sala.capacidade) || 0} pessoas</span>`}
      <a class="btn btn-link" href="sala-detalhes.html?id=${sala.id}">Ver detalhes</a>`;
    const reservas = real ? await api.bookings.agenda(sala.id, { de: dias[0], ate: dias.at(-1) }) : await api.bookings.list({ sala_id: sala.id, de: dias[0], ate: dias.at(-1) });
    if (minhaSeq !== seq) return;
    const doDia = porSalaEDia(reservas);
    const hoje = L.hojeISO();
    el.grade.innerHTML = `<table class="agenda-grid semana">
      <caption class="sr-only">Ocupação de ${L.esc(sala.nome)} de ${fmtCurta(dias[0])} a ${fmtCurta(dias.at(-1))}</caption>
      <colgroup><col class="col-hora">${dias.map(() => "<col>").join("")}</colgroup>
      <thead><tr><th scope="col">Hora</th>${dias.map((d) => `<th scope="col" class="${d === hoje ? "hoje" : ""}">${L.esc(nomeDia(d))}<small>${fmtCurta(d)}</small></th>`).join("")}</tr></thead>
      <tbody>${HORAS.map((h) => `<tr><th scope="row" class="hora">${pad(h)}:00</th>${dias.map((d) => celula(sala, d, h, doDia(sala.id, d))).join("")}</tr>`).join("")}</tbody>
    </table>`;
  }

  /* ---------- modo dia (todas as salas) ---------- */
  async function renderDia(minhaSeq) {
    const data = dataRef;
    el.periodo.textContent = L.fmtDataLonga(data) + " · " + L.fmtData(data);
    el.info.innerHTML = `<b>Todas as salas</b><span>${L.esc(L.fmtDataLonga(data))}</span>`;
    if (!real && diaSemana(data) === 0) {
      el.grade.innerHTML = `<div class="empty-state"><i class="fa-solid fa-ban"></i><b>Domingo: campus fechado</b><p>Escolha outro dia para ver a ocupação.</p></div>`;
      return;
    }
    const tipo = el.tipo.value;
    const lista = salas.filter((s) => !tipo || s.tipo === tipo);
    if (!lista.length) { el.grade.innerHTML = `<div class="empty-state"><i class="fa-solid fa-filter"></i><b>Nenhuma sala deste tipo</b></div>`; return; }
    const reservas = real ? (await Promise.all(lista.map((s) => api.bookings.agenda(s.id, { de: data, ate: data })))).flat() : await api.bookings.list({ de: data, ate: data });
    if (minhaSeq !== seq) return;
    const doDia = porSalaEDia(reservas);
    el.grade.innerHTML = `<table class="agenda-grid dia">
      <caption class="sr-only">Ocupação de todas as salas em ${L.esc(L.fmtData(data))}</caption>
      <colgroup><col class="col-sala">${HORAS.map(() => "<col>").join("")}</colgroup>
      <thead><tr><th scope="col" class="sala-nome">Sala</th>${HORAS.map((h) => `<th scope="col" class="hora">${pad(h)}h</th>`).join("")}</tr></thead>
      <tbody>${lista.map((s) => `<tr>
        <th scope="row" class="sala-nome"><a href="agenda.html?sala=${s.id}&data=${data}" title="Ver semana de ${L.esc(s.nome)}">${L.esc(s.codigo)}</a>${real && s.nome === s.codigo ? "" : `<small>${L.esc(s.nome)}</small>`}</th>
        ${HORAS.map((h) => celula(s, data, h, doDia(s.id, data))).join("")}</tr>`).join("")}</tbody>
    </table>`;
  }

  async function render() {
    const minhaSeq = ++seq;
    el.data.value = dataRef;
    el.campoSala.hidden = modo !== "semana";
    el.campoTipo.hidden = modo !== "dia";
    el.ant.setAttribute("aria-label", modo === "semana" ? "Semana anterior" : "Dia anterior");
    el.prox.setAttribute("aria-label", modo === "semana" ? "Próxima semana" : "Próximo dia");
    document.querySelectorAll("[data-modo]").forEach((b) => { const on = b.dataset.modo === modo; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    el.grade.innerHTML = `<div class="loading">Carregando agenda...</div>`;
    try {
      if (modo === "semana") await renderSemana(minhaSeq); else await renderDia(minhaSeq);
    } catch (e) {
      if (minhaSeq !== seq) return;
      L.erro(e);
      el.grade.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><b>Não foi possível carregar a agenda</b><p>Tente novamente em instantes.</p></div>`;
    }
  }

  /* ---------- navegação ---------- */
  function mover(direcao) {
    if (modo === "semana") dataRef = somaDias(segundaDe(dataRef), 7 * direcao);
    else { dataRef = somaDias(dataRef, direcao); if (!real && diaSemana(dataRef) === 0) dataRef = somaDias(dataRef, direcao); }
    render();
  }
  el.ant.addEventListener("click", () => mover(-1));
  el.prox.addEventListener("click", () => mover(1));
  el.hoje.addEventListener("click", () => { dataRef = L.hojeISO(); render(); });
  el.data.addEventListener("change", () => { const v = validaISO(el.data.value); if (v) { dataRef = v; render(); } });
  el.sala.addEventListener("change", () => { salaId = Number(el.sala.value); gravarPref(salaId); render(); });
  el.tipo.addEventListener("change", render);
  document.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => {
    if (modo === b.dataset.modo) return;
    modo = b.dataset.modo;
    // no modo dia, domingo vira segunda
    if (!real && modo === "dia" && diaSemana(dataRef) === 0) dataRef = somaDias(dataRef, 1);
    render();
  }));

  /* ---------- início ---------- */
  try {
    salas = await api.spaces.list();
  } catch (e) {
    L.erro(e);
    el.grade.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><b>Não foi possível carregar as salas</b><p>Recarregue a página para tentar de novo.</p></div>`;
    return;
  }
  const tipos = L.TIPOS || {};
  salas.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true }));
  el.tipo.insertAdjacentHTML("beforeend", Object.entries(tipos).map(([k, v]) => `<option value="${L.esc(k)}">${L.esc(v)}</option>`).join(""));
  // seletor de sala agrupado por tipo
  const ordemTipos = [...Object.keys(tipos), ...new Set(salas.map((s) => s.tipo).filter((t) => !(t in tipos)))];
  el.sala.innerHTML = ordemTipos.map((t) => {
    const doTipo = salas.filter((s) => s.tipo === t);
    if (!doTipo.length) return "";
    return `<optgroup label="${L.esc(L.tipoLabel(t))}">${doTipo.map((s) => `<option value="${s.id}">${L.esc(s.codigo)}${real ? (s.nome !== s.codigo ? ` · ${L.esc(s.nome)}` : "") : ` · ${L.esc(s.nome)}${s.manutencao ? " (manutenção)" : ""}`}</option>`).join("")}</optgroup>`;
  }).join("");

  // prioridade: ?sala= > sala lembrada > primeira da lista
  const achar = (v) => v && salas.find((s) => String(s.id) === String(v) || String(s.codigo).toLowerCase() === String(v).toLowerCase());
  const pSala = L.qs("sala");
  const daUrl = achar(pSala);
  if (pSala && !daUrl) L.toast("Sala não encontrada ou inativa. Mostrando outra sala.", "info");
  const inicial = daUrl || achar(lerPref()) || salas[0];
  salaId = inicial ? inicial.id : null;
  if (inicial) el.sala.value = String(inicial.id);
  if (daUrl) { modo = "semana"; gravarPref(daUrl.id); }

  render();
});
