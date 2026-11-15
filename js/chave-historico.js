/* ============================================================
   Tela: Histórico de chaves
   UC008 (consultar movimentações) e UC009 (emitir histórico).
   Uma chave: api.keys.movements(id). Todas: api.loans.list().
   O histórico nunca é apagado: só é filtrado aqui.
   ============================================================ */
LABTECH.pronto.then(async (usuario) => {
  const L = LABTECH;
  const api = L.api;
  const pad = (n) => String(n).padStart(2, "0");

  let chaves = [];
  let usuarios = [];
  let eventos = [];   // movimentações da chave escolhida (ou de todas)
  let filtrados = [];

  const el = {
    chave: L.$("#fChave"), de: L.$("#fDe"), ate: L.$("#fAte"), resp: L.$("#fResp"), erro: L.$("#fErro"),
    lista: L.$("#listaMov"), resumo: L.$("#resumoFiltro"),
    stRet: L.$("#stRet"), stDev: L.$("#stDev"), stAberto: L.$("#stAberto"), stMedia: L.$("#stMedia")
  };

  // Data local (AAAA-MM-DD) de um ISO, para comparar com os campos de período
  const diaLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  // Formata um intervalo em ms no mesmo padrão de L.duracao
  const fmtIntervalo = (ms) => { const min = Math.max(0, Math.round(ms / 60000)); return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${pad(min % 60)}`; };
  const chavePorId = (id) => chaves.find((c) => c.id === Number(id));
  const usuarioPorId = (id) => usuarios.find((u) => u.id === Number(id));

  /* ---------- carga inicial: chaves e usuários para os filtros ---------- */
  try {
    [chaves, usuarios] = await Promise.all([api.keys.list(), api.users.list()]);
  } catch (e) {
    L.erro(e);
    el.lista.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plug-circle-exclamation"></i><b>Não foi possível carregar o histórico.</b><p>Tente recarregar a página.</p></div>`;
    return;
  }
  chaves.sort((a, b) => a.codigo.localeCompare(b.codigo));
  el.chave.insertAdjacentHTML("beforeend", chaves.map((c) =>
    `<option value="${c.id}">${L.esc(c.codigo)}${c.sala ? " · " + L.esc(c.sala.nome || c.sala.codigo) : ""}${c.ativo === false ? " (inativa)" : ""}</option>`).join(""));
  usuarios.slice().sort((a, b) => a.nome.localeCompare(b.nome)).forEach((u) =>
    el.resp.insertAdjacentHTML("beforeend", `<option value="${u.id}">${L.esc(u.nome)}${u.matricula ? " · " + L.esc(u.matricula) : ""}</option>`));

  const chaveUrl = L.qs("chave");
  if (chaveUrl && chavePorId(chaveUrl)) el.chave.value = String(Number(chaveUrl));

  /* ---------- busca das movimentações ---------- */
  // Normaliza tudo para: { tipo, ocorrido_em, emprestimo_id, chave, sala, usuario, registrado_por_nome, retirada_em, devolvida_em }
  async function buscar() {
    el.lista.innerHTML = `<div class="loading">Carregando histórico...</div>`;
    try {
      const id = el.chave.value;
      if (id) {
        const c = chavePorId(id);
        const r = await api.keys.movements(id);
        // pares retirada/devolução do mesmo empréstimo, para calcular a duração
        const porEmp = {};
        r.eventos.forEach((ev) => { (porEmp[ev.emprestimo_id] = porEmp[ev.emprestimo_id] || {})[ev.tipo] = ev.ocorrido_em; });
        eventos = r.eventos.map((ev) => ({
          ...ev,
          usuario: ev.usuario || null,
          chave: c ? { id: c.id, codigo: c.codigo } : { id: Number(id), codigo: "#" + id },
          sala: c ? c.sala : null,
          retirada_em: porEmp[ev.emprestimo_id].retirada || null,
          devolvida_em: porEmp[ev.emprestimo_id].devolucao || null
        }));
      } else {
        const emprestimos = await api.loans.list();
        eventos = [];
        emprestimos.forEach((e) => {
          const c = chavePorId(e.chave_id); const u = usuarioPorId(e.usuario_id);
          const base = {
            emprestimo_id: e.id, retirada_em: e.retirada_em, devolvida_em: e.devolvida_em,
            chave: e.chave || (c ? { id: c.id, codigo: c.codigo } : { id: e.chave_id, codigo: "#" + e.chave_id }),
            sala: e.sala || (c && c.sala) || null,
            usuario: e.usuario || (u ? { id: u.id, nome: u.nome, matricula: u.matricula } : null),
            registrado_por_nome: e.registrado_por_nome || ""
          };
          eventos.push({ ...base, tipo: "retirada", ocorrido_em: e.retirada_em });
          if (e.devolvida_em) eventos.push({ ...base, tipo: "devolucao", ocorrido_em: e.devolvida_em });
        });
        eventos.sort((a, b) => b.ocorrido_em.localeCompare(a.ocorrido_em));
      }
      aplicarFiltros();
    } catch (e) {
      L.erro(e);
      el.lista.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plug-circle-exclamation"></i><b>Não foi possível carregar o histórico.</b><p>${L.esc(e.message || "")}</p></div>`;
    }
  }

  /* ---------- filtros de período e responsável (no front) ---------- */
  function aplicarFiltros() {
    const de = el.de.value, ate = el.ate.value, resp = el.resp.value;
    el.erro.textContent = de && ate && de > ate ? "A data inicial deve ser anterior ou igual à data final." : "";
    if (el.erro.textContent) { filtrados = []; render(); return; }
    filtrados = eventos.filter((ev) => {
      const dia = diaLocal(ev.ocorrido_em);
      if (de && dia < de) return false;
      if (ate && dia > ate) return false;
      if (resp && (!ev.usuario || ev.usuario.id !== Number(resp))) return false;
      return true;
    });
    render();
  }

  // Duração do empréstimo daquele evento (em aberto conta até agora)
  function duracaoDe(ev) {
    if (!ev.retirada_em) return "-";
    if (!ev.devolvida_em) return `em aberto · ${L.duracao(ev.retirada_em)}`;
    return fmtIntervalo(new Date(ev.devolvida_em) - new Date(ev.retirada_em));
  }

  function textoPeriodo() {
    const de = el.de.value, ate = el.ate.value;
    if (de && ate) return `de ${L.fmtData(de)} a ${L.fmtData(ate)}`;
    if (de) return `a partir de ${L.fmtData(de)}`;
    if (ate) return `até ${L.fmtData(ate)}`;
    return "todo o período";
  }

  function render() {
    // indicadores do recorte
    const ret = filtrados.filter((e) => e.tipo === "retirada");
    const dev = filtrados.filter((e) => e.tipo === "devolucao");
    el.stRet.textContent = ret.length;
    el.stDev.textContent = dev.length;
    el.stAberto.textContent = ret.filter((e) => !e.devolvida_em).length;
    const encerrados = dev.map((e) => new Date(e.devolvida_em) - new Date(e.retirada_em)).filter((ms) => ms >= 0);
    el.stMedia.textContent = encerrados.length ? fmtIntervalo(encerrados.reduce((a, b) => a + b, 0) / encerrados.length) : "-";
    el.resumo.textContent = `${filtrados.length} movimentaç${filtrados.length === 1 ? "ão" : "ões"} · ${textoPeriodo()}`;

    if (!filtrados.length) {
      el.lista.innerHTML = `<div class="empty-state"><i class="fa-regular fa-folder-open"></i><b>Nenhuma movimentação encontrada.</b><p>${eventos.length ? "Ajuste o período ou o responsável." : "Esta chave ainda não foi retirada."}</p></div>`;
      return;
    }
    el.lista.innerHTML = `<div class="table-wrap"><table class="table tabela-historico">
      <thead><tr><th>Data e hora</th><th>Movimento</th><th>Chave</th><th>Sala</th><th>Responsável</th><th>Registrado por</th><th>Duração do empréstimo</th></tr></thead>
      <tbody>${filtrados.map((ev) => `<tr>
        <td>${L.esc(L.fmtDataHora(ev.ocorrido_em))}</td>
        <td>${ev.tipo === "retirada"
          ? `<span class="mov mov-retirada"><i class="fa-solid fa-arrow-right-from-bracket"></i> Retirada</span>`
          : `<span class="mov mov-devolucao"><i class="fa-solid fa-arrow-right-to-bracket"></i> Devolução</span>`}</td>
        <td><b>${L.esc(ev.chave.codigo)}</b></td>
        <td>${ev.sala ? `<span class="cel-dupla"><b>${L.esc(ev.sala.codigo)}</b><small>${L.esc(ev.sala.nome || "")}</small></span>` : "-"}</td>
        <td>${ev.usuario ? `<span class="cel-dupla"><b>${L.esc(ev.usuario.nome)}</b><small>${L.esc(ev.usuario.matricula || "")}</small></span>` : "-"}</td>
        <td>${L.esc(ev.registrado_por_nome || "-")}</td>
        <td>${L.esc(duracaoDe(ev))}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  /* ---------- UC009: emitir (impressão) ---------- */
  // Preenche o cabeçalho de impressão (também vale para Ctrl+P)
  function prepararImpressao() {
    const c = chavePorId(el.chave.value);
    const resp = usuarioPorId(el.resp.value);
    L.$("#prChave").textContent = c
      ? `Chave: ${c.codigo} · Sala: ${c.sala ? `${c.sala.codigo} - ${c.sala.nome || ""}` : "-"}${resp ? ` · Responsável: ${resp.nome}` : ""}`
      : `Chave: todas as chaves${resp ? ` · Responsável: ${resp.nome}` : ""}`;
    L.$("#prPeriodo").textContent = `Período: ${textoPeriodo()} · ${filtrados.length} movimentações`;
    L.$("#prEmissao").textContent = `Emitido em ${L.fmtDataHora(new Date().toISOString())} por ${usuario.nome}`;
  }
  // O papel é sempre claro: tira o tema escuro durante a impressão e devolve depois
  let temaAntes = null;
  window.addEventListener("beforeprint", () => {
    prepararImpressao();
    temaAntes = document.documentElement.dataset.theme || null;
    if (temaAntes) delete document.documentElement.dataset.theme;
  });
  window.addEventListener("afterprint", () => { if (temaAntes) document.documentElement.dataset.theme = temaAntes; temaAntes = null; });
  function emitir() {
    if (el.erro.textContent) { L.toast(el.erro.textContent, "erro"); return; }
    window.print();
  }

  /* ---------- UC009: exportar CSV (separador ;, UTF-8 com BOM) ---------- */
  function exportarCsv() {
    if (!filtrados.length) { L.toast("Não há movimentações para exportar.", "info"); return; }
    const campo = (v) => { const s = String(v ?? ""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const linhas = [["Data", "Hora", "Movimento", "Chave", "Sala", "Nome da sala", "Responsável", "Matrícula", "Registrado por", "Duração do empréstimo"]];
    filtrados.forEach((ev) => {
      const d = new Date(ev.ocorrido_em);
      linhas.push([d.toLocaleDateString("pt-BR"), L.fmtHora(ev.ocorrido_em), ev.tipo === "retirada" ? "Retirada" : "Devolução",
        ev.chave.codigo, ev.sala ? ev.sala.codigo : "", ev.sala ? ev.sala.nome || "" : "",
        ev.usuario ? ev.usuario.nome : "", ev.usuario ? ev.usuario.matricula || "" : "", ev.registrado_por_nome || "", duracaoDe(ev)]);
    });
    const csv = "﻿" + linhas.map((l) => l.map(campo).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const c = chavePorId(el.chave.value);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `historico-chaves-${c ? c.codigo.toLowerCase() : "todas"}-${L.hojeISO()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    L.toast("Arquivo CSV gerado.");
  }

  /* ---------- eventos ---------- */
  el.chave.addEventListener("change", () => {
    // mantém a chave escolhida no endereço (link compartilhável)
    const url = new URL(location.href);
    if (el.chave.value) url.searchParams.set("chave", el.chave.value); else url.searchParams.delete("chave");
    history.replaceState(null, "", url);
    buscar();
  });
  [el.de, el.ate, el.resp].forEach((i) => i.addEventListener("change", aplicarFiltros));
  L.$("#btnLimpar").addEventListener("click", () => { el.de.value = ""; el.ate.value = ""; el.resp.value = ""; aplicarFiltros(); });
  L.$("#btnEmitir").addEventListener("click", emitir);
  L.$("#btnCsv").addEventListener("click", exportarCsv);

  await buscar();
});
