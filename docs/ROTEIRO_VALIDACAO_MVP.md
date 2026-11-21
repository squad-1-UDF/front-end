# Roteiro de validação visual do MVP com Django

Use apenas um PostgreSQL 16 **local isolado**. No Back-end, aplique as migrations da etapa final (perfis, campos novos de espaço e chave) e crie três usuários de teste:

- **administrador:** superusuário ou membro do grupo `admin`
- **funcionário:** `is_staff=True`, fora do grupo `admin`
- **estudante:** usuário comum

Cadastre também pelo menos um espaço com `name`, `capacity` e `location` preenchidos e outro só com `code` e `kind`. Execute `python manage.py runserver 127.0.0.1:8000`. No Front-end, execute `python dev_server.py`. Abra **http://127.0.0.1:5173/login.html** e mantenha `127.0.0.1` em ambas as URLs.

No console do navegador, execute `localStorage.setItem('labtech_api_modo', 'api'); location.reload()`. Deixe as abas **Console** e **Network** do DevTools abertas, com *Preserve log* ativo. Use uma data e um horário futuros para as reservas.

## Sessão, perfis e reservas

| Passo | Ação no navegador | Resultado esperado |
|---|---|---|
| 1 | Entre com o **administrador**. | `GET /auth/csrf/` retorna 204; `POST /auth/login/` retorna 200 e define `sessionid`; ocorre redirecionamento para o dashboard. O POST contém `X-CSRFToken`. |
| 2 | Recarregue o dashboard e confira o menu lateral. | `GET /auth/me/` retorna 200 com `role:"admin"`, `name` e `email`. O rodapé do menu mostra o nome e "Administrador". Aparecem as seções Principal, **Chaves** e **Administração**. A saudação usa o primeiro nome. O card "Chaves emprestadas agora" mostra o total real (`GET /key-loans/?status=active`). |
| 3 | Abra **Laboratórios e salas**, alterne cards/tabela e abra um detalhe. | `GET /spaces/?is_active=true` e `GET /spaces/{id}/` retornam 200. O espaço com campos preenchidos mostra nome, localização e capacidade; o outro mostra só o código, **sem** textos `undefined`, `null` ou "Até 0". No detalhe, o painel "Chaves da sala" lista as chaves do espaço (`GET /keys/?space_id=`). |
| 4 | No detalhe, consulte um período futuro. | `GET /spaces/{id}/booking-availability/` retorna 200 e a indicação visual corresponde ao campo `available`. |
| 5 | Abra a **Agenda**, alterne semana/dia e escolha um espaço. | `GET /spaces/{id}/booking-agenda/` retorna 200. A grade mostra ocupação sem dados pessoais nem finalidade. |
| 6 | Abra **Reservar sala**, selecione o espaço, data e horário livres; confirme. | Modal fecha; `POST /bookings/` retorna 201; o corpo contém somente `space_id`, `start_at`, `end_at`, com CSRF renovado após o login. |
| 7 | Repita a reserva para o mesmo espaço e intervalo. | O modal indica "Horário ocupado". Se o conflito surgir entre a consulta e o envio, `POST /bookings/` retorna 409 `BOOKING_CONFLICT` e o modal continua utilizável. |
| 8 | Abra **Minhas reservas** e cancele a reserva criada. | `POST /bookings/{id}/cancel/` com CSRF; a reserva passa para Canceladas. |

## Espaços e chaves (administrador)

| Passo | Ação no navegador | Resultado esperado |
|---|---|---|
| 9 | Abra **Salas e chaves** e clique em **Nova sala**. Preencha código, tipo, nome, capacidade e localização. | O formulário só tem os campos do contrato (código, tipo Laboratório/Sala de aula, nome, capacidade, localização, ativa). `POST /spaces/` retorna 201 com `code`, `kind`, `name`, `capacity`, `location`, `is_active`. |
| 10 | Edite a sala: apague o nome e a capacidade e salve. Depois use **Desativar**. | `PATCH /spaces/{id}/` retorna 200; capacidade vazia vai como `null`. A desativação envia apenas `{"is_active":false}`. A sala aparece como Inativa e some de Laboratórios e salas e de Reservar. Não existe botão de excluir. |
| 11 | Na aba **Chaves**, clique em **Nova chave**, escolha a sala e o estado "Disponível para retirada". | `POST /keys/` com `label`, `space_id` e `status`; retorna 201. |
| 12 | Cadastre outra chave com um rótulo já usado (mude só maiúsculas/minúsculas). | A API recusa o rótulo duplicado e o modal mostra a mensagem, sem fechar. |
| 13 | Edite uma chave e mude o estado para "Em manutenção". | `PATCH /keys/{id}/` envia só o que mudou (`label`/`status`; `space_id` só se a sala mudou). A situação passa para "Manutenção". |
| 14 | Edite uma chave que já teve empréstimo e troque a sala. | `PATCH` retorna 409 e o modal explica que a chave com histórico não muda de sala. |

## Retirada, devolução e histórico (funcionário ou administrador)

| Passo | Ação no navegador | Resultado esperado |
|---|---|---|
| 15 | Abra **Retirada e devolução**. | `GET /keys/` e `GET /key-loans/?status=active` retornam 200. Os indicadores batem com a lista. "Fora de uso" soma inativas, em manutenção e extraviadas. A aba "Todas as chaves" mostra situação e "com <responsável>" nas emprestadas. |
| 16 | Clique em **Registrar retirada**, escolha uma chave disponível e digite parte do nome do responsável. | A busca chama `GET /users/?q=<texto>&is_active=true&limit=30` (com pausa entre as teclas). Só aparecem usuários ativos. |
| 17 | Confirme a retirada. | `POST /key-loans/` com `key_id`, `responsible_user_id` e `X-CSRFToken`; retorna 201. O toast mostra chave, responsável e horário; a chave aparece em "Emprestadas agora". |
| 18 | Em outra aba, retire a mesma chave; depois tente confirmar na primeira aba (ou use uma chave em manutenção pela URL `chaves.html?chave=<id>`). | `POST /key-loans/` retorna **409 `KEY_UNAVAILABLE`**. O modal continua aberto com a mensagem amigável, a chave sai da lista do modal e a tela é atualizada. |
| 19 | Clique em **Registrar devolução** e confirme. | `POST /key-loans/{id}/return/` com `{}` e CSRF; retorna 200. A chave volta para Disponível. Repetir a devolução em outra aba mostra o aviso de `LOAN_ALREADY_RETURNED`. |
| 20 | Abra **Histórico de chaves**. Filtre por responsável, por período e depois por uma chave. | Sem chave escolhida: `GET /key-loans/?responsible_user_id=<id>`. Com chave: `GET /keys/{id}/movements/` e `GET /key-loans/?key_id=<id>`; cada movimento mostra responsável e "Registrado por". |
| 21 | Use **Exportar CSV** e **Emitir histórico**. | O CSV (separador `;`, UTF-8) traz as linhas filtradas. A impressão sai em tema claro, com o cabeçalho UDF, a chave, o período e quem emitiu. |

## Usuários e perfis (administrador)

| Passo | Ação no navegador | Resultado esperado |
|---|---|---|
| 22 | Abra **Usuários**. | `GET /users/` retorna 200. A tabela mostra nome, e-mail, login (`username`), perfil e situação. Os indicadores contam ativos por perfil. |
| 23 | Clique em **Novo usuário** e preencha nome, login, e-mail, senha inicial e perfil Funcionário. | `POST /users/` com `username`, `name`, `email`, `role`, `password` e CSRF; retorna 201. Senha fraca ou e-mail repetido trazem a mensagem do back no próprio modal. |
| 24 | Edite o usuário criado: mude o perfil para Estudante e deixe a senha em branco. | `PATCH /users/{id}/` envia só os campos alterados (sem `username` e sem `password`). |
| 25 | Desative e reative o usuário. | `PATCH` com `{"is_active":false}` e depois `true`. O próprio administrador não tem botão de desativar; se forçar pela API, o 400 aparece como mensagem. |
| 26 | Saia e entre com o **funcionário**. | O menu mostra Principal e Chaves, sem Administração. Abrir `admin.html` direto volta para o início com o aviso "Seu perfil não tem acesso àquela tela". |
| 27 | Saia e entre com o **estudante**. | O menu mostra só Principal. Abrir `chaves.html` direto volta para o início com o aviso. O dashboard mostra "Próxima reserva" no lugar das chaves. |
| 28 | Use **Sair** e abra diretamente `http://127.0.0.1:5173/salas.html`. | Logout retorna 200; `/auth/me/` retorna 403 e a página protegida redireciona para login. |

## Responsividade e modo demonstração

Repita uma navegação básica em desktop e com a largura do navegador em 390 px. Confira principalmente Retirada e devolução, Histórico, Usuários e Salas e chaves. Verifique se menu, cards, tabelas (com rolagem só dentro da tabela), modais, botões e mensagens continuam visíveis e utilizáveis, **sem rolagem horizontal da página**. Registre capturas e eventuais erros no Console. Não marque o teste como concluído apenas por respostas HTTP: observe as telas.

Para checar a demonstração, execute `localStorage.setItem('labtech_api_modo', 'mock'); location.reload()` em `login.html`, entre com os usuários de demonstração do README e repita os passos 9 a 27 sem back-end. O comportamento esperado é o mesmo, com os campos extras da demonstração (bloco, andar, recursos, matrícula, observação da chave).
