/* ============================================================
   Tela: Salas e chaves
   UC003 (manter salas e laboratórios) e UC004 (manter chaves).
   Toda chave pertence a uma sala. Não há exclusão: desativar
   preserva reservas e o histórico de empréstimos.
   Atalhos: ?nova=1 (nova sala), ?editar=<id> (editar sala),
            ?aba=chaves (abre a aba de chaves).
   ============================================================ */
LABTECH.pronto.then(async () => {
  const L = LABTECH;
  const api = L.api;
  const real = L.CONFIG.modo === "api";
  // a API só conhece laboratory e room; na demonstração há mais tipos
  const TIPOS = real ? { laboratorio: (L.TIPOS || {}).laboratorio || "Laboratório", sala: (L.TIPOS || {}).sala || "Sala" } : (L.TIPOS || {});
  const RECURSOS = L.RECURSOS || {};

  let salas = [];
  let chaves = [];

  const el = {
    listaSalas: L.$("#listaSalas"), listaChaves: L.$("#listaChaves"),
    buscaSala: L.$("#buscaSala"), tipo: L.$("#filtroTipo"), sitSala: L.$("#filtroSituacaoSala"),
    buscaChave: L.$("#buscaChave"), sitChave: L.$("#filtroSituacaoChave")
  };
  if (real) {
    // espaços da API não têm manutenção: o filtro e o indicador passam a tratar de inativas
    el.sitSala.querySelector('option[value="manutencao"]').remove();
    L.$("#stManut").closest(".stat").querySelector(".stat-label").innerHTML = '<i class="fa-solid fa-ban"></i> Salas inativas';
    L.$("#stManut").closest(".stat").querySelector(".stat-foot").textContent = "não recebem reservas";
    el.buscaSala.placeholder = "Código, nome ou localização";
  }
  el.tipo.insertAdjacentHTML("beforeend", Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${L.esc(v)}</option>`).join(""));

  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const salaPorId = (id) => salas.find((s) => s.id === Number(id));
  const situacaoSala = (s) => (s.ativo === false ? "inativa" : s.manutencao ? "manutencao" : "ativa");
  const badgeSala = (s) => ({
    ativa: L.badge("available", "Ativa"),
    manutencao: L.badge("maintenance", "Manutenção"),
    inativa: L.badge("neutral", "Inativa")
  })[situacaoSala(s)];
  const chavesDaSala = (id) => chaves.filter((c) => c.sala_id === id);

  function mensagemErro(e, tipo) {
    if (e && /^DUPLICATE/.test(e.code || "")) return tipo === "chave" ? "Já existe uma chave com este código. Use outro código." : "Já existe uma sala com este código. Use outro código.";
    if (e && tipo === "chave" && e.status === 409 && !/^(DUPLICATE|KEY_UNAVAILABLE)/.test(e.code || "")) return e.message || "Esta chave já tem histórico de empréstimos e não pode mudar de sala. Cadastre uma chave nova para a outra sala.";
    if (e && e.code === "KEY_UNAVAILABLE") return "Esta chave está emprestada agora. Registre a devolução em Retirada e devolução antes de desativá-la.";
    return (e && e.message) || "Não foi possível salvar.";
  }

  /* ---------- carga ---------- */
  async function carregar() {
    try {
      [salas, chaves] = await Promise.all([api.spaces.listAll(), api.keys.list()]);
      salas.sort((a, b) => a.codigo.localeCompare(b.codigo));
      chaves.sort((a, b) => a.codigo.localeCompare(b.codigo));
      renderStats(); renderSalas(); renderChaves();
    } catch (e) {
      L.erro(e);
      const falhou = `<div class="empty-state"><i class="fa-solid fa-plug-circle-exclamation"></i><b>Não foi possível carregar os cadastros.</b><p>Tente recarregar a página.</p></div>`;
      el.listaSalas.innerHTML = falhou; el.listaChaves.innerHTML = falhou;
    }
  }

  function renderStats() {
    const ativas = salas.filter((s) => s.ativo !== false);
    L.$("#stSalas").textContent = ativas.length;
    L.$("#stSalasFoot").textContent = `${salas.length - ativas.length} inativas`;
    L.$("#stManut").textContent = real ? salas.length - ativas.length : ativas.filter((s) => s.manutencao).length;
    const chAtivas = chaves.filter((c) => c.ativo !== false);
    L.$("#stChaves").textContent = chAtivas.length;
    L.$("#stChavesFoot").textContent = `${chaves.length - chAtivas.length} inativas`;
    L.$("#stEmp").textContent = chaves.filter((c) => c.status === "emprestada").length;
    L.$("#cntSalas").textContent = salas.length;
    L.$("#cntChaves").textContent = chaves.length;
  }

  /* ---------- aba salas ---------- */
  function renderSalas() {
    const termo = norm(el.buscaSala.value.trim());
    const lista = salas.filter((s) => {
      if (el.tipo.value && s.tipo !== el.tipo.value) return false;
      if (el.sitSala.value && situacaoSala(s) !== el.sitSala.value) return false;
      return !termo || norm([s.codigo, s.nome, s.bloco ? "bloco " + s.bloco : "", s.localizacao].join(" ")).includes(termo);
    });
    if (!lista.length) {
      el.listaSalas.innerHTML = `<div class="empty-state"><i class="fa-solid fa-building-circle-xmark"></i><b>Nenhuma sala encontrada.</b><p>Ajuste a busca ou os filtros, ou cadastre uma nova sala.</p></div>`;
      return;
    }
    el.listaSalas.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>${real ? "Localização" : "Bloco / andar"}</th><th>Capacidade</th><th>Situação</th><th>Chaves</th><th><span class="sr-only">Ações</span></th></tr></thead>
      <tbody>${lista.map((s) => {
        const nCh = chavesDaSala(s.id).length;
        return `<tr class="${s.ativo === false ? "linha-inativa" : ""}">
          <td><b>${L.esc(s.codigo)}</b></td>
          <td><span class="cel-dupla"><b>${L.esc(s.nome)}</b>${s.manutencao && s.previsaoManutencao ? `<small>${L.esc(s.previsaoManutencao)}</small>` : ""}</span></td>
          <td>${L.esc(L.tipoLabel(s.tipo))}</td>
          <td>${L.esc(L.localSala(s) || "-")}</td>
          <td>${L.esc(s.capacidade ?? "-")}</td>
          <td>${badgeSala(s)}</td>
          <td>${nCh ? `<button class="btn btn-link" type="button" data-ver-chaves="${L.esc(s.codigo)}">${nCh} chave${nCh > 1 ? "s" : ""}</button>` : `<span class="muted">nenhuma</span>`}</td>
          <td class="cel-acoes">
            <button class="btn btn-secondary btn-sm" type="button" data-editar-sala="${s.id}"><i class="fa-solid fa-pen"></i> Editar</button>
            <button class="btn btn-ghost btn-sm" type="button" data-situacao-sala="${s.id}">${s.ativo === false ? '<i class="fa-solid fa-rotate-left"></i> Ativar' : '<i class="fa-solid fa-ban"></i> Desativar'}</button>
          </td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  // Formulário do modo API: só os campos do contrato (code, kind, name, capacity, location, is_active)
  function formSalaApi(s) {
    const novo = !s;
    s = s || { codigo: "", nome: "", tipo: "laboratorio", capacidade: null, localizacao: "", ativo: true };
    const corpo = `
      <div class="form-grid">
        <div class="form-field">
          <label for="sCodigo">Código</label>
          <input id="sCodigo" name="codigo" required maxlength="20" value="${L.esc(s.codigo)}" placeholder="Ex.: LAB-16" data-msg="Informe o código da sala." autocomplete="off">
          <p class="form-hint">Único no sistema.</p>
        </div>
        <div class="form-field">
          <label for="sTipo">Tipo</label>
          <select id="sTipo" name="tipo" required>${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}"${k === s.tipo ? " selected" : ""}>${L.esc(v)}</option>`).join("")}</select>
        </div>
        <div class="form-field full">
          <label for="sNome">Nome</label>
          <input id="sNome" name="nome" maxlength="120" value="${L.esc(s.nome === s.codigo ? "" : s.nome)}" placeholder="Ex.: Laboratório de Informática 16" autocomplete="off">
          <p class="form-hint">Opcional. Sem nome, as telas mostram o código.</p>
        </div>
        <div class="form-field">
          <label for="sCapacidade">Capacidade (pessoas)</label>
          <input id="sCapacidade" name="capacidade" type="number" min="1" max="10000" step="1" value="${L.esc(s.capacidade ?? "")}" data-msg="A capacidade deve ser um número inteiro positivo.">
          <p class="form-hint">Opcional.</p>
        </div>
        <div class="form-field">
          <label for="sLocal">Localização</label>
          <input id="sLocal" name="localizacao" maxlength="120" value="${L.esc(s.localizacao)}" placeholder="Ex.: Bloco A, 1º andar">
        </div>
        <div class="form-field full">
          <label class="form-inline" for="sAtivo"><input id="sAtivo" name="ativo" type="checkbox"${s.ativo !== false ? " checked" : ""}> Sala ativa</label>
          <p class="form-hint">Salas não são excluídas. Uma sala inativa some das buscas e das reservas, mas o histórico é preservado.</p>
        </div>
      </div>`;
    L.modal({
      titulo: novo ? "Nova sala" : `Editar ${s.codigo}`, eyebrow: "UC003 · Salas e laboratórios", corpo,
      confirmar: novo ? "Cadastrar sala" : "Salvar alterações",
      aoConfirmar: async (dlg) => {
        const d = L.lerForm(dlg);
        d.codigo = d.codigo.toUpperCase();
        try {
          if (novo) await api.spaces.create(d); else await api.spaces.update(s.id, d);
        } catch (e) { throw new Error(mensagemErro(e, "sala")); }
        L.toast(novo ? `Sala ${d.codigo} cadastrada.` : `Sala ${d.codigo} atualizada.`);
        return true;
      }
    }).then((ok) => { if (ok) carregar(); });
  }

  function formSala(s) {
    if (real) return formSalaApi(s);
    const novo = !s;
    s = s || { codigo: "", nome: "", tipo: "laboratorio", bloco: "", andar: 0, capacidade: null, responsavel: "", localChave: "", recursos: [], descricao: "", regras: [], manutencao: false, previsaoManutencao: "", ativo: true };
    const corpo = `
      <div class="form-grid">
        <div class="form-field">
          <label for="sCodigo">Código</label>
          <input id="sCodigo" name="codigo" required maxlength="20" value="${L.esc(s.codigo)}" placeholder="Ex.: LAB-16" data-msg="Informe o código da sala." autocomplete="off">
          <p class="form-hint">Único no sistema.</p>
        </div>
        <div class="form-field">
          <label for="sTipo">Tipo</label>
          <select id="sTipo" name="tipo" required>${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}"${k === s.tipo ? " selected" : ""}>${L.esc(v)}</option>`).join("")}</select>
        </div>
        <div class="form-field full">
          <label for="sNome">Nome</label>
          <input id="sNome" name="nome" required maxlength="120" value="${L.esc(s.nome)}" data-msg="Informe o nome da sala." autocomplete="off">
        </div>
        <div class="form-field">
          <label for="sBloco">Bloco</label>
          <input id="sBloco" name="bloco" required maxlength="10" value="${L.esc(s.bloco)}" data-msg="Informe o bloco.">
        </div>
        <div class="form-field">
          <label for="sAndar">Andar</label>
          <input id="sAndar" name="andar" type="number" min="0" max="30" step="1" value="${L.esc(s.andar ?? 0)}">
          <p class="form-hint">0 = térreo.</p>
        </div>
        <div class="form-field">
          <label for="sCapacidade">Capacidade (pessoas)</label>
          <input id="sCapacidade" name="capacidade" type="number" min="1" max="1000" step="1" required value="${L.esc(s.capacidade ?? "")}" data-msg="Informe a capacidade (mínimo 1).">
        </div>
        <div class="form-field">
          <label for="sResp">Responsável</label>
          <input id="sResp" name="responsavel" maxlength="120" value="${L.esc(s.responsavel)}" placeholder="Ex.: Téc. Rafael Nunes">
        </div>
        <div class="form-field full">
          <label for="sLocal">Local da chave</label>
          <input id="sLocal" name="localChave" maxlength="120" value="${L.esc(s.localChave)}" placeholder="Ex.: Balcão bloco A">
        </div>
        <fieldset class="form-field full grupo-campos">
          <legend class="label">Recursos</legend>
          <div class="check-list">${Object.entries(RECURSOS).map(([k, r]) => `<label><input type="checkbox" name="recursos" value="${k}" data-lista${(s.recursos || []).includes(k) ? " checked" : ""}><i class="${r.icon}" aria-hidden="true"></i> ${L.esc(r.label)}</label>`).join("")}</div>
        </fieldset>
        <div class="form-field full">
          <label for="sDesc">Descrição</label>
          <textarea id="sDesc" name="descricao" maxlength="1000" rows="3">${L.esc(s.descricao)}</textarea>
        </div>
        <div class="form-field full">
          <label for="sRegras">Regras de uso</label>
          <textarea id="sRegras" name="regras" rows="3" placeholder="Uma regra por linha">${L.esc((s.regras || []).join("\n"))}</textarea>
          <p class="form-hint">Uma regra por linha.</p>
        </div>
        <div class="form-field">
          <label class="form-inline" for="sManut"><input id="sManut" name="manutencao" type="checkbox"${s.manutencao ? " checked" : ""}> Em manutenção</label>
          <p class="form-hint">Sala em manutenção não recebe reservas.</p>
        </div>
        <div class="form-field">
          <label for="sPrev">Previsão de retorno</label>
          <input id="sPrev" name="previsaoManutencao" maxlength="80" value="${L.esc(s.previsaoManutencao)}" placeholder="Ex.: Previsão em 7 dias"${s.manutencao ? "" : " disabled"}>
        </div>
        <div class="form-field full">
          <label class="form-inline" for="sAtivo"><input id="sAtivo" name="ativo" type="checkbox"${s.ativo !== false ? " checked" : ""}> Sala ativa</label>
          <p class="form-hint">Salas não são excluídas. Uma sala inativa some das buscas e das reservas, mas o histórico de reservas e de chaves é preservado.</p>
        </div>
      </div>`;
    const promessa = L.modal({
      titulo: novo ? "Nova sala" : `Editar ${s.codigo}`, eyebrow: "UC003 · Salas e laboratórios", corpo,
      confirmar: novo ? "Cadastrar sala" : "Salvar alterações",
      aoConfirmar: async (dlg) => {
        const d = L.lerForm(dlg);
        d.codigo = d.codigo.toUpperCase();
        d.regras = d.regras.split("\n").map((x) => x.trim()).filter(Boolean);
        if (!d.manutencao) d.previsaoManutencao = "";
        try {
          if (novo) await api.spaces.create(d); else await api.spaces.update(s.id, d);
        } catch (e) { throw new Error(mensagemErro(e, "sala")); }
        L.toast(novo ? `Sala ${d.codigo} cadastrada.` : `Sala ${d.codigo} atualizada.`);
        return true;
      }
    });
    // formulário longo: modal mais largo (largura do L.modal só mexe no max-width)
    const dlg = document.querySelector("dialog.modal:last-of-type");
    dlg.style.width = "min(760px, calc(100vw - 32px))";
    // previsão só faz sentido em manutenção
    const manut = dlg.querySelector("#sManut"), prev = dlg.querySelector("#sPrev");
    manut.addEventListener("change", () => { prev.disabled = !manut.checked; if (manut.checked) prev.focus(); });
    promessa.then((ok) => { if (ok) carregar(); });
  }

  async function alternarSala(s) {
    const desativar = s.ativo !== false;
    const nCh = chavesDaSala(s.id).filter((c) => c.ativo !== false).length;
    const ok = await L.confirmar(desativar ? `Desativar ${s.codigo}` : `Ativar ${s.codigo}`,
      desativar
        ? `${s.nome} deixará de aparecer nas buscas e nas reservas. Nada é excluído: reservas e histórico de chaves continuam guardados.${nCh ? ` As ${nCh} chave(s) da sala continuam cadastradas; desative-as na aba Chaves se necessário.` : ""}`
        : `${s.nome} volta a aparecer nas buscas e pode receber reservas.`,
      desativar ? "Desativar" : "Ativar", desativar);
    if (!ok) return;
    try { await api.spaces.update(s.id, { ativo: !desativar }); L.toast(desativar ? `${s.codigo} desativada.` : `${s.codigo} ativada.`); carregar(); }
    catch (e) { L.toast(mensagemErro(e, "sala"), "erro"); }
  }

  /* ---------- aba chaves ---------- */
  function renderChaves() {
    const termo = norm(el.buscaChave.value.trim());
    const lista = chaves.filter((c) => {
      if (el.sitChave.value && c.status !== el.sitChave.value) return false;
      return !termo || norm([c.codigo, c.sala && c.sala.codigo, c.sala && c.sala.nome].join(" ")).includes(termo);
    });
    if (!lista.length) {
      el.listaChaves.innerHTML = `<div class="empty-state"><i class="fa-solid fa-key"></i><b>Nenhuma chave encontrada.</b><p>Ajuste a busca ou cadastre uma nova chave.</p></div>`;
      return;
    }
    el.listaChaves.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Código</th><th>Sala</th><th>Local</th><th>Situação</th><th>${real ? "Estado" : "Observação"}</th><th><span class="sr-only">Ações</span></th></tr></thead>
      <tbody>${lista.map((c) => `<tr class="${c.ativo === false ? "linha-inativa" : ""}">
        <td><b>${L.esc(c.codigo)}</b></td>
        <td>${c.sala ? `<span class="cel-dupla"><b>${L.esc(c.sala.codigo)}</b><small>${L.esc(c.sala.nome || "")}</small></span>` : "-"}</td>
        <td>${L.esc(c.local || L.localSala(salaPorId(c.sala_id)) || "-")}</td>
        <td>${L.badgeChave(c.status)}${c.emprestimo && c.emprestimo.usuario ? `<small class="cel-obs">com ${L.esc(c.emprestimo.usuario.nome)}</small>` : ""}</td>
        <td>${real ? L.esc(L.ESTADOS_CHAVE[c.estado] || c.estado || "-") : c.observacao ? L.esc(c.observacao) : '<span class="muted">-</span>'}</td>
        <td class="cel-acoes">
          <a class="btn btn-ghost btn-sm" href="chave-historico.html?chave=${c.id}">Histórico</a>
          <button class="btn btn-secondary btn-sm" type="button" data-editar-chave="${c.id}"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn btn-ghost btn-sm" type="button" data-situacao-chave="${c.id}">${c.ativo === false ? '<i class="fa-solid fa-rotate-left"></i> Ativar' : '<i class="fa-solid fa-ban"></i> Desativar'}</button>
        </td></tr>`).join("")}</tbody></table></div>`;
  }

  function formChave(c, salaIdInicial) {
    const novo = !c;
    c = c || { codigo: "", sala_id: salaIdInicial || "", local: "", observacao: "", ativo: true, estado: "available" };
    const estado = c.estado || (c.ativo === false ? "inactive" : "available");
    const emprestada = c.status === "emprestada";
    const opcoes = salas.map((s) => `<option value="${s.id}"${s.id === Number(c.sala_id) ? " selected" : ""}>${L.esc(s.codigo)} · ${L.esc(s.nome)}${s.ativo === false ? " (inativa)" : ""}</option>`).join("");
    const corpo = `
      <div class="form-grid">
        <div class="form-field">
          <label for="kCodigo">Código da chave</label>
          <input id="kCodigo" name="codigo" required maxlength="${real ? 40 : 30}" value="${L.esc(c.codigo)}" placeholder="Ex.: CH-LAB-16" data-msg="Informe o código da chave." autocomplete="off">
          <p class="form-hint">Único no sistema (sem diferenciar maiúsculas).</p>
        </div>
        <div class="form-field">
          <label for="kSala">Sala</label>
          <select id="kSala" name="sala_id" required data-msg="Toda chave pertence a uma sala: escolha a sala."><option value="">Selecione...</option>${opcoes}</select>
        </div>
        ${real ? "" : `<div class="form-field full">
          <label for="kLocal">Local onde a chave fica</label>
          <input id="kLocal" name="local" maxlength="120" value="${L.esc(c.local)}" placeholder="Ex.: Balcão bloco A">
          <p class="form-hint">Ao escolher a sala, usamos o local de chave da sala se este campo estiver vazio.</p>
        </div>
        <div class="form-field full">
          <label for="kObs">Observação</label>
          <input id="kObs" name="observacao" maxlength="200" value="${L.esc(c.observacao)}" placeholder="Ex.: Cópia reserva">
        </div>`}
        <div class="form-field full">
          <label for="kEstado">Estado da chave</label>
          <select id="kEstado" name="estado" required>${Object.entries(L.ESTADOS_CHAVE).map(([k, v]) => `<option value="${k}"${k === estado ? " selected" : ""}>${L.esc(v)}</option>`).join("")}</select>
          <p class="form-hint">${emprestada
            ? "Esta chave está emprestada agora: registre a devolução antes de tirá-la de circulação."
            : "Só chaves disponíveis podem ser retiradas. Chaves não são excluídas: o histórico de empréstimos é preservado."}</p>
        </div>
      </div>`;
    const promessa = L.modal({
      titulo: novo ? "Nova chave" : `Editar ${c.codigo}`, eyebrow: "UC004 · Chaves", corpo,
      confirmar: novo ? "Cadastrar chave" : "Salvar alterações",
      aoConfirmar: async (dlg) => {
        const d = L.lerForm(dlg);
        d.codigo = d.codigo.toUpperCase();
        d.sala_id = Number(d.sala_id);
        // PATCH parcial: só envia a sala se ela mudou (a API recusa trocar a sala de chave com histórico)
        if (!novo && d.sala_id === Number(c.sala_id)) delete d.sala_id;
        try {
          if (novo) await api.keys.create(d); else await api.keys.update(c.id, d);
        } catch (e) { throw new Error(mensagemErro(e, "chave")); }
        L.toast(novo ? `Chave ${d.codigo} cadastrada.` : `Chave ${d.codigo} atualizada.`);
        return true;
      }
    });
    // sugere o local de chave da sala escolhida
    const dlg = document.querySelector("dialog.modal:last-of-type");
    const sel = dlg.querySelector("#kSala"), local = dlg.querySelector("#kLocal");
    const sugerir = () => { const s = salaPorId(sel.value); if (local && s && !local.value.trim() && s.localChave) local.value = s.localChave; };
    sel.addEventListener("change", sugerir);
    if (novo) sugerir();
    promessa.then((ok) => { if (ok) carregar(); });
  }

  async function alternarChave(c) {
    const desativar = c.ativo !== false;
    if (desativar && c.status === "emprestada") { L.toast(mensagemErro({ code: "KEY_UNAVAILABLE" }), "erro"); return; }
    const ok = await L.confirmar(desativar ? `Desativar ${c.codigo}` : `Ativar ${c.codigo}`,
      desativar
        ? "A chave não poderá mais ser retirada. Nada é excluído: o histórico de empréstimos continua disponível."
        : "A chave volta a ficar disponível para retirada.",
      desativar ? "Desativar" : "Ativar", desativar);
    if (!ok) return;
    try { await api.keys.update(c.id, { estado: desativar ? "inactive" : "available" }); L.toast(desativar ? `${c.codigo} desativada.` : `${c.codigo} ativada.`); }
    catch (e) { L.toast(mensagemErro(e, "chave"), "erro"); }
    carregar();
  }

  /* ---------- abas e eventos ---------- */
  function mostrarAba(aba) {
    L.$$(".tabs .tab").forEach((x) => { const ativo = x.dataset.aba === aba; x.classList.toggle("active", ativo); x.setAttribute("aria-selected", String(ativo)); });
    L.$("#painelSalas").hidden = aba !== "salas";
    L.$("#painelChaves").hidden = aba !== "chaves";
  }
  L.$$(".tabs .tab").forEach((t) => t.addEventListener("click", () => mostrarAba(t.dataset.aba)));
  el.buscaSala.addEventListener("input", renderSalas);
  el.tipo.addEventListener("change", renderSalas);
  el.sitSala.addEventListener("change", renderSalas);
  el.buscaChave.addEventListener("input", renderChaves);
  el.sitChave.addEventListener("change", renderChaves);
  L.$("#btnNovaSala").addEventListener("click", () => formSala());
  L.$("#btnNovaChave").addEventListener("click", () => formChave());

  L.$(".content").addEventListener("click", (ev) => {
    const alvo = (attr) => ev.target.closest(`[${attr}]`);
    let b;
    if ((b = alvo("data-editar-sala"))) return formSala(salaPorId(b.dataset.editarSala));
    if ((b = alvo("data-situacao-sala"))) return alternarSala(salaPorId(b.dataset.situacaoSala));
    if ((b = alvo("data-editar-chave"))) return formChave(chaves.find((c) => c.id === Number(b.dataset.editarChave)));
    if ((b = alvo("data-situacao-chave"))) return alternarChave(chaves.find((c) => c.id === Number(b.dataset.situacaoChave)));
    if ((b = alvo("data-ver-chaves"))) { el.buscaChave.value = b.dataset.verChaves; el.sitChave.value = ""; renderChaves(); mostrarAba("chaves"); }
  });

  await carregar();

  // atalhos pela URL
  if (L.qs("aba") === "chaves") mostrarAba("chaves");
  const editar = L.qs("editar");
  if (editar) {
    const s = salaPorId(editar);
    if (s) formSala(s); else L.toast("Sala não encontrada para edição.", "erro");
  } else if (L.qs("nova") === "1") formSala();
});
