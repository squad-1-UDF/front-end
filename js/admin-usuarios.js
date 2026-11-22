/* ============================================================
   Tela: Usuários (UC002 - manter usuários)
   Cadastro, edição e ativação/desativação. Não há exclusão:
   desativar preserva o histórico de reservas e chaves.
   ============================================================ */
LABTECH.pronto.then(async (eu) => {
  const L = LABTECH;
  const api = L.api;
  // modo API: login pelo nome de usuário Django, senha definida no cadastro e sem matrícula
  const real = L.CONFIG.modo === "api";
  const PERFIS = L.PERFIS || { student: "Estudante", employee: "Funcionário", admin: "Administrador" };
  // rótulo curto do perfil para a tabela
  const PERFIL_CURTO = { student: "Estudante", employee: "Funcionário", admin: "Administrador" };

  let usuarios = [];
  const el = {
    lista: L.$("#lista"), busca: L.$("#busca"), perfil: L.$("#filtroPerfil"), situacao: L.$("#filtroSituacao")
  };
  el.perfil.insertAdjacentHTML("beforeend", Object.entries(PERFIS).map(([k, v]) => `<option value="${k}">${L.esc(v)}</option>`).join(""));

  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // Mensagens claras para os erros da API
  function mensagemErro(e) {
    if (e && e.code === "DUPLICATE" && !real) return "Já existe um usuário com este e-mail. Use outro e-mail ou edite o cadastro existente.";
    if (e && e.code === "SELF_LOCK") return "Você não pode desativar nem retirar o perfil de administrador do seu próprio usuário.";
    return (e && e.message) || "Não foi possível salvar.";
  }

  /* ---------- carga ---------- */
  async function carregar() {
    try {
      usuarios = await api.users.list();
      render();
    } catch (e) {
      L.erro(e);
      el.lista.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plug-circle-exclamation"></i><b>Não foi possível carregar os usuários.</b><p>Tente recarregar a página.</p></div>`;
    }
  }

  function render() {
    // indicadores (contam só ativos por perfil)
    const ativos = usuarios.filter((u) => u.ativo);
    L.$("#stTotal").textContent = usuarios.length;
    L.$("#stTotalFoot").textContent = `${ativos.length} ativos · ${usuarios.length - ativos.length} inativos`;
    ["student", "employee", "admin"].forEach((p) => { L.$("#st" + p[0].toUpperCase() + p.slice(1)).textContent = ativos.filter((u) => u.perfil === p).length; });

    const termo = norm(el.busca.value.trim());
    const lista = usuarios.filter((u) => {
      if (el.perfil.value && u.perfil !== el.perfil.value) return false;
      if (el.situacao.value === "ativo" && !u.ativo) return false;
      if (el.situacao.value === "inativo" && u.ativo) return false;
      return !termo || norm([u.nome, u.email, u.matricula, u.usuario].join(" ")).includes(termo);
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    if (!lista.length) {
      el.lista.innerHTML = `<div class="empty-state"><i class="fa-solid fa-user-slash"></i><b>Nenhum usuário encontrado.</b><p>Ajuste a busca ou os filtros.</p></div>`;
      return;
    }
    el.lista.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Usuário</th><th>${real ? "Login" : "Matrícula"}</th><th>Perfil</th><th>Situação</th><th><span class="sr-only">Ações</span></th></tr></thead>
      <tbody>${lista.map((u) => `<tr class="${u.ativo ? "" : "linha-inativa"}">
        <td><div class="cel-usuario"><span class="avatar" aria-hidden="true">${L.esc(L.iniciais(u.nome))}</span>
          <span class="cel-dupla"><b>${L.esc(u.nome)}${u.id === eu.id ? ' <span class="chip">você</span>' : ""}</b><small>${L.esc(u.email)}</small></span></div></td>
        <td>${L.esc((real ? u.usuario : u.matricula) || "-")}</td>
        <td><span class="perfil-tag perfil-${L.esc(u.perfil)}">${L.esc(PERFIL_CURTO[u.perfil] || u.perfil)}</span></td>
        <td>${u.ativo ? L.badge("available", "Ativo") : L.badge("neutral", "Inativo")}</td>
        <td class="cel-acoes">
          <button class="btn btn-secondary btn-sm" type="button" data-editar="${u.id}"><i class="fa-solid fa-pen"></i> Editar</button>
          ${u.id === eu.id ? "" : u.ativo
            ? `<button class="btn btn-ghost btn-sm" type="button" data-situacao="${u.id}"><i class="fa-solid fa-user-slash"></i> Desativar</button>`
            : `<button class="btn btn-ghost btn-sm" type="button" data-situacao="${u.id}"><i class="fa-solid fa-user-check"></i> Ativar</button>`}
        </td></tr>`).join("")}</tbody></table></div>`;
  }

  /* ---------- modal criar/editar ---------- */
  function abrirForm(u) {
    const novo = !u;
    u = u || { nome: "", email: "", matricula: "", perfil: "student", ativo: true };
    const proprio = !novo && u.id === eu.id;
    const corpo = `
      <div class="form-grid">
        <div class="form-field full">
          <label for="uNome">Nome completo</label>
          <input id="uNome" name="nome" required maxlength="120" value="${L.esc(u.nome)}" data-msg="Informe o nome do usuário." autocomplete="off">
        </div>
        ${real ? `<div class="form-field full">
          <label for="uLogin">Nome de usuário (login)</label>
          <input id="uLogin" name="usuario" ${novo ? "required" : "disabled"} maxlength="150" value="${L.esc(u.usuario || "")}" data-msg="Informe o nome de usuário." autocomplete="off" placeholder="ex.: ana.costa">
          <p class="form-hint">${novo ? "Usado para entrar no sistema. Não pode repetir nem ser alterado depois." : "O nome de usuário não pode ser alterado."}</p>
        </div>` : ""}
        <div class="form-field full">
          <label for="uEmail">E-mail${real ? "" : " institucional"}</label>
          <input id="uEmail" name="email" type="email" required maxlength="160" value="${L.esc(u.email)}"${real ? "" : ` pattern="[^@\\s]+@udf\\.edu\\.br"`} data-msg="${real ? "Informe um e-mail válido." : "Use um e-mail institucional válido (terminado em @udf.edu.br)."}" autocomplete="off" placeholder="nome.sobrenome@udf.edu.br">
          <p class="form-hint">${real ? "Obrigatório e único (sem diferenciar maiúsculas)." : "É o login do usuário. Não pode repetir."}</p>
        </div>
        ${real ? `<div class="form-field">
          <label for="uSenha">${novo ? "Senha inicial" : "Nova senha"}</label>
          <input id="uSenha" name="senha" type="password" ${novo ? "required" : ""} minlength="8" maxlength="128" autocomplete="new-password" data-msg="A senha precisa ter pelo menos 8 caracteres.">
          <p class="form-hint">${novo ? "Validada pelas regras de senha do Django." : "Deixe em branco para manter a senha atual."}</p>
        </div>` : `<div class="form-field">
          <label for="uMatricula">Matrícula</label>
          <input id="uMatricula" name="matricula" maxlength="30" value="${L.esc(u.matricula)}" autocomplete="off">
        </div>`}
        <div class="form-field">
          <label for="uPerfil">Perfil</label>
          <select id="uPerfil" name="perfil" required ${proprio ? "disabled" : ""}>
            ${Object.entries(PERFIS).map(([k, v]) => `<option value="${k}"${k === u.perfil ? " selected" : ""}>${L.esc(v)}</option>`).join("")}
          </select>
        </div>
        <div class="form-field full">
          <label class="form-inline" for="uAtivo"><input id="uAtivo" name="ativo" type="checkbox"${u.ativo ? " checked" : ""}${proprio ? " disabled" : ""}> Usuário ativo</label>
          <p class="form-hint">${proprio
            ? "Você não pode alterar o perfil nem desativar o seu próprio usuário."
            : "Usuários não são excluídos. Ao desativar, o acesso é bloqueado e o histórico de reservas e chaves é preservado."}</p>
        </div>
      </div>`;
    L.modal({
      titulo: novo ? "Novo usuário" : "Editar usuário", eyebrow: "UC002 · Usuários", corpo, confirmar: novo ? "Cadastrar" : "Salvar alterações",
      aoConfirmar: async (dlg) => {
        const dados = L.lerForm(dlg);
        dados.email = dados.email.toLowerCase();
        if (!novo) delete dados.usuario; // o login não muda depois do cadastro
        if (!dados.senha) delete dados.senha;
        if (proprio) { delete dados.perfil; delete dados.ativo; } // campos travados não vão para a API
        try {
          if (novo) {
            const criado = await api.users.create(dados);
            // POST /users/ do contrato não recebe is_active: desativa logo depois, se pedido
            if (real && dados.ativo === false && criado.ativo) await api.users.update(criado.id, { ativo: false });
          } else await api.users.update(u.id, dados);
        } catch (e) { throw new Error(mensagemErro(e)); }
        L.toast(novo ? `Usuário ${dados.nome} cadastrado.` : "Cadastro atualizado.");
        return true;
      }
    }).then((ok) => { if (ok) carregar(); });
  }

  /* ---------- ativar / desativar ---------- */
  async function alternarSituacao(u) {
    const desativar = u.ativo;
    const ok = await L.confirmar(desativar ? "Desativar usuário" : "Ativar usuário",
      desativar
        ? `${u.nome} perderá o acesso ao sistema e não poderá retirar chaves. Nada é excluído: o histórico de reservas e empréstimos continua disponível.`
        : `${u.nome} volta a acessar o sistema com o perfil ${PERFIL_CURTO[u.perfil] || u.perfil}.`,
      desativar ? "Desativar" : "Ativar", desativar);
    if (!ok) return;
    try {
      await api.users.update(u.id, { ativo: !u.ativo });
      L.toast(desativar ? `${u.nome} foi desativado.` : `${u.nome} foi ativado.`);
      carregar();
    } catch (e) { L.toast(mensagemErro(e), "erro"); }
  }

  /* ---------- eventos ---------- */
  el.busca.addEventListener("input", render);
  el.perfil.addEventListener("change", render);
  el.situacao.addEventListener("change", render);
  L.$("#btnNovo").addEventListener("click", () => abrirForm());
  el.lista.addEventListener("click", (ev) => {
    const ed = ev.target.closest("[data-editar]");
    if (ed) return abrirForm(usuarios.find((u) => u.id === Number(ed.dataset.editar)));
    const st = ev.target.closest("[data-situacao]");
    if (st) return alternarSituacao(usuarios.find((u) => u.id === Number(st.dataset.situacao)));
  });

  await carregar();
  // admin-usuarios.html?novo=1 abre direto o cadastro
  if (L.qs("novo") === "1") abrirForm();
});
