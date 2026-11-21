/* ============================================================
   Painel administrativo (autoria original: Raiane, branch Raiane)
   Indicadores reais, reservas recentes (com cancelamento),
   atividades recentes (reservas + chaves) e restauração da demo.
   ============================================================ */
LABTECH.pronto.then(async (usuario) => {
  const L = LABTECH;
  const api = L.api;
  const $ = (id) => document.getElementById(id);
  const real = L.CONFIG.modo === "api";

  /* ---------- utilidades da tela ---------- */
  const primeiroNome = (nome) => String(nome || "").replace(/^(Prof\.|Téc\.)\s*/i, "").split(/\s+/)[0] || "";
  const seta = ' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
  const vazio = (icone, titulo, texto) => `<div class="empty-state"><i class="${icone}"></i><b>${L.esc(titulo)}</b><p>${L.esc(texto)}</p></div>`;
  const falhou = (texto) => vazio("fa-solid fa-triangle-exclamation", "Não foi possível carregar", texto || "Tente recarregar a página.");
  const situacao = (r) => r.situacao || r.status;
  // pode cancelar: ativa e ainda não terminou
  const cancelavel = (r) => ["confirmada", "pendente"].includes(situacao(r)) && new Date(`${r.data}T${r.fim}`) > new Date();

  /* ---------- banner: saudação pela hora ---------- */
  const h = new Date().getHours();
  const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const nome = primeiroNome(usuario.nome);
  $("saudacao").textContent = nome ? `${periodo}, ${nome}!` : `${periodo}!`;

  /* ---------- restaurar dados de demonstração (só modo mock) ---------- */
  if (L.CONFIG && L.CONFIG.modo === "mock") {
    $("acoesDemo").hidden = false;
    $("btnResetDemo").addEventListener("click", async () => {
      const ok = await L.confirmar("Restaurar dados de demonstração", "Todas as reservas, usuários, salas e chaves criados neste navegador serão substituídos pelos dados iniciais da demonstração.", "Restaurar dados");
      if (!ok) return;
      try { await api.demo.reset(); location.reload(); } catch (e) { L.erro(e); }
    });
  }

  /* ---------- indicadores ---------- */
  async function carregarIndicadores() {
    const tarefas = [
      ["qtdUsuarios", "footUsuarios", async () => {
        const us = await api.users.list();
        return [us.length, `${us.filter((u) => u.ativo).length} ativos · Ver todos`];
      }],
      ["qtdSalas", "footSalas", async () => {
        const ss = await api.spaces.listAll();
        // a API não tem manutenção de sala: mostra as inativas
        if (real) return [ss.length, `${ss.filter((s) => s.ativo === false).length} inativas · Ver todos`];
        const manut = ss.filter((s) => s.manutencao || s.status === "maintenance").length;
        return [ss.length, `${manut} em manutenção · Ver todos`];
      }],
      ["qtdHoje", "footHoje", async () => {
        const rs = await api.bookings.list({ de: L.hojeISO(), ate: L.hojeISO(), todas: true });
        const agora = new Date();
        const andamento = rs.filter((r) => ["confirmada", "pendente"].includes(situacao(r)) && new Date(`${r.data}T${r.inicio}`) <= agora && agora < new Date(`${r.data}T${r.fim}`)).length;
        return [rs.length, `${andamento} em andamento · Ver agenda`];
      }],
      ["qtdChaves", "footChaves", async () => {
        const [ativos, chaves] = await Promise.all([api.loans.list({ ativos: true }), api.keys.list()]);
        return [ativos.length, `de ${chaves.filter((c) => c.ativo !== false).length} chaves ativas · Ver todas`];
      }]
    ];
    await Promise.all(tarefas.map(async ([idValor, idFoot, fn]) => {
      try {
        const [valor, foot] = await fn();
        $(idValor).textContent = valor;
        $(idFoot).innerHTML = L.esc(foot) + seta;
      } catch (e) { $(idValor).textContent = "–"; L.erro(e); }
    }));
  }

  /* ---------- reservas recentes + atividades recentes ---------- */
  async function carregarReservasEAtividades() {
    const alvoTab = $("reservasConteudo");
    const alvoAtv = $("atividadesConteudo");
    let reservas;
    try {
      // todas: no modo API pede scope=all (o administrador é staff)
      const [lista, salas] = await Promise.all([
        api.bookings.list({ de: L.hojeISO(-14), incluirCanceladas: true, todas: true }),
        real ? api.spaces.listAll().catch(() => []) : Promise.resolve([])
      ]);
      // a reserva da API traz só space_id: completa código e nome da sala
      const porId = new Map(salas.map((s) => [s.id, s]));
      reservas = lista.map((r) => (r.sala || !porId.has(r.sala_id) ? r : { ...r, sala: porId.get(r.sala_id) }));
    } catch (e) {
      alvoTab.innerHTML = falhou(); alvoAtv.innerHTML = falhou(); L.erro(e); return;
    }

    // Tabela: mais recentes primeiro (criação); empate: mais próximas de agora
    const agora = Date.now();
    const criadaMs = (r) => new Date(r.criada_em || `${r.data}T${r.inicio}`).getTime();
    const distancia = (r) => Math.abs(new Date(`${r.data}T${r.inicio}`).getTime() - agora);
    const recentes = reservas.slice().sort((a, b) => (criadaMs(b) - criadaMs(a)) || (distancia(a) - distancia(b))).slice(0, 8);

    alvoTab.innerHTML = recentes.length ? `
      <div class="table-wrap"><table class="table">
        <thead><tr><th scope="col">Solicitante</th><th scope="col">Espaço</th><th scope="col">Data e horário</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${recentes.map((r) => {
          const quem = (r.usuario && r.usuario.nome) || (real ? "Não informado" : "Usuário");
          const sala = r.sala || {};
          return `<tr>
            <td><span class="solicitante"><span class="avatar" aria-hidden="true">${L.esc(L.iniciais(quem))}</span>${L.esc(quem)}</span></td>
            <td class="espaco"><b>${L.esc(sala.nome || "Sala")}</b><small>${L.esc(sala.codigo || "")}</small></td>
            <td>${L.esc(L.fmtData(r.data))} · ${L.esc(r.inicio)}–${L.esc(r.fim)}</td>
            <td>${L.badgeReserva(situacao(r))}</td>
            <td>${cancelavel(r) ? `<button type="button" class="btn btn-ghost btn-sm btn-cancelar" data-cancelar="${L.esc(r.id)}" aria-label="Cancelar reserva de ${L.esc(quem)} em ${L.esc(sala.nome || "sala")}"><i class="fa-solid fa-ban" aria-hidden="true"></i> Cancelar</button>` : ""}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>` : vazio("fa-regular fa-rectangle-list", "Nenhuma reserva recente", "As novas reservas aparecem aqui.");

    // Atividades: reservas criadas/canceladas + retiradas/devoluções de chave
    try {
      const emprestimos = await api.loans.list();
      const eventos = [];
      reservas.forEach((r) => {
        const sala = (r.sala && r.sala.nome) || "Sala";
        if (r.criada_em) eventos.push({ quando: r.criada_em, cls: "", icone: "fa-solid fa-file-circle-plus", titulo: "Nova reserva", detalhe: `${sala} · ${(r.usuario && r.usuario.nome) || ""}` });
        if (r.cancelada_em) eventos.push({ quando: r.cancelada_em, cls: "danger", icone: "fa-solid fa-ban", titulo: "Reserva cancelada", detalhe: `${sala} · ${L.fmtData(r.data)} ${r.inicio}` });
      });
      emprestimos.forEach((e) => {
        const chave = (e.chave && e.chave.codigo) || "Chave";
        const quem = (e.usuario && e.usuario.nome) || (e.sala && e.sala.nome) || "";
        if (e.retirada_em) eventos.push({ quando: e.retirada_em, cls: "ok", icone: "fa-solid fa-key", titulo: `Chave ${chave} retirada`, detalhe: quem });
        if (e.devolvida_em) eventos.push({ quando: e.devolvida_em, cls: "warn", icone: "fa-solid fa-clock-rotate-left", titulo: "Devolução de chave realizada", detalhe: `${chave}${(e.sala && e.sala.nome) ? " · " + e.sala.nome : ""}` });
      });
      const lista = eventos.filter((ev) => new Date(ev.quando).getTime() <= agora)
        .sort((a, b) => new Date(b.quando) - new Date(a.quando)).slice(0, 6);

      alvoAtv.innerHTML = lista.length ? `<ul class="list">${lista.map((ev) => `
        <li class="list-item">
          <span class="list-icon ${ev.cls}"><i class="${ev.icone}" aria-hidden="true"></i></span>
          <span class="list-main"><b>${L.esc(ev.titulo)}</b><span>${L.esc(ev.detalhe)}</span><span class="list-quando">${L.esc(L.fmtDataHora(ev.quando))}</span></span>
        </li>`).join("")}</ul>` : vazio("fa-solid fa-clipboard-check", "Sem atividades recentes", "Reservas e movimentações de chave aparecem aqui.");
    } catch (e) { alvoAtv.innerHTML = falhou(); L.erro(e); }
  }

  /* ---------- cancelar reserva (delegação de evento) ---------- */
  $("reservasConteudo").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-cancelar]"); if (!btn) return;
    const ok = await L.confirmar("Cancelar reserva", "A reserva será cancelada e o horário ficará livre para outras pessoas. Esta ação não pode ser desfeita.", "Cancelar reserva");
    if (!ok) return;
    btn.disabled = true;
    try {
      await api.bookings.cancel(btn.dataset.cancelar);
      L.toast("Reserva cancelada.");
      await Promise.all([carregarReservasEAtividades(), carregarIndicadores()]);
    } catch (e) { btn.disabled = false; L.erro(e); }
  });

  await Promise.all([carregarIndicadores(), carregarReservasEAtividades()]);
});
