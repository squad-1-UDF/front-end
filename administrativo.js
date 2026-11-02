
const botao = document.getElementById('botao-tema');
const body = document.body;

// Recupera o tema salvo no navegador
const temaSalvo = localStorage.getItem('tema');

// Aplica o tema salvo
aplicarTema(temaSalvo === 'dark');

// Função para aplicar o tema
function aplicarTema(escuro) {
    if (escuro) {
        body.classList.add('dark');
        botao.innerHTML = '<i class="fa-solid fa-sun"></i>';
        botao.setAttribute('aria-label', 'Ativar tema claro');
        botao.setAttribute('title', 'Ativar tema claro');
    } else {
        body.classList.remove('dark');
        botao.innerHTML = '<i class="fa-solid fa-moon"></i>';
        botao.setAttribute('aria-label', 'Ativar tema escuro');
        botao.setAttribute('title', 'Ativar tema escuro');
    }
}

// Alterna o tema ao clicar
botao.addEventListener('click', (event) => {
    event.preventDefault();

    const estaEscuro = body.classList.contains('dark');

    aplicarTema(!estaEscuro);

    // Salva a preferência
    localStorage.setItem('tema', !estaEscuro ? 'dark' : 'claro');
});
