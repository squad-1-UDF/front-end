/* Utilidades compartilhadas entre as telas (sem dependências) */
(function () {
  const L = (window.LABTECH = window.LABTECH || {});

  L.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  L.statusLabel = (s) => (L.STATUS && L.STATUS[s]) || s;
  L.tipoLabel = (t) => (L.TIPOS && L.TIPOS[t]) || t;

  L.badge = (status) => `<span class="badge ${status}">${L.esc(L.statusLabel(status))}</span>`;

  L.recursoIcon = (key) => {
    const r = L.RECURSOS && L.RECURSOS[key];
    return r ? `<i class="${r.icon}" title="${L.esc(r.label)}" aria-label="${L.esc(r.label)}"></i>` : "";
  };
  L.recursoChip = (key) => {
    const r = L.RECURSOS && L.RECURSOS[key];
    return r ? `<span class="chip"><i class="${r.icon}"></i>${L.esc(r.label)}</span>` : "";
  };

  // Capa do card por tipo de espaço (guia visual: lab azul névoa, estudo dourado, reunião cinza, auditório verde)
  L.tipoCover = (tipo) => ({
    laboratorio: { cls: "cover-lab",     icon: "fa-solid fa-flask" },
    sala:        { cls: "cover-study",   icon: "fa-solid fa-book-open" },
    reuniao:     { cls: "cover-meeting", icon: "fa-solid fa-users" },
    auditorio:   { cls: "cover-aud",     icon: "fa-solid fa-people-roof" }
  }[tipo] || { cls: "cover-meeting", icon: "fa-solid fa-door-open" });

  L.andarLabel = (andar) => (andar === 0 ? "Térreo" : `${andar}º andar`);

  L.qs = (name) => new URLSearchParams(location.search).get(name);

  L.toast = (msg, icon = "fa-solid fa-circle-check") => {
    const el = document.getElementById("toast");
    if (!el) return;
    el.innerHTML = `<i class="${icon}"></i> ${L.esc(msg)}`;
    el.classList.add("show");
    clearTimeout(L._toastT);
    L._toastT = setTimeout(() => el.classList.remove("show"), 2600);
  };

  L.fmtData = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  /* ---------- tema claro/escuro (mesma chave do Dashboard da Luanna: labtech_theme) ---------- */
  const THEME_KEY = "labtech_theme";
  L.applyTheme = (t) => {
    document.documentElement.dataset.theme = t === "dark" ? "dark" : "";
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
      const i = b.querySelector("i");
      if (i) i.className = t === "dark" ? "fa-regular fa-sun" : "fa-regular fa-moon";
      const lbl = b.querySelector(".label");
      if (lbl) lbl.textContent = t === "dark" ? "Tema claro" : "Tema escuro";
      b.setAttribute("aria-pressed", t === "dark");
    });
  };
  L.toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    L.applyTheme(next);
  };
  document.addEventListener("DOMContentLoaded", () => {
    L.applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.addEventListener("click", L.toggleTheme));

    // data de hoje na topbar
    const d = document.getElementById("topDate");
    if (d) d.textContent = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  });

  // Ações que ainda não têm tela/back-end: avisa e não navega.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const act = a.getAttribute("data-action");
    if (act === "nova-reserva") {
      e.preventDefault();
      const sala = a.getAttribute("data-sala");
      L.toast(sala ? `Nova reserva para ${sala} (tela do Luiz, em construção)` : "Nova reserva (tela do Luiz, em construção)", "fa-regular fa-calendar-plus");
    } else if (act === "em-breve") {
      e.preventDefault();
      L.toast("Funcionalidade em construção", "fa-solid fa-screwdriver-wrench");
    }
  });
})();
