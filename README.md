# front-end - LabTech Squad 1

Telas do MVP do **Sistema de Gestão de Laboratórios e Salas** (UDF / LabTech).
Protótipos estáticos em HTML + CSS + JS, seguindo o padrão visual do Dashboard (Luanna),
para depois virarem Django Templates na integração com o back-end.

## Como abrir

Qualquer servidor estático na raiz do repositório. Exemplos:

```bash
npx serve .          # Node
python -m http.server  # Python
```

Ou abra `index.html` direto no navegador (os dados ficam em `data/salas.js`, então funciona sem servidor).

## Telas

| Tela | Arquivo | Responsável | Status |
|---|---|---|---|
| Índice das telas | `index.html` | - | ok |
| Lista de salas/laboratórios | `salas.html` | João Gabriel Leal | pronta para revisão |
| Detalhes da sala | `sala-detalhes.html?id=<id>` | João Gabriel Leal | pronta para revisão |
| Login / Dashboard | - | Luanna Priscila | protótipo externo (GitHub Pages dela) |
| Nova reserva / Minhas reservas | - | Luiz Cláudio | pendente |

## Estrutura

```
css/base.css              tokens de cor/fonte, sidebar, topbar, botões, badges, tabela (compartilhado)
css/salas.css             específico da lista
css/sala-detalhes.css     específico dos detalhes
css/_luanna_dashboard_ref.css  cópia do CSS do Dashboard da Luanna, só como referência
js/common.js              helpers (escape, badges, toast, ações "em construção")
js/salas.js               filtros, ordenação, cards/tabela, paginação
js/sala-detalhes.js       cabeçalho, recursos, grade semanal, reservas, chaves
data/salas.js             dados fictícios (20 salas, reservas, grade semanal gerada)
assets/                   mascote e logo UDF (mesmos do Dashboard)
```

## Padrão visual (resumo)

- Fundo branco, sidebar clara (95px), cards azul-marinho `#12284b` com texto branco.
- Acento azul claro `#8cc1e9`, azul UDF `#0055a0`, status: livre `#34d399`, ocupado `#8cc1e9`, manutenção `#ef4444`, reservado `#f59e0b`.
- Fontes: Patrick Hand (títulos/corpo) e Plus Jakarta Sans. Ícones: Font Awesome 6.4.
- Cantos 20px nos cards, 12px em botões/campos. Breakpoint mobile em 900px (sidebar vira barra superior).

Todos os tokens estão em `css/base.css` (`:root`). Mudou a cor lá, muda em todas as telas.

## Integração com o Django (fase 2)

- `salas.html` → `templates/salas/lista.html` com `{% for sala in salas %}`; os filtros viram query params da view.
- `sala-detalhes.html` → `templates/salas/detalhe.html` recebendo `sala`, `reservas` e a grade de disponibilidade no context.
- Links já preparados: `sala-detalhes.html?id=` e `nova-reserva.html?sala=&data=&inicio=&fim=` (quando a tela de Nova Reserva existir, basta ler esses parâmetros).
