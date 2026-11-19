# Roteiro de validação visual do MVP com Django

Use apenas um PostgreSQL 16 **local isolado**. No Back-end, confirme que existe um usuário Django comum e pelo menos um espaço (`code` e `kind`); execute `python manage.py runserver 127.0.0.1:8000`. No Front-end, execute `python dev_server.py`. Abra **http://127.0.0.1:5173/login.html** e mantenha `127.0.0.1` em ambas as URLs.

No console do navegador, execute `localStorage.setItem('labtech_api_modo', 'api'); location.reload()`. Deixe as abas **Console** e **Network** do DevTools abertas, com *Preserve log* ativo. Use uma data e um horário futuros para as reservas.

| Passo | Ação no navegador | Resultado esperado |
|---|---|---|
| 1 | Entre com o nome de usuário e a senha de teste Django. | `GET /auth/csrf/` retorna 204; `POST /auth/login/` retorna 200 e define `sessionid`; ocorre redirecionamento para o dashboard. O POST contém `X-CSRFToken`. |
| 2 | Recarregue o dashboard e use os links do menu. | `GET /auth/me/` retorna 200 em cada página; aparecem Início, salas, agenda, reservar e minhas reservas. Chaves e administração não aparecem no modo API. |
| 3 | Abra **Laboratórios e salas**, alterne cards/tabela e abra um detalhe. | `GET /spaces/` e `GET /spaces/{id}/` retornam 200. Código e tipo vêm da API; não aparecem capacidade, localização, manutenção, responsável ou textos `undefined`. |
| 4 | No detalhe, consulte um período futuro. | `GET /spaces/{id}/booking-availability/` retorna 200 e a indicação visual corresponde ao campo `available`. |
| 5 | Abra a **Agenda**, alterne semana/dia e escolha um espaço. | `GET /spaces/{id}/booking-agenda/` retorna 200. A grade mostra ocupação sem exibir dados pessoais ou finalidade inexistentes. |
| 6 | Abra **Reservar sala**, selecione o espaço, data e horário livres; confirme. | Modal fecha; `POST /bookings/` retorna 201; mensagem de confirmação aparece. O corpo contém somente `space_id`, `start_at`, `end_at`, com cookie de sessão e CSRF renovado após o login. |
| 7 | Repita a reserva para o mesmo espaço e intervalo. | O modal indica "Horário ocupado" e impede o envio enquanto a consulta de disponibilidade aponta conflito. Se o conflito surgir entre a consulta e o envio, `POST /bookings/` retorna 409 `BOOKING_CONFLICT`, mantendo o modal utilizável. |
| 8 | Abra **Minhas reservas** e cancele a reserva criada. | `GET /bookings/` usa apenas `space_id`, `status`, `scope`, `limit` e `offset` quando necessários. O cancelamento usa `POST /bookings/{id}/cancel/` com CSRF; a reserva passa para Canceladas. |
| 9 | Consulte novamente a disponibilidade do mesmo intervalo. | `available:true`; a agenda já não mostra a ocupação. |
| 10 | Use **Sair** e abra diretamente `http://127.0.0.1:5173/salas.html`. | Logout retorna 200; `/auth/me/` retorna 403 e a página protegida redireciona para login. |

Repita uma navegação básica em desktop e com a largura do navegador reduzida (por exemplo, 390 px). Verifique se menu, cards, tabelas, modal, botões e mensagens continuam visíveis e utilizáveis; registre capturas e eventuais erros no Console. Não marque o teste como concluído apenas por respostas HTTP: observe as telas.

Para checar a demonstração, execute `localStorage.setItem('labtech_api_modo', 'mock'); location.reload()` em `login.html`, entre com um dos usuários de demonstração do README e abra salas, agenda e chaves. Não use endpoints da UC004 no modo API.
