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

`js/api.js` tem dois modos com as **mesmas funções públicas** (`LABTECH.api.<recurso>.<ação>()`). Só a implementação muda:

- **`mock` (padrão):** usa `data/seed.js` e o `localStorage`. As regras de negócio são as mesmas do back:
  - intervalos de reserva `[início, fim)`, então reservas consecutivas não conflitam
  - só se retira chave **disponível** (estado `available`) e sem empréstimo ativo; senão, `KEY_UNAVAILABLE`
  - a devolução corresponde à retirada
  - nada é apagado: usuários, salas e chaves são desativados
- **`api`:** chama `/api/v1/` com sessão Django e CSRF, seguindo o contrato combinado da etapa final (perfis, usuários, espaços, chaves e empréstimos) e `back-end/docs/GUIA_FRONTEND_MVP.md`. As funções `deApi*` convertem as respostas da API para os campos em português que as telas usam, e as `paraApi*` fazem o caminho inverso, enviando só os campos do contrato (o `PATCH` é parcial).

Para ativar o modo `api`, rode no console do navegador:

```js
localStorage.setItem('labtech_api_modo', 'api')
location.reload()
```

Para voltar à demonstração: `localStorage.setItem('labtech_api_modo', 'mock'); location.reload()`.

### Perfis (papel do usuário)

No modo API, o papel vem **sempre** de `GET /auth/me/` (`role`: `admin`, `employee` ou `student`), junto com `name` e `email`. Nada no `localStorage` serve como prova de autenticação ou de perfil. O menu (`LABTECH.MENU`) e a proteção por `data-roles` de cada página usam esse papel:

| Papel | Menu e telas |
|---|---|
| `student` | Início, salas, agenda, reservar e minhas reservas |
| `employee` | Tudo do estudante, mais retirada/devolução e histórico de chaves |
| `admin` | Tudo, mais painel administrativo, usuários e salas e chaves |

Quem abre uma tela sem permissão volta para o início com um aviso. Se o back ainda não mandar `role` (versão antiga), `is_staff: true` vale como `employee`; sem nenhum dos dois, o usuário fica sem as áreas de gestão.

### O que cada tela chama no modo API

| Tela | Endpoints |
|---|---|
| Login e todas as telas | `GET /auth/csrf/`, `POST /auth/login/`, `GET /auth/me/`, `POST /auth/logout/` |
| Início | `GET /spaces/?is_active=true`, `GET /bookings/?scope=mine`; gestão: `GET /key-loans/?status=active` |
| Salas, detalhes, agenda, reservar | `GET /spaces/`, `GET /spaces/{id}/`, `booking-availability`, `booking-agenda`, `POST /bookings/`; detalhes (gestão): `GET /keys/?space_id=` |
| Minhas reservas | `GET /bookings/?scope=mine`, `POST /bookings/{id}/cancel/` |
| Retirada e devolução | `GET /keys/`, `GET /key-loans/?status=active`, `GET /users/?q=&is_active=true&limit=30`, `POST /key-loans/`, `POST /key-loans/{id}/return/` |
| Histórico de chaves | `GET /key-loans/?responsible_user_id=`, `GET /keys/{id}/movements/` (+ `GET /key-loans/?key_id=` para mostrar o responsável), `GET /users/` |
| Painel administrativo | `GET /users/`, `GET /spaces/`, `GET /bookings/?scope=all`, `GET /keys/`, `GET /key-loans/` |
| Usuários | `GET /users/`, `POST /users/`, `PATCH /users/{id}/` |
| Salas e chaves | `GET/POST /spaces/`, `PATCH /spaces/{id}/`, `GET/POST /keys/`, `PATCH /keys/{id}/` |

Todo `POST`/`PATCH` leva `X-CSRFToken` com o cookie `csrftoken` relido na hora (o login renova o token). Não existe `DELETE`: salas, chaves e usuários são desativados.

### Campos que podem vir vazios

- **Espaço** (`name`, `capacity`, `location`, `is_active`): sem `name`, as telas mostram o código; capacidade e localização só aparecem quando preenchidas. A API só tem os tipos `laboratory` e `room` (no front, "Laboratório" e "Sala de aula"); "manutenção de sala" não existe no contrato, então o modo API mostra salas ativas e inativas.
- **Chave** (`label`, `status`): `status` é o estado administrativo (`available`, `maintenance`, `lost`, `inactive`). A situação mostrada na tela junta o estado com o empréstimo ativo: "Emprestada" tem prioridade; depois "Disponível", "Manutenção", "Extraviada" ou "Inativa". A localização da chave usa a localização da sala.
- **Usuário**: o login é o `username` do Django (definido no cadastro e não muda depois). A senha inicial é obrigatória no cadastro e passa pelos validadores do Django; na edição, senha em branco mantém a atual. Não há matrícula no contrato, então a coluna mostra o login.
- **Reserva**: a API não informa finalidade, participantes nem titular; essas informações não aparecem no modo API.

### Erros

Os erros da API são exibidos pela mensagem do contrato (`error.message`). Alguns códigos têm texto próprio:

- `409 KEY_UNAVAILABLE` (retirada de chave já emprestada ou fora de circulação): o modal de retirada continua aberto, tira a chave da lista e explica o motivo
- `409 LOAN_ALREADY_RETURNED`: avisa que a devolução já existia e atualiza a lista
- `409` ao trocar a sala de uma chave com histórico: orienta a cadastrar outra chave
- `400` de usuários (por exemplo, o admin tentando se desativar): mostra a mensagem do back
- `403`: sem sessão, sem permissão ou CSRF inválido

O conflito de reserva mantém o diálogo aberto para escolher outro horário. Login inválido e CSRF usam `error` como texto.

### Execução local na mesma origem

Para a checagem da interface antes do merge, siga o [roteiro de validação visual](docs/ROTEIRO_VALIDACAO_MVP.md).

Use o Back-end em `http://127.0.0.1:8000` com banco PostgreSQL **local isolado** e `DJANGO_DEBUG=true`. No diretório do Back-end, siga as instruções de banco local do README e execute `python manage.py runserver 127.0.0.1:8000`. Crie usuários de teste no banco local antes de entrar: pelo menos um administrador (superusuário ou grupo `admin`), um funcionário (`is_staff`) e um estudante. Em outro terminal, neste repositório:

```bash
python dev_server.py
```

Abra `http://127.0.0.1:5173/login.html`, ative o modo API no console e recarregue. `dev_server.py` serve os arquivos e encaminha **somente** `/api/v1/` para o Django. Para o navegador, páginas e API têm a mesma origem. O proxy preserva `Host`, `Origin`, `Cookie` e `Set-Cookie`; assim, sessão e CSRF funcionam sem CORS ou desativação de CSRF. Use sempre `127.0.0.1` e a porta indicada; `localhost` é outro host. O servidor de desenvolvimento escuta apenas na interface local.

Em origens distintas, o Back-end atual não habilita CORS com credenciais. Esse uso exige configurar origens exatas, `CORS_ALLOW_CREDENTIALS`, `CSRF_TRUSTED_ORIGINS`, política de cookies e HTTPS de forma coordenada; este projeto não ativa essa configuração.

Com Django Templates, cada `.html` vira um template e os arquivos de `css/`, `js/` e `assets/` vão para `static/`. O front e a API ficam na mesma origem, o que já resolve o CSRF e os cookies de sessão.

## Testes

```bash
node --test tests/api-contract.test.cjs
```

Sem dependências. Os testes rodam `js/api.js` num `vm` do Node com um `fetch` falso e conferem, no modo API, os mapeamentos (`/auth/me/` com `role`, espaços, `KeyOut`, `LoanOut`, usuários), os filtros enviados, a paginação `limit`/`offset`, o corpo dos `POST`/`PATCH` e o cabeçalho `X-CSRFToken`. No modo demonstração, conferem login, usuários, estados de chave e a regra de `KEY_UNAVAILABLE`. A CI (`.github/workflows/ci.yml`) roda esses testes e um `node --check` em cada arquivo de `js/`.

## Pendências conhecidas

- A recuperação de senha depende do back; hoje a tela orienta a procurar a secretaria.
- Não há fotos das salas; a tela usa uma capa por tipo de espaço.
- O contrato não traz o titular das reservas nem o nome do operador do empréstimo (só o id); o histórico resolve o nome do operador pela lista de usuários.
