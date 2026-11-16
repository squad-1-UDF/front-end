/* ============================================================
   Tela de login (autoria original: Luanna Priscila, branch tela_login)
   Única tela que não usa core.js: aqui ainda não há usuário logado.
   Depende de data/seed.js (PERFIS, usuários de demo) e js/api.js.
   ============================================================ */
(function () {
  const L = window.LABTECH;
  const LEMBRAR_KEY = "labtech_lembrar";
  const THEME_KEY = "labtech_theme";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Destino depois do login: só aceita nome de arquivo .html local
     (sem "/" nem ":"), para não redirecionar para outro site. */
  function destino() {
    const voltar = new URLSearchParams(location.search).get("voltar") || "";
    const arquivo = voltar.split("?")[0];
    if (voltar && !/[/:\\]/.test(voltar) && /^[\w.-]+\.html$/i.test(arquivo)) return voltar;
    return "index.html";
  }

  // Já logado: vai direto
  if (L.sessaoAtual && L.sessaoAtual()) { location.replace(destino()); return; }

  /* ---------- tema ---------- */
  const btnTema = $("btnTema");
  function aplicarTema(t) {
    if (t === "dark") document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
    btnTema.querySelector("i").className = t === "dark" ? "fa-regular fa-sun" : "fa-regular fa-moon";
    btnTema.setAttribute("aria-label", t === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
    btnTema.setAttribute("aria-pressed", String(t === "dark"));
  }
  aplicarTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  btnTema.addEventListener("click", () => {
    const prox = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, prox); } catch (e) { /* sem storage */ }
    aplicarTema(prox);
  });

  /* ---------- campos ---------- */
  const form = $("formLogin");
  const selPerfil = $("perfil");
  const inpId = $("identifier");
  const inpSenha = $("password");
  const chkLembrar = $("lembrar");
  const erroEl = $("loginErro");
  const btnEntrar = $("btnEntrar");

  // Opções de perfil com os rótulos oficiais
  Object.entries(L.PERFIS || {}).forEach(([valor, rotulo]) => {
    const op = document.createElement("option"); op.value = valor; op.textContent = rotulo; selPerfil.appendChild(op);
  });

  // "Lembrar-me": guarda só o e-mail/matrícula, nunca a senha
  try {
    const salvo = localStorage.getItem(LEMBRAR_KEY);
    if (salvo) { inpId.value = salvo; chkLembrar.checked = true; }
  } catch (e) { /* sem storage */ }

  // Mostrar/ocultar senha
  const btnSenha = $("btnSenha");
  btnSenha.addEventListener("click", () => {
    const mostrar = inpSenha.type === "password";
    inpSenha.type = mostrar ? "text" : "password";
    btnSenha.querySelector("i").className = mostrar ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
    btnSenha.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    btnSenha.setAttribute("aria-pressed", String(mostrar));
    inpSenha.focus();
  });

  /* ---------- "Esqueceu a senha?" ---------- */
  const modal = $("modalSenha");
  $("btnEsqueci").addEventListener("click", () => modal.showModal());
  modal.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => modal.close()));

  /* ---------- quadro de demonstração (só no modo mock) ---------- */
  if (L.CONFIG && L.CONFIG.modo === "mock") {
    const DEMO = [
      { email: "ana.costa@udf.edu.br", perfil: "admin" },
      { email: "rafael.nunes@udf.edu.br", perfil: "employee" },
      { email: "joao.silva@udf.edu.br", perfil: "student" }
    ];
    const usuarios = L.SEED_USUARIOS || [];
    $("demoSenha").textContent = L.CONFIG.senhaDemo;
    $("demoLista").innerHTML = DEMO.map((d) => {
      const u = usuarios.find((x) => x.email === d.email) || { nome: d.email };
      const ini = String(u.nome).split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
      return `<button type="button" class="demo-item" data-email="${esc(d.email)}" data-perfil="${esc(d.perfil)}">
        <span class="avatar" aria-hidden="true">${esc(ini)}</span>
        <div><b>${esc(u.nome)} · ${esc((L.PERFIS || {})[d.perfil] || d.perfil)}</b><span>${esc(d.email)}</span></div>
      </button>`;
    }).join("");
    $("demoLista").addEventListener("click", (e) => {
      const b = e.target.closest(".demo-item"); if (!b) return;
      selPerfil.value = b.dataset.perfil;
      inpId.value = b.dataset.email;
      inpSenha.value = L.CONFIG.senhaDemo;
      erroEl.textContent = "";
      btnEntrar.focus();
    });
    $("demoBox").hidden = false;
  }

  /* ---------- envio ---------- */
  function carregando(sim) {
    btnEntrar.disabled = sim;
    btnEntrar.classList.toggle("carregando", sim);
    btnEntrar.querySelector(".label").textContent = sim ? "Entrando..." : "Entrar no sistema";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroEl.textContent = "";
    const perfil = selPerfil.value;
    const identifier = inpId.value.trim();
    const password = inpSenha.value;

    // validação simples antes de chamar a api
    if (!perfil) { erroEl.textContent = "Selecione o seu perfil."; selPerfil.focus(); return; }
    if (!identifier) { erroEl.textContent = "Informe seu e-mail institucional ou matrícula."; inpId.focus(); return; }
    if (!password) { erroEl.textContent = "Informe a senha."; inpSenha.focus(); return; }

    carregando(true);
    try {
      await L.api.auth.login({ identifier, password, perfil });
      try {
        if (chkLembrar.checked) localStorage.setItem(LEMBRAR_KEY, identifier); else localStorage.removeItem(LEMBRAR_KEY);
      } catch (err) { /* sem storage */ }
      location.replace(destino());
    } catch (err) {
      erroEl.textContent = (err && err.message) || "Não foi possível entrar. Tente novamente.";
      carregando(false);
      inpSenha.select();
    }
  });
})();
