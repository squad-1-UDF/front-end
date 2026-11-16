/* ============================================================
   Tela: Retirada e devolução de chaves
   UC005 (registrar retirada), UC006 (registrar devolução),
   UC007 (consultar disponibilidade das chaves).
   Regras: só se entrega chave disponível; a retirada registra o
   responsável e a data/hora; a devolução encerra a retirada
   correspondente; nada é apagado.
   ============================================================ */
LABTECH.pronto.then(async () => {
  const L = LABTECH;
  const api = L.api;
  const LIMITE_ATENCAO_MS = 4 * 60 * 60 * 1000; // 4 horas

  // Estado da tela
  let chaves = [];
  let emprestimosAtivos = [];
  let usuarios = [];

  const el = {
    stDisp: L.$("#stDisp"), stEmp: L.$("#stEmp"), stInat: L.$("#stInat"), stAtencao: L.$("#stAtencao"),
    cntEmp: L.$("#cntEmp"), cntTodas: L.$("#cntTodas"),
    listaEmp: L.$("#listaEmprestadas"), listaTodas: L.$("#listaTodas"),
    busca: L.$("#buscaChave"), filtro: L.$("#filtroStatus")
  };

  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const passouLimite = (e) => Date.now() - new Date(e.retirada_em).getTime() > LIMITE_ATENCAO_MS;
  const chavePorId = (id) => chaves.find((c) => c.id === Number(id));
  const usuarioPorId = (id) => usuarios.find((u) => u.id === Number(id));

  // Mensagens claras para os erros de regra de negócio
  function mensagemErro(e) {
    const msgs = {
      KEY_UNAVAILABLE: "Esta chave não está disponível: já foi entregue a outra pessoa ou está inativa. A lista foi atualizada; escolha outra chave.",
      USER_INACTIVE: "Este usuário está inativo e não pode retirar chaves. Procure o administrador para reativá-lo.",
      LOAN_ALREADY_RETURNED: "Esta devolução já tinha sido registrada. A lista foi atualizada."
    };
    return (e && msgs[e.code]) || (e && e.message) || "Não foi possível concluir a operação.";
  }

  /* ---------- carga de dados ---------- */
  async function carregar() {
    try {
      const [ks, ls, us] = await Promise.all([api.keys.list(), api.loans.list({ ativos: true }), api.users.list()]);
      chaves = ks; usuarios = us;
      // Completa os empréstimos com chave/sala/usuário quando a API não trouxer (modo api)
      emprestimosAtivos = ls.map((e) => {
        const c = e.chave ? null : chavePorId(e.chave_id);
        const u = e.usuario ? null : usuarioPorId(e.usuario_id);
        return {
          ...e,
          chave: e.chave || (c ? { id: c.id, codigo: c.codigo } : { id: e.chave_id, codigo: "#" + e.chave_id }),
          sala: e.sala || (c && c.sala) || null,
          usuario: e.usuario || (u ? { id: u.id, nome: u.nome, matricula: u.matricula } : null)
        };
      }).sort((a, b) => a.retirada_em.localeCompare(b.retirada_em)); // mais antigos primeiro
      renderTudo();
    } catch (e) {
      L.erro(e);
      el.listaEmp.innerHTML = el.listaTodas.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plug-circle-exclamation"></i><b>Não foi possível carregar as chaves.</b><p>Tente recarregar a página.</p></div>`;
    }
  }

  function renderTudo() { renderStats(); renderEmprestadas(); renderTodas(); }

  /* ---------- indicadores ---------- */
  function renderStats() {
    const conta = (s) => chaves.filter((c) => c.status === s).length;
    el.stDisp.textContent = conta("disponivel");
    el.stEmp.textContent = emprestimosAtivos.length;
    el.stInat.textContent = conta("inativa");
    const atencao = emprestimosAtivos.filter(passouLimite).length;
    el.stAtencao.textContent = atencao;
    el.stAtencao.closest(".stat").classList.toggle("tem-atencao", atencao > 0);
    el.cntEmp.textContent = emprestimosAtivos.length;
    el.cntTodas.textContent = chaves.length;
  }

  /* ---------- aba: emprestadas agora ---------- */
  function renderEmprestadas() {
    if (!emprestimosAtivos.length) {
      el.listaEmp.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-check"></i><b>Nenhuma chave fora do balcão.</b><p>Todas as chaves ativas estão disponíveis para retirada.</p></div>`;
      return;
    }
    el.listaEmp.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Chave</th><th>Sala</th><th>Responsável</th><th>Retirada em</th><th>Há quanto tempo</th><th><span class="sr-only">Ações</span></th></tr></thead>
      <tbody>${emprestimosAtivos.map((e) => {
        const atencao = passouLimite(e);
        return `<tr class="${atencao ? "linha-atencao" : ""}">
          <td><b>${L.esc(e.chave.codigo)}</b></td>
          <td>${e.sala ? `<span class="cel-dupla"><b>${L.esc(e.sala.codigo)}</b><small>${L.esc(e.sala.nome || "")}</small></span>` : "-"}</td>
          <td>${e.usuario ? `<span class="cel-dupla"><b>${L.esc(e.usuario.nome)}</b><small>${L.esc(e.usuario.matricula || "")}</small></span>` : "-"}</td>
          <td>${L.esc(L.fmtDataHora(e.retirada_em))}</td>
          <td>${atencao ? `<span class="badge reserved" title="Empréstimo há mais de 4 horas">${L.esc(L.duracao(e.retirada_em))}</span>` : L.esc(L.duracao(e.retirada_em))}</td>
          <td class="cel-acoes">
            <a class="btn btn-ghost btn-sm" href="chave-historico.html?chave=${e.chave.id}">Ver histórico</a>
            <button class="btn btn-primary btn-sm" type="button" data-devolver="${e.id}"><i class="fa-solid fa-rotate-left"></i> Registrar devolução</button>
          </td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  /* ---------- aba: todas as chaves ---------- */
  function renderTodas() {
    const termo = norm(el.busca.value.trim());
    const status = el.filtro.value;
    const lista = chaves.filter((c) => {
      if (status && c.status !== status) return false;
      if (!termo) return true;
      return norm([c.codigo, c.sala && c.sala.codigo, c.sala && c.sala.nome, c.sala && c.sala.bloco && "bloco " + c.sala.bloco].join(" ")).includes(termo);
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));

    if (!lista.length) {
      el.listaTodas.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><b>Nenhuma chave encontrada.</b><p>Ajuste a busca ou o filtro de situação.</p></div>`;
      return;
    }
    el.listaTodas.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Chave</th><th>Sala</th><th>Bloco</th><th>Local da chave</th><th>Situação</th><th><span class="sr-only">Ações</span></th></tr></thead>
      <tbody>${lista.map((c) => {
        const emp = emprestimosAtivos.find((e) => e.chave_id === c.id);
        return `<tr>
          <td><b>${L.esc(c.codigo)}</b>${c.observacao ? `<small class="cel-obs">${L.esc(c.observacao)}</small>` : ""}</td>
          <td>${c.sala ? `<span class="cel-dupla"><b>${L.esc(c.sala.codigo)}</b><small>${L.esc(c.sala.nome || "")}</small></span>` : "-"}</td>
          <td>${L.esc(c.sala && c.sala.bloco ? c.sala.bloco : "-")}</td>
          <td>${L.esc(c.local || "-")}</td>
          <td>${L.badgeChave(c.status)}${emp && emp.usuario ? `<small class="cel-obs">com ${L.esc(emp.usuario.nome)}</small>` : ""}</td>
          <td class="cel-acoes">
            <a class="btn btn-ghost btn-sm" href="chave-historico.html?chave=${c.id}">Ver histórico</a>
            ${c.status === "disponivel" ? `<button class="btn btn-primary btn-sm" type="button" data-entregar="${c.id}"><i class="fa-solid fa-hand-holding"></i> Entregar</button>` : ""}
            ${c.status === "emprestada" && emp ? `<button class="btn btn-secondary btn-sm" type="button" data-devolver="${emp.id}"><i class="fa-solid fa-rotate-left"></i> Devolução</button>` : ""}
          </td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  /* ---------- devolução (UC006) ---------- */
  async function registrarDevolucao(idEmprestimo) {
    const e = emprestimosAtivos.find((x) => x.id === Number(idEmprestimo));
    if (!e) return;
    const quem = e.usuario ? e.usuario.nome : "o responsável";
    const ok = await L.confirmar("Registrar devolução",
      `Confirmar a devolução da chave ${e.chave.codigo} por ${quem}? Retirada em ${L.fmtDataHora(e.retirada_em)} (há ${L.duracao(e.retirada_em)}). A data e a hora de agora serão registradas.`,
      "Registrar devolução", false);
    if (!ok) return;
    try {
      await api.loans.return(e.id);
      L.toast(`Devolução da chave ${e.chave.codigo} registrada.`);
    } catch (err) {
      if (err.code === "LOAN_ALREADY_RETURNED") L.toast(mensagemErro(err), "info"); else L.toast(mensagemErro(err), "erro");
    }
    await carregar();
  }

  /* ---------- retirada (UC005) ---------- */
  // Liga um campo de busca a um select: refaz as opções conforme o texto digitado
  function selectFiltravel(input, select, itens, textoDe, buscaDe, vazio) {
    const montar = () => {
      const termo = norm(input.value.trim());
      const atual = select.value;
      const filtrados = itens.filter((i) => !termo || norm(buscaDe(i)).includes(termo));
      select.innerHTML = `<option value="">${filtrados.length ? "Selecione..." : L.esc(vazio)}</option>` +
        filtrados.map((i) => `<option value="${i.id}">${L.esc(textoDe(i))}</option>`).join("");
      if (filtrados.some((i) => String(i.id) === atual)) select.value = atual;
      else if (filtrados.length === 1) select.value = String(filtrados[0].id);
      select.dispatchEvent(new Event("change"));
    };
    input.addEventListener("input", montar);
    montar();
  }

  async function abrirRetirada(chaveIdInicial) {
    // Sempre parte de dados atualizados para não oferecer chave já entregue
    await carregar();
    const disponiveis = chaves.filter((c) => c.status === "disponivel").sort((a, b) => a.codigo.localeCompare(b.codigo));
    const ativos = usuarios.filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome));

    if (chaveIdInicial) {
      const c = chavePorId(chaveIdInicial);
      if (!c) { L.toast("Chave não encontrada.", "erro"); chaveIdInicial = null; }
      else if (c.status !== "disponivel") { L.toast(`A chave ${c.codigo} não está disponível (${(L.STATUS_CHAVE[c.status] || [c.status])[0].toLowerCase()}).`, "info"); chaveIdInicial = null; }
    }
    if (!disponiveis.length) { L.toast("Nenhuma chave disponível para retirada no momento.", "info"); return; }

    const corpo = `
      <div class="form-field">
        <label for="rtBuscaChave">Chave disponível</label>
        <input id="rtBuscaChave" type="search" placeholder="Filtrar por código, sala ou bloco" autocomplete="off">
        <label for="rtChave" class="sr-only">Selecione a chave</label>
        <select id="rtChave" name="chave_id" required data-msg="Escolha a chave que será entregue."></select>
        <p class="form-hint" id="rtChaveInfo"></p>
      </div>
      <div class="form-field">
        <label for="rtBuscaUsuario">Responsável pela retirada</label>
        <input id="rtBuscaUsuario" type="search" placeholder="Filtrar por nome, matrícula ou e-mail" autocomplete="off">
        <label for="rtUsuario" class="sr-only">Selecione o responsável</label>
        <select id="rtUsuario" name="usuario_id" required data-msg="Escolha quem está retirando a chave."></select>
        <p class="form-hint">Somente usuários ativos podem retirar chaves.</p>
      </div>
      <div class="registro-hora">
        <i class="fa-regular fa-clock"></i>
        <div><span>Data e hora que serão registradas</span><b id="rtAgora">${L.esc(L.fmtDataHora(new Date().toISOString()))}</b>
        <small>Registrado por ${L.esc(L.usuario.nome)}</small></div>
      </div>`;

    let relogio = null;
    const promessa = L.modal({
      titulo: "Registrar retirada", eyebrow: "UC005 · Entrega de chave", corpo, confirmar: "Confirmar retirada",
      aoConfirmar: async (dlg) => {
        const chave_id = Number(dlg.querySelector("#rtChave").value);
        const usuario_id = Number(dlg.querySelector("#rtUsuario").value);
        try {
          const e = await api.loans.checkout({ chave_id, usuario_id });
          const c = chavePorId(chave_id); const u = usuarioPorId(usuario_id);
          L.toast(`Chave ${c ? c.codigo : ""} entregue a ${u ? u.nome : "responsável"} em ${L.fmtDataHora(e.retirada_em)}.`);
          return true;
        } catch (err) {
          if (err.code === "KEY_UNAVAILABLE") {
            // tira a chave do select do modal e atualiza a tela por trás
            const pos = disponiveis.findIndex((c) => c.id === chave_id);
            if (pos >= 0) disponiveis.splice(pos, 1);
            dlg.querySelector("#rtBuscaChave").dispatchEvent(new Event("input"));
            carregar();
          }
          throw new Error(mensagemErro(err));
        }
      }
    });

    // O dialog já está no DOM: liga os filtros e o relógio
    const dlg = document.querySelector("dialog.modal:last-of-type");
    const selChave = dlg.querySelector("#rtChave");
    const info = dlg.querySelector("#rtChaveInfo");
    selChave.addEventListener("change", () => {
      const c = chavePorId(selChave.value);
      info.textContent = c ? `${c.sala ? c.sala.nome + " · " : ""}Local: ${c.local || "não informado"}` : "";
    });
    selectFiltravel(dlg.querySelector("#rtBuscaChave"), selChave, disponiveis,
      (c) => `${c.codigo} · ${c.sala ? c.sala.codigo : ""}${c.sala && c.sala.bloco ? " (bloco " + c.sala.bloco + ")" : ""}`,
      (c) => [c.codigo, c.sala && c.sala.codigo, c.sala && c.sala.nome, c.sala && c.sala.bloco && "bloco " + c.sala.bloco].join(" "),
      "Nenhuma chave encontrada");
    selectFiltravel(dlg.querySelector("#rtBuscaUsuario"), dlg.querySelector("#rtUsuario"), ativos,
      (u) => `${u.nome}${u.matricula ? " · " + u.matricula : ""}`,
      (u) => [u.nome, u.matricula, u.email].join(" "),
      "Nenhum usuário encontrado");
    if (chaveIdInicial) { selChave.value = String(chaveIdInicial); selChave.dispatchEvent(new Event("change")); dlg.querySelector("#rtBuscaUsuario").focus(); }
    relogio = setInterval(() => { const a = dlg.querySelector("#rtAgora"); if (a) a.textContent = L.fmtDataHora(new Date().toISOString()); }, 15000);

    const ok = await promessa;
    clearInterval(relogio);
    if (ok) await carregar();
  }

  /* ---------- eventos ---------- */
  L.$$(".tabs .tab").forEach((t) => t.addEventListener("click", () => {
    L.$$(".tabs .tab").forEach((x) => { const ativo = x === t; x.classList.toggle("active", ativo); x.setAttribute("aria-selected", String(ativo)); });
    L.$("#painelEmprestadas").hidden = t.dataset.aba !== "emprestadas";
    L.$("#painelTodas").hidden = t.dataset.aba !== "todas";
  }));
  el.busca.addEventListener("input", renderTodas);
  el.filtro.addEventListener("change", renderTodas);
  L.$("#btnRetirada").addEventListener("click", () => abrirRetirada());
  document.addEventListener("click", (ev) => {
    const dev = ev.target.closest("[data-devolver]");
    if (dev) return registrarDevolucao(dev.dataset.devolver);
    const ent = ev.target.closest("[data-entregar]");
    if (ent) return abrirRetirada(Number(ent.dataset.entregar));
  });
  // Atualiza o "há quanto tempo" a cada minuto, sem ir ao servidor
  setInterval(() => { renderStats(); renderEmprestadas(); }, 60000);

  await carregar();
  // chaves.html?chave=<id> abre direto a retirada daquela chave
  const chaveUrl = L.qs("chave");
  if (chaveUrl) abrirRetirada(Number(chaveUrl));
});
