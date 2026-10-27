# front-end - LabReserva UDF (Squad 1)

Telas do MVP do **Sistema de Gestão de Laboratórios e Salas** (UDF / LabTech).
Protótipos estáticos em HTML + CSS + JS, seguindo o **guia visual definido na reunião de 24/10/2026**
(cores UDF azul-marinho + dourado, fonte Inter, cards brancos, sem mascotes),
para depois virarem Django Templates na integração com o back-end.

## Como abrir

Qualquer servidor estático na raiz do repositório. Exemplos:

```bash
npx serve .            # Node
python -m http.server  # Python
```

Ou abra `index.html` direto no navegador (os dados ficam em `data/salas.js`, então funciona sem servidor).

## Telas

| Tela | Arquivo | Responsável | Status |
|---|---|---|---|
| Índice das telas | `index.html` | - | ok |
| Lista de salas/laboratórios | `salas.html` | João Gabriel Leal | pronta para revisão (padrão novo) |
| Detalhes da sala | `sala-detalhes.html?id=<id>` | João Gabriel Leal | pronta para revisão (padrão novo) |
| Login | branch `tela_login` | Luanna Priscila | ok |
| Dashboard | branch `dashboard` | Luanna Priscila | ok |
| Reservar sala / Minhas reservas | - | Luiz Cláudio | pendente |
| Área administrativa | - | Raiane | pendente |

## Estrutura

```
css/base.css              tokens de cor/fonte (claro e escuro), sidebar 260px, topbar, botões, badges, chips, tabela (compartilhado)
css/salas.css             específico da lista (hero, filtros, cards por tipo, tabela, paginação)
css/sala-detalhes.css     específico dos detalhes (cabeçalho, recursos, grade semanal, lateral)
js/common.js              helpers (escape, badges, chips, capa por tipo, toast, tema claro/escuro, ações "em construção")
js/salas.js               filtros, ordenação, cards/tabela, paginação
js/sala-detalhes.js       cabeçalho, recursos, grade semanal, reservas, chaves
data/salas.js             dados fictícios (20 salas, reservas, grade semanal gerada)
assets/                   logo UDF
```

## Padrão visual (resumo do guia)

- **Cores:** azul-marinho `#12284B` (botão principal, títulos), azul UDF `#0055A0` (links, foco), azul claro `#8CC1E9`,
  azul névoa `#E8F1FA` (menu ativo, hero), dourado `#F2B705` (só 1 CTA de destaque por tela).
- **Neutros:** fundo `#F6F8FB`, cards/sidebar `#FFFFFF` com borda `#E3E8F0`, texto secundário `#5B6B7F`.
- **Status:** livre `#34D399`, ocupado `#8CC1E9`, pendente/reservado `#F59E0B`, manutenção `#EF4444`.
- **Fonte:** Inter em tudo. Ícones: Font Awesome 6.4.
- **Layout:** sidebar 260px com texto e seções (Principal / Gestão), topbar 64px com breadcrumb e data,
  conteúdo até 1280px, cards com cantos 20px, botões 40px / cantos 12px, campos 44px.
- **Tema escuro:** toggle na sidebar, salvo em `localStorage` na chave `labtech_theme` (mesma do Dashboard da Luanna).
  Os tokens escuros ficam em `[data-theme="dark"]` no `base.css`.
- **Capa dos cards por tipo:** laboratório azul névoa, sala de aula dourado suave, reunião cinza, auditório verde suave.
- Mobile (< 900px): sidebar vira barra no topo só com ícones, cards em 1 coluna.

Todos os tokens estão em `css/base.css` (`:root` e `[data-theme="dark"]`). Mudou a cor lá, muda em todas as telas.

## Integração com o Django (fase 2)

- `salas.html` → `templates/salas/lista.html` com `{% for sala in salas %}`; os filtros viram query params da view.
- `sala-detalhes.html` → `templates/salas/detalhe.html` recebendo `sala`, `reservas` e a grade de disponibilidade no context.
- Links já preparados: `sala-detalhes.html?id=` e `nova-reserva.html?sala=&data=&inicio=&fim=` (quando a tela de Reservar sala existir, basta ler esses parâmetros).
