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
- **`api`:** chama `/api/v1/` seguindo `back-end/docs/GUIA_FRONTEND_MVP.md`. Login, leitura de espaços, agenda, disponibilidade e reservas usam os endpoints integrados:
  1. `GET /auth/csrf/`
  2. `POST /auth/login/` com `X-CSRFToken`
  3. releitura do cookie CSRF renovado e validação da sessão em `GET /auth/me/`

Para ativar o modo `api`, rode no console do navegador:

```js
localStorage.setItem('labtech_api_modo', 'api')
location.reload()
```

Para voltar à demonstração: `localStorage.setItem('labtech_api_modo', 'mock'); location.reload()`.

### Execução local na mesma origem

Para a checagem da interface antes do merge, siga o [roteiro de validação visual](docs/ROTEIRO_VALIDACAO_MVP.md).

Use o Back-end em `http://127.0.0.1:8000` com banco PostgreSQL **local isolado** e `DJANGO_DEBUG=true`. No diretório do Back-end, siga as instruções de banco local do README e execute `python manage.py runserver 127.0.0.1:8000`. Crie um usuário de teste no banco local antes de entrar. Em outro terminal, neste repositório:

```bash
python dev_server.py
```

Abra `http://127.0.0.1:5173/login.html`, ative o modo API no console e recarregue. `dev_server.py` serve os arquivos e encaminha **somente** `/api/v1/` para o Django. Para o navegador, páginas e API têm a mesma origem. O proxy preserva `Host`, `Origin`, `Cookie` e `Set-Cookie`; assim, sessão e CSRF funcionam sem CORS ou desativação de CSRF. Use sempre `127.0.0.1` e a porta indicada; `localhost` é outro host. O servidor de desenvolvimento escuta apenas na interface local.

Em origens distintas, o Back-end atual não habilita CORS com credenciais. Esse uso exige configurar origens exatas, `CORS_ALLOW_CREDENTIALS`, `CSRF_TRUSTED_ORIGINS`, política de cookies e HTTPS de forma coordenada; este projeto não ativa essa configuração.

No modo API, o login usa o **nome de usuário Django**, sem escolha de perfil. `/auth/me/` devolve apenas `id`, portanto o Front-end valida a sessão por esse endpoint e não usa o `localStorage` como prova de autenticação ou autorização. As telas de gestão permanecem fechadas no modo API. Para habilitá-las futuramente, é necessária uma PR separada no Back-end com uma extensão mínima de `/auth/me/` que informe `is_staff` (e, se necessário, os atributos de apresentação), seguida do mapeamento explícito das permissões no Front-end.

O contrato de espaços fornece `id`, `code` e `kind`. Por isso o modo API não mostra capacidade, localização, manutenção, responsáveis, recursos, finalidade nem participantes. Listagem, detalhes, agenda, disponibilidade, criação, conflito `409`, minhas reservas e cancelamento usam dados reais. Cadastro de chaves, empréstimos, administração de usuários e salas e outras operações da UC004 continuam apenas no modo demonstração. A API integrada tem endpoints de empréstimo e histórico, mas este Front-end ainda não os conecta.

Erros da API são exibidos pela mensagem do contrato: `400` para entrada ou intervalo inválido, `403` para ausência de sessão, falta de permissão ou CSRF, `404` para recurso inexistente e `409` para conflito de reserva ou código duplicado. O conflito de reserva mantém o diálogo aberto para escolher outro horário. Os erros de domínio usam `error.code` e `error.message`; login inválido e CSRF usam `error` como texto.

Com Django Templates, cada `.html` vira um template e os arquivos de `css/`, `js/` e `assets/` vão para `static/`. O front e a API ficam na mesma origem, o que já resolve o CSRF e os cookies de sessão.

## Pendências conhecidas

- `/auth/me/` ainda não informa permissões de staff; a extensão deve ser tratada em PR separada no Back-end.
- A recuperação de senha depende do back; hoje a tela orienta a procurar a secretaria.
- Não há fotos das salas; a tela usa uma capa por tipo de espaço.
