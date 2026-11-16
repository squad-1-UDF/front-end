/* ============================================================
   Dados de demonstração (seed) do LabReserva.
   Usados pelo modo "mock" de js/api.js, que copia estes dados para o
   localStorage na primeira visita. Para voltar ao estado inicial:
   botão "Restaurar dados de demonstração" no painel administrativo.
   Quando o back-end estiver pronto, estes dados deixam de ser usados.
   ============================================================ */
window.LABTECH = window.LABTECH || {};

window.LABTECH.RECURSOS = {
  "computadores": {
    "icon": "fa-solid fa-computer",
    "label": "Computadores"
  },
  "projetor": {
    "icon": "fa-solid fa-video",
    "label": "Projetor"
  },
  "ar": {
    "icon": "fa-regular fa-snowflake",
    "label": "Ar-condicionado"
  },
  "quadro": {
    "icon": "fa-solid fa-chalkboard",
    "label": "Quadro branco"
  },
  "bancadas": {
    "icon": "fa-solid fa-vial",
    "label": "Bancadas"
  },
  "wifi": {
    "icon": "fa-solid fa-wifi",
    "label": "Wi-Fi"
  },
  "tv": {
    "icon": "fa-solid fa-tv",
    "label": "TV"
  },
  "som": {
    "icon": "fa-solid fa-volume-high",
    "label": "Sistema de som"
  },
  "acessivel": {
    "icon": "fa-solid fa-wheelchair",
    "label": "Acessível"
  },
  "impressora3d": {
    "icon": "fa-solid fa-cube",
    "label": "Impressora 3D"
  },
  "rede": {
    "icon": "fa-solid fa-network-wired",
    "label": "Rack de rede"
  }
};

window.LABTECH.TIPOS = {
  "laboratorio": "Laboratório",
  "sala": "Sala de aula",
  "auditorio": "Auditório",
  "reuniao": "Sala de reunião"
};

window.LABTECH.SEED_SALAS = [
  {"id":1,"codigo":"LAB-01","nome":"Laboratório de Informática 1","tipo":"laboratorio","bloco":"A","andar":1,"capacidade":30,"manutencao":false,"previsaoManutencao":"","recursos":["computadores","projetor","ar","quadro","wifi"],"qtd":{"computadores":30},"softwares":["VS Code","Python 3.12","Node 20","Git","Office"],"responsavel":"Téc. Rafael Nunes","localChave":"Balcão bloco A","descricao":"Laboratório padrão para disciplinas de programação e redes. Possui 30 estações com monitor duplo.","regras":["Proibido comer ou beber nas bancadas","Desligar as máquinas ao final da aula","Chave deve ser devolvida até 22h"],"ativo":true},
  {"id":2,"codigo":"LAB-02","nome":"Laboratório de Informática 2","tipo":"laboratorio","bloco":"A","andar":1,"capacidade":30,"manutencao":false,"previsaoManutencao":"","recursos":["computadores","projetor","ar","quadro","wifi"],"qtd":{"computadores":30},"softwares":["VS Code","Java 21","IntelliJ","MySQL Workbench"],"responsavel":"Téc. Rafael Nunes","localChave":"Balcão bloco A","descricao":"","regras":[],"ativo":true},
  {"id":3,"codigo":"LAB-03","nome":"Laboratório de Redes","tipo":"laboratorio","bloco":"A","andar":2,"capacidade":24,"manutencao":false,"previsaoManutencao":"","recursos":["computadores","rede","ar","quadro","wifi"],"qtd":{"computadores":24},"softwares":["Packet Tracer","Wireshark","GNS3"],"responsavel":"Téc. Carla Mendes","localChave":"Balcão bloco A","descricao":"","regras":[],"ativo":true},
  {"id":4,"codigo":"LAB-04","nome":"Laboratório de Química","tipo":"laboratorio","bloco":"B","andar":1,"capacidade":20,"manutencao":false,"previsaoManutencao":"","recursos":["bancadas","ar","quadro","acessivel"],"qtd":{"bancadas":10},"softwares":[],"responsavel":"Téc. Juliana Prado","localChave":"Coordenação bloco B","descricao":"Laboratório úmido com 10 bancadas duplas, capelas de exaustão e chuveiro de emergência.","regras":["Uso obrigatório de jaleco e óculos","Reservas apenas com docente responsável","Reagentes devem ser solicitados com 48h de antecedência"],"ativo":true},
  {"id":5,"codigo":"LAB-05","nome":"Laboratório de Física","tipo":"laboratorio","bloco":"B","andar":1,"capacidade":20,"manutencao":false,"previsaoManutencao":"","recursos":["bancadas","projetor","quadro"],"qtd":{"bancadas":8},"softwares":["Tracker"],"responsavel":"Téc. Juliana Prado","localChave":"Coordenação bloco B","descricao":"","regras":[],"ativo":true},
  {"id":6,"codigo":"LAB-06","nome":"Laboratório de Eletrônica","tipo":"laboratorio","bloco":"B","andar":2,"capacidade":16,"manutencao":false,"previsaoManutencao":"","recursos":["bancadas","computadores","ar","quadro"],"qtd":{"bancadas":8,"computadores":8},"softwares":["Proteus","Arduino IDE"],"responsavel":"Téc. Marcos Lima","localChave":"Coordenação bloco B","descricao":"","regras":[],"ativo":true},
  {"id":7,"codigo":"LAB-07","nome":"Laboratório Maker","tipo":"laboratorio","bloco":"B","andar":2,"capacidade":16,"manutencao":true,"previsaoManutencao":"Previsão em 7 dias","recursos":["bancadas","impressora3d","computadores","wifi"],"qtd":{"impressora3d":3,"computadores":6},"softwares":["Fusion 360","Cura"],"responsavel":"Téc. Marcos Lima","localChave":"Coordenação bloco B","descricao":"Em manutenção: troca de extrusoras das impressoras 3D e revisão elétrica das bancadas.","regras":[],"ativo":true},
  {"id":8,"codigo":"LAB-08","nome":"Laboratório de Anatomia","tipo":"laboratorio","bloco":"C","andar":1,"capacidade":25,"manutencao":false,"previsaoManutencao":"","recursos":["bancadas","ar","tv","acessivel"],"qtd":{"bancadas":12},"softwares":[],"responsavel":"Téc. Patrícia Rocha","localChave":"Balcão bloco C","descricao":"","regras":[],"ativo":true},
  {"id":9,"codigo":"LAB-09","nome":"Laboratório de Microbiologia","tipo":"laboratorio","bloco":"C","andar":1,"capacidade":20,"manutencao":false,"previsaoManutencao":"","recursos":["bancadas","ar","quadro"],"qtd":{"bancadas":10},"softwares":[],"responsavel":"Téc. Patrícia Rocha","localChave":"Balcão bloco C","descricao":"","regras":[],"ativo":true},
  {"id":10,"codigo":"LAB-10","nome":"Laboratório de Design","tipo":"laboratorio","bloco":"C","andar":2,"capacidade":22,"manutencao":false,"previsaoManutencao":"","recursos":["computadores","projetor","ar","wifi"],"qtd":{"computadores":22},"softwares":["Figma","Adobe CC","Blender"],"responsavel":"Téc. Carla Mendes","localChave":"Balcão bloco C","descricao":"","regras":[],"ativo":true},
  {"id":11,"codigo":"LAB-11","nome":"Laboratório de Jogos Digitais","tipo":"laboratorio","bloco":"C","andar":2,"capacidade":20,"manutencao":false,"previsaoManutencao":"","recursos":["computadores","projetor","ar","som","wifi"],"qtd":{"computadores":20},"softwares":["Unity","Unreal","Godot"],"responsavel":"Téc. Carla Mendes","localChave":"Balcão bloco C","descricao":"","regras":[],"ativo":true},
  {"id":12,"codigo":"LAB-12","nome":"Laboratório de Informática 3","tipo":"laboratorio","bloco":"A","andar":2,"capacidade":40,"manutencao":false,"previsaoManutencao":"","recursos":["computadores","projetor","ar","quadro","wifi","acessivel"],"qtd":{"computadores":40},"softwares":["VS Code","Python 3.12","PostgreSQL","Docker"],"responsavel":"Téc. Rafael Nunes","localChave":"Balcão bloco A","descricao":"","regras":[],"ativo":true},
  {"id":13,"codigo":"LAB-13","nome":"Laboratório de Enfermagem","tipo":"laboratorio","bloco":"D","andar":1,"capacidade":18,"manutencao":false,"previsaoManutencao":"","recursos":["bancadas","ar","tv","acessivel"],"qtd":{"bancadas":6},"softwares":[],"responsavel":"Téc. Patrícia Rocha","localChave":"Balcão bloco D","descricao":"","regras":[],"ativo":true},
  {"id":14,"codigo":"LAB-14","nome":"Laboratório de Nutrição","tipo":"laboratorio","bloco":"D","andar":1,"capacidade":18,"manutencao":false,"previsaoManutencao":"","recursos":["bancadas","ar"],"qtd":{"bancadas":6},"softwares":[],"responsavel":"Téc. Patrícia Rocha","localChave":"Balcão bloco D","descricao":"","regras":[],"ativo":true},
  {"id":15,"codigo":"LAB-15","nome":"Laboratório de Robótica","tipo":"laboratorio","bloco":"B","andar":3,"capacidade":16,"manutencao":true,"previsaoManutencao":"Previsão em 7 dias","recursos":["bancadas","computadores","impressora3d","wifi"],"qtd":{"bancadas":8,"computadores":8,"impressora3d":1},"softwares":["ROS","Arduino IDE"],"responsavel":"Téc. Marcos Lima","localChave":"Coordenação bloco B","descricao":"","regras":[],"ativo":true},
  {"id":16,"codigo":"SALA-201","nome":"Sala de Aula 201","tipo":"sala","bloco":"A","andar":2,"capacidade":50,"manutencao":false,"previsaoManutencao":"","recursos":["projetor","ar","quadro","wifi"],"qtd":{},"softwares":[],"responsavel":"Secretaria bloco A","localChave":"Secretaria bloco A","descricao":"","regras":[],"ativo":true},
  {"id":17,"codigo":"SALA-305","nome":"Sala de Aula 305","tipo":"sala","bloco":"A","andar":3,"capacidade":45,"manutencao":false,"previsaoManutencao":"","recursos":["projetor","quadro","wifi"],"qtd":{},"softwares":[],"responsavel":"Secretaria bloco A","localChave":"Secretaria bloco A","descricao":"","regras":[],"ativo":true},
  {"id":18,"codigo":"AUD-01","nome":"Auditório Principal","tipo":"auditorio","bloco":"C","andar":0,"capacidade":180,"manutencao":false,"previsaoManutencao":"","recursos":["projetor","som","ar","acessivel","wifi"],"qtd":{},"softwares":[],"responsavel":"Eventos","localChave":"Portaria principal","descricao":"","regras":[],"ativo":true},
  {"id":19,"codigo":"REU-02","nome":"Sala de Reunião 2","tipo":"reuniao","bloco":"D","andar":2,"capacidade":10,"manutencao":false,"previsaoManutencao":"","recursos":["tv","ar","wifi","quadro"],"qtd":{},"softwares":[],"responsavel":"Secretaria bloco D","localChave":"Secretaria bloco D","descricao":"","regras":[],"ativo":true},
  {"id":20,"codigo":"SALA-110","nome":"Sala de Aula 110","tipo":"sala","bloco":"D","andar":1,"capacidade":40,"manutencao":false,"previsaoManutencao":"","recursos":["projetor","quadro"],"qtd":{},"softwares":[],"responsavel":"Secretaria bloco D","localChave":"Secretaria bloco D","descricao":"","regras":[],"ativo":true}
];

/* Perfis do sistema (mesmos da tela de login) */
window.LABTECH.PERFIS = {
  student:  "Estudante / Usuário autorizado",
  employee: "Funcionário (controle de chaves)",
  admin:    "Administrador (gestão de cadastros)"
};

/* Usuários de demonstração. Senha de todos no modo mock: labtech */
window.LABTECH.SEED_USUARIOS = [
  { id: 1, nome: "Ana Costa",          email: "ana.costa@udf.edu.br",        matricula: "ADM-001",  perfil: "admin",    ativo: true },
  { id: 2, nome: "Rafael Nunes",       email: "rafael.nunes@udf.edu.br",     matricula: "FUN-014",  perfil: "employee", ativo: true },
  { id: 3, nome: "Juliana Prado",      email: "juliana.prado@udf.edu.br",    matricula: "FUN-022",  perfil: "employee", ativo: true },
  { id: 4, nome: "João Silva",         email: "joao.silva@udf.edu.br",       matricula: "20241001", perfil: "student",  ativo: true },
  { id: 5, nome: "Maria Oliveira",     email: "maria.oliveira@udf.edu.br",   matricula: "20241002", perfil: "student",  ativo: true },
  { id: 6, nome: "Carlos Souza",       email: "carlos.souza@udf.edu.br",     matricula: "20241003", perfil: "student",  ativo: true },
  { id: 7, nome: "Prof. Kerlla Luz",   email: "kerlla.luz@udf.edu.br",       matricula: "DOC-101",  perfil: "student",  ativo: true },
  { id: 8, nome: "Prof. Helena Castro",email: "helena.castro@udf.edu.br",    matricula: "DOC-102",  perfil: "student",  ativo: true },
  { id: 9, nome: "Pedro Lima",         email: "pedro.lima@udf.edu.br",       matricula: "20241004", perfil: "student",  ativo: false }
];

/* Gera chaves, reservas e empréstimos com datas relativas a hoje,
   para a demonstração sempre parecer "viva". Determinístico (sem Math.random). */
window.LABTECH.gerarSeed = function () {
  const L = window.LABTECH;
  const pad = (n) => String(n).padStart(2, "0");
  const dia = (offset) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const agoraMenos = (min) => new Date(Date.now() - min * 60000).toISOString();

  const salas = L.SEED_SALAS.map((s) => ({ ...s }));
  const usuarios = L.SEED_USUARIOS.map((u) => ({ ...u }));

  // Uma chave por sala (duas nos labs de informática)
  const chaves = [];
  salas.forEach((s) => {
    chaves.push({ id: chaves.length + 1, codigo: `CH-${s.codigo}`, sala_id: s.id, local: s.localChave, ativo: !s.manutencao, observacao: s.manutencao ? "Sala em manutenção" : "" });
    if (s.codigo === "LAB-01" || s.codigo === "LAB-12") chaves.push({ id: chaves.length + 1, codigo: `CH-${s.codigo}-R`, sala_id: s.id, local: s.localChave, ativo: true, observacao: "Cópia reserva" });
  });

  // Reservas: padrões fixos por sala, de 7 dias atrás até 14 dias à frente
  const finalidades = ["Aula prática", "Estudo em grupo", "Monitoria", "LabTech - Squad 1", "Projeto integrador", "Banco de Dados II", "Programação Web", "Reunião de equipe"];
  const horarios = [["08:00", "10:00"], ["10:00", "12:00"], ["14:00", "16:00"], ["16:00", "18:00"], ["19:00", "21:00"], ["19:00", "22:00"]];
  const reservas = [];
  salas.forEach((s, i) => {
    if (s.manutencao) return;
    for (let off = -7; off <= 14; off++) {
      const d = new Date(); d.setDate(d.getDate() + off);
      if (d.getDay() === 0) continue; // domingo fechado
      const h = (i * 3 + off * 5 + 100) % 7;
      if (h >= horarios.length) continue; // alguns dias livres
      const [inicio, fim] = horarios[h];
      const usuario = usuarios[(i + off + 70) % usuarios.length];
      reservas.push({
        id: reservas.length + 1, sala_id: s.id, usuario_id: usuario.id, data: dia(off), inicio, fim,
        finalidade: finalidades[(i + off + 80) % finalidades.length], participantes: Math.min(s.capacidade, 5 + ((i + off + 50) % 20)),
        status: off < 0 ? "confirmada" : ((i + off) % 9 === 0 ? "cancelada" : "confirmada"), criada_em: agoraMenos(60 * 24 * 10)
      });
    }
  });

  // Reservas do estudante de demonstração (João Silva, id 4) para "Minhas reservas"
  [[1, 1, "14:00", "16:00", "Estudo para a prova de Algoritmos"], [19, 2, "10:00", "11:00", "Reunião do projeto integrador"], [12, -3, "19:00", "21:00", "LabTech - Squad 1"]]
    .forEach(([sala_id, off, inicio, fim, finalidade]) => {
      reservas.push({ id: reservas.length + 1, sala_id, usuario_id: 4, data: dia(off), inicio, fim, finalidade, participantes: 4, status: "confirmada", criada_em: agoraMenos(60 * 24 * 2) });
    });

  // Empréstimos: histórico já devolvido + alguns ativos agora
  const emprestimos = [];
  const registrar = (chave_id, usuario_id, retiradaMin, devolvidaMin) => emprestimos.push({
    id: emprestimos.length + 1, chave_id, usuario_id, registrado_por: 2,
    retirada_em: agoraMenos(retiradaMin), devolvida_em: devolvidaMin == null ? null : agoraMenos(devolvidaMin)
  });
  chaves.forEach((c, i) => {
    if (!c.ativo) return;
    registrar(c.id, usuarios[(i + 3) % 8].id, 60 * 24 * 3 + i * 7, 60 * 24 * 3 + i * 7 - 120);
    registrar(c.id, usuarios[(i + 5) % 8].id, 60 * 24 + i * 5, 60 * 24 + i * 5 - 180);
  });
  [2, 4, 7, 10, 18, 21].forEach((chave_id, i) => {
    const c = chaves.find((k) => k.id === chave_id);
    if (c && c.ativo) registrar(chave_id, usuarios[[3, 6, 4, 7, 5, 3][i]].id, i === 0 ? 300 : 30 + i * 25, null); // o primeiro passa de 4h (alerta)
  });

  return { versao: 2, salas, usuarios, chaves, reservas, emprestimos, criado_em: new Date().toISOString() };
};
