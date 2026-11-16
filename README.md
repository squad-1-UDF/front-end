# LabReserva UDF: front-end (Squad 1, LabTech)

Front-end do **Sistema de Gestão de Laboratórios, Salas e Chaves** da UDF.
HTML, CSS e JavaScript puro, sem framework e sem build. Esta branch junta as telas que cada integrante fez em branches separadas, com **um padrão visual e de código único**, e completa as telas que faltavam no MVP.

## Como rodar

Use qualquer servidor estático na raiz do repositório:

```bash
python -m http.server 8000
```

ou

```bash
npx serve .
```

Depois abra http://localhost:8000/login.html.

Com o arquivo aberto direto (`file://`), alguns navegadores não compartilham o `localStorage` entre as páginas. Prefira o servidor.

### Acesso de demonstração

Sem back-end, o sistema roda em **modo demonstração**. Os dados ficam no navegador e o selo "Demonstração" aparece na barra de cima. A senha de todos os usuários é `labtech`:

| Perfil | E-mail | O que vê |
|---|---|---|
| Administrador | ana.costa@udf.edu.br | Tudo, inclusive usuários, salas e chaves |
| Funcionário | rafael.nunes@udf.edu.br | Telas comuns, mais retirada, devolução e histórico de chaves |
| Estudante | joao.silva@udf.edu.br | Salas, agenda, reservar e minhas reservas |

O botão "Restaurar dados de demonstração", no painel administrativo, volta tudo ao estado inicial.

## Telas

| Tela | Arquivo | Perfis | Autoria original |
|---|---|---|---|
| Login | `login.html` | público | Luanna Priscila |
| Início (dashboard) | `index.html` | todos | Luanna Priscila |
| Laboratórios e salas | `salas.html` | todos | João Gabriel Leal |
| Detalhes da sala | `sala-detalhes.html?id=` | todos | João Gabriel Leal |
| Agenda / disponibilidade | `agenda.html` | todos | nova na integração |
| Reservar sala | `reservar-sala.html` | todos | Luiz Cláudio |
| Minhas reservas | `minhas-reservas.html` | todos | Luiz Cláudio |
| Retirada e devolução de chaves | `chaves.html` | funcionário, admin | nova na integração |
| Histórico de chaves (com emissão e CSV) | `chave-historico.html` | funcionário, admin | nova na integração |
| Painel administrativo | `admin.html` | admin | Raiane |
| Usuários | `admin-usuarios.html` | admin | nova na integração |
| Salas e chaves (cadastro) | `admin-salas.html` | admin | nova na integração |

Casos de uso cobertos (veja `back-end/docs/REQUISITOS_E_CONTRATO.md`):

| Caso de uso | Telas |
|---|---|
| UC001 Login | login |
| UC002 Usuários | admin-usuarios |
| UC003 Salas | admin-salas, salas, detalhes |
| UC004 Chaves | admin-salas |
| UC005 e UC006 Retirada e devolução | chaves |
| UC007 Disponibilidade da chave | chaves, detalhes |
| UC008 Histórico | chave-historico |
| UC009 Emitir histórico | chave-historico, botão "Emitir histórico" |

Além dos casos de uso, as telas cobrem os itens do MVP do grupo: agenda, reserva com checagem de conflito, minhas reservas e cancelamento.

## Estrutura

```
*.html                uma página por tela
css/base.css          tokens (cores UDF, tema claro/escuro), shell e componentes. Mudou aqui, muda em todas as telas
css/<tela>.css        só o que é específico de cada tela
js/core.js            monta sidebar/topbar/rodapé, protege por login e perfil, tema, toast, modal, helpers
js/api.js             ÚNICA porta de dados (modo demonstração ou API Django)
js/<tela>.js          comportamento de cada tela
data/seed.js          dados de demonstração (salas, usuários, chaves, reservas, empréstimos)
assets/               logo UDF e ilustração do login
```

### Padrão de uma tela interna

```html
<body data-page="agenda" data-title="Agenda" data-roles="employee,admin">
  <div class="app-shell">
    <aside class="sidebar" id="app-sidebar"></aside>
    <main class="main">
      <header class="topbar" id="app-topbar"></header>
      <div class="content"> ... </div>
      <footer class="page-footer" id="app-footer"></footer>
    </main>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script src="data/seed.js"></script>
  <script src="js/api.js"></script>
  <script src="js/core.js"></script>
  <script src="js/agenda.js"></script>
</body>
```

O menu fica em um lugar só (`LABTECH.MENU`, em `js/core.js`) e já aparece de acordo com o perfil. Cada tela começa com `LABTECH.pronto.then(async (usuario) => { ... })` e busca dados só por `LABTECH.api`.

## Padrão visual

O padrão segue o guia definido na reunião de 24/10:

- **Cores:**
  - azul-marinho `#12284B`: títulos e botão principal
  - azul UDF `#0055A0`: links e foco
  - azul névoa `#E8F1FA`: menu ativo e destaques
  - dourado `#F2B705`: **só 1 botão de destaque por tela**
- **Status:**
  - livre: verde
  - ocupado: azul-claro
  - reservado ou emprestado: âmbar
  - manutenção: vermelho
- **Fonte e ícones:** fonte Inter e ícones Font Awesome 6.4.
- **Layout:**
  - sidebar de 260px e topbar de 64px
  - cards com cantos de 20px e botões com cantos de 12px
  - abaixo de 900px, o menu vai para o topo e tudo fica em uma coluna
- **Tema escuro:** é salvo na chave `labtech_theme` e vale para todas as telas.

## Integração com o back-end (Django)

`js/api.js` tem dois modos com as mesmas funções:

- **`mock` (padrão):** usa `data/seed.js` e o `localStorage`. As regras de negócio são as mesmas do back:
  - intervalos de reserva `[início, fim)`, então reservas consecutivas não conflitam
  - só se retira chave sem empréstimo ativo
  - a devolução corresponde à retirada
  - nada é apagado: usuários, salas e chaves são desativados
- **`api`:** chama `/api/v1/` seguindo `back-end/docs/API_CONTRATOS_MVP.md`. O login já segue o contrato implementado:
  1. `GET /auth/csrf/`
  2. `POST /auth/login/` com `X-CSRFToken`
  3. sessão Django

Para ativar o modo `api`, rode no console do navegador:

```js
localStorage.setItem('labtech_api_modo', 'api')
```

Os demais endpoints ainda são **propostas** no back. Os nomes de campos são traduzidos nas funções `deApi*` e `paraApi*` de `js/api.js`; é só ajustar ali quando o contrato fechar.

Com Django Templates, cada `.html` vira um template e os arquivos de `css/`, `js/` e `assets/` vão para `static/`. O front e a API ficam na mesma origem, o que já resolve o CSRF e os cookies de sessão.

## Pendências conhecidas

- Os modelos do banco ainda não existem, por isso os nomes de campos do modo `api` são provisórios.
- A recuperação de senha depende do back; hoje a tela orienta a procurar a secretaria.
- Não há fotos das salas; a tela usa uma capa por tipo de espaço.
