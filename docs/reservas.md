# LabReserva

Duas páginas responsivas feitas com HTML, CSS e JavaScript puro, sem dependências.

- `reservar-sala.html`: catálogo de salas, busca, filtros e formulário para reservar.
- `minhas-reservas.html`: próximas reservas, histórico e cancelamento.
- `styles/style.css`: estilos compartilhados, responsividade e temas claro/escuro.
- `scripts/app.js`: catálogo demonstrativo, armazenamento e tema.
- `scripts/reservar.js`: filtros e validação das reservas.
- `scripts/minhas-reservas.js`: consulta e cancelamento.

Abra `reservar-sala.html` no navegador. Para garantir o compartilhamento do armazenamento entre as páginas em todos os navegadores, execute `python -m http.server 8000` nesta pasta e acesse http://localhost:8000/reservar-sala.html.

O tema inicial é claro. A opção escolhida é lembrada neste navegador. As reservas também são locais: não existe autenticação, servidor ou sincronização entre usuários. As salas são exemplos e podem ser editadas em `scripts/app.js`. Não são criadas reservas fictícias no histórico.

Validações: finalidade obrigatória, capacidade, horários futuros, funcionamento entre 7h e 22h e conflito de horário para a mesma sala. Cancelar uma reserva libera seu horário e mantém seu histórico.

## Identidade visual UDF

As duas páginas seguem o resumo do Guia Visual LabReserva UDF fornecido: Inter, Font Awesome 6, paleta azul-marinho/azul névoa, estrela dourada e um CTA dourado por tela. Os tokens estão em `styles/base.css` e os componentes em `styles/style.css`. Abaixo de 900px, o menu fica no topo e os cards de salas passam a uma coluna.

Inter e Font Awesome são carregados por CDN e precisam de internet. A fonte possui fallback de sistema. O tema inicial permanece claro; uma preferência já salva é respeitada.
