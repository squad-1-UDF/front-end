/* ============================================================
   Dados fictícios para o front funcionar sem back-end.
   Quando o Django existir, isto vira o context das views
   (ex.: {{ salas|json_script:"salas-data" }}) ou chamadas à API.
   Mantido em .js (e não .json) para abrir direto via file:// .
   ============================================================ */

window.LABTECH = window.LABTECH || {};

// Catálogo de recursos (ícone Font Awesome + rótulo)
window.LABTECH.RECURSOS = {
  computadores: { icon: "fa-solid fa-computer",      label: "Computadores" },
  projetor:     { icon: "fa-solid fa-video",         label: "Projetor" },
  ar:           { icon: "fa-regular fa-snowflake",   label: "Ar-condicionado" },
  quadro:       { icon: "fa-solid fa-chalkboard",    label: "Quadro branco" },
  bancadas:     { icon: "fa-solid fa-vial",          label: "Bancadas" },
  wifi:         { icon: "fa-solid fa-wifi",          label: "Wi-Fi" },
  tv:           { icon: "fa-solid fa-tv",            label: "TV" },
  som:          { icon: "fa-solid fa-volume-high",   label: "Sistema de som" },
  acessivel:    { icon: "fa-solid fa-wheelchair",    label: "Acessível" },
  impressora3d: { icon: "fa-solid fa-cube",          label: "Impressora 3D" },
  rede:         { icon: "fa-solid fa-network-wired", label: "Rack de rede" }
};

window.LABTECH.TIPOS = {
  laboratorio: "Laboratório",
  sala:        "Sala de aula",
  auditorio:   "Auditório",
  reuniao:     "Sala de reunião"
};

window.LABTECH.STATUS = {
  available:   "Livre",
  occupied:    "Ocupado",
  maintenance: "Manutenção",
  reserved:    "Reservado"
};

// status: available | occupied | maintenance
// chave: { local, status: "disponivel" | "retirada" | "nao_aplica" }
window.LABTECH.SALAS = [
  { id: 1,  codigo: "LAB-01", nome: "Laboratório de Informática 1", tipo: "laboratorio", bloco: "A", andar: 1, capacidade: 30, status: "available",
    recursos: ["computadores", "projetor", "ar", "quadro", "wifi"], qtd: { computadores: 30 }, softwares: ["VS Code", "Python 3.12", "Node 20", "Git", "Office"],
    responsavel: "Téc. Rafael Nunes", proximoLivre: "Agora", chave: { local: "Balcão bloco A", status: "disponivel" },
    descricao: "Laboratório padrão para disciplinas de programação e redes. Possui 30 estações com monitor duplo.",
    regras: ["Proibido comer ou beber nas bancadas", "Desligar as máquinas ao final da aula", "Chave deve ser devolvida até 22h"] },
  { id: 2,  codigo: "LAB-02", nome: "Laboratório de Informática 2", tipo: "laboratorio", bloco: "A", andar: 1, capacidade: 30, status: "occupied",
    recursos: ["computadores", "projetor", "ar", "quadro", "wifi"], qtd: { computadores: 30 }, softwares: ["VS Code", "Java 21", "IntelliJ", "MySQL Workbench"],
    responsavel: "Téc. Rafael Nunes", proximoLivre: "Hoje, 16:00", chave: { local: "Balcão bloco A", status: "retirada" } },
  { id: 3,  codigo: "LAB-03", nome: "Laboratório de Redes", tipo: "laboratorio", bloco: "A", andar: 2, capacidade: 24, status: "occupied",
    recursos: ["computadores", "rede", "ar", "quadro", "wifi"], qtd: { computadores: 24 }, softwares: ["Packet Tracer", "Wireshark", "GNS3"],
    responsavel: "Téc. Carla Mendes", proximoLivre: "Hoje, 18:30", chave: { local: "Balcão bloco A", status: "retirada" } },
  { id: 4,  codigo: "LAB-04", nome: "Laboratório de Química", tipo: "laboratorio", bloco: "B", andar: 1, capacidade: 20, status: "available",
    recursos: ["bancadas", "ar", "quadro", "acessivel"], qtd: { bancadas: 10 }, softwares: [],
    responsavel: "Téc. Juliana Prado", proximoLivre: "Agora", chave: { local: "Coordenação bloco B", status: "disponivel" },
    descricao: "Laboratório úmido com 10 bancadas duplas, capelas de exaustão e chuveiro de emergência.",
    regras: ["Uso obrigatório de jaleco e óculos", "Reservas apenas com docente responsável", "Reagentes devem ser solicitados com 48h de antecedência"] },
  { id: 5,  codigo: "LAB-05", nome: "Laboratório de Física", tipo: "laboratorio", bloco: "B", andar: 1, capacidade: 20, status: "occupied",
    recursos: ["bancadas", "projetor", "quadro"], qtd: { bancadas: 8 }, softwares: ["Tracker"],
    responsavel: "Téc. Juliana Prado", proximoLivre: "Hoje, 20:00", chave: { local: "Coordenação bloco B", status: "retirada" } },
  { id: 6,  codigo: "LAB-06", nome: "Laboratório de Eletrônica", tipo: "laboratorio", bloco: "B", andar: 2, capacidade: 16, status: "occupied",
    recursos: ["bancadas", "computadores", "ar", "quadro"], qtd: { bancadas: 8, computadores: 8 }, softwares: ["Proteus", "Arduino IDE"],
    responsavel: "Téc. Marcos Lima", proximoLivre: "Amanhã, 08:00", chave: { local: "Coordenação bloco B", status: "retirada" } },
  { id: 7,  codigo: "LAB-07", nome: "Laboratório Maker", tipo: "laboratorio", bloco: "B", andar: 2, capacidade: 16, status: "maintenance",
    recursos: ["bancadas", "impressora3d", "computadores", "wifi"], qtd: { impressora3d: 3, computadores: 6 }, softwares: ["Fusion 360", "Cura"],
    responsavel: "Téc. Marcos Lima", proximoLivre: "Previsão 20/10", chave: { local: "Coordenação bloco B", status: "nao_aplica" },
    descricao: "Em manutenção: troca de extrusoras das impressoras 3D e revisão elétrica das bancadas." },
  { id: 8,  codigo: "LAB-08", nome: "Laboratório de Anatomia", tipo: "laboratorio", bloco: "C", andar: 1, capacidade: 25, status: "occupied",
    recursos: ["bancadas", "ar", "tv", "acessivel"], qtd: { bancadas: 12 }, softwares: [],
    responsavel: "Téc. Patrícia Rocha", proximoLivre: "Hoje, 17:00", chave: { local: "Balcão bloco C", status: "retirada" } },
  { id: 9,  codigo: "LAB-09", nome: "Laboratório de Microbiologia", tipo: "laboratorio", bloco: "C", andar: 1, capacidade: 20, status: "occupied",
    recursos: ["bancadas", "ar", "quadro"], qtd: { bancadas: 10 }, softwares: [],
    responsavel: "Téc. Patrícia Rocha", proximoLivre: "Amanhã, 10:00", chave: { local: "Balcão bloco C", status: "retirada" } },
  { id: 10, codigo: "LAB-10", nome: "Laboratório de Design", tipo: "laboratorio", bloco: "C", andar: 2, capacidade: 22, status: "occupied",
    recursos: ["computadores", "projetor", "ar", "wifi"], qtd: { computadores: 22 }, softwares: ["Figma", "Adobe CC", "Blender"],
    responsavel: "Téc. Carla Mendes", proximoLivre: "Hoje, 19:00", chave: { local: "Balcão bloco C", status: "retirada" } },
  { id: 11, codigo: "LAB-11", nome: "Laboratório de Jogos Digitais", tipo: "laboratorio", bloco: "C", andar: 2, capacidade: 20, status: "occupied",
    recursos: ["computadores", "projetor", "ar", "som", "wifi"], qtd: { computadores: 20 }, softwares: ["Unity", "Unreal", "Godot"],
    responsavel: "Téc. Carla Mendes", proximoLivre: "Amanhã, 08:00", chave: { local: "Balcão bloco C", status: "retirada" } },
  { id: 12, codigo: "LAB-12", nome: "Laboratório de Informática 3", tipo: "laboratorio", bloco: "A", andar: 2, capacidade: 40, status: "available",
    recursos: ["computadores", "projetor", "ar", "quadro", "wifi", "acessivel"], qtd: { computadores: 40 }, softwares: ["VS Code", "Python 3.12", "PostgreSQL", "Docker"],
    responsavel: "Téc. Rafael Nunes", proximoLivre: "Agora", chave: { local: "Balcão bloco A", status: "disponivel" } },
  { id: 13, codigo: "LAB-13", nome: "Laboratório de Enfermagem", tipo: "laboratorio", bloco: "D", andar: 1, capacidade: 18, status: "occupied",
    recursos: ["bancadas", "ar", "tv", "acessivel"], qtd: { bancadas: 6 }, softwares: [],
    responsavel: "Téc. Patrícia Rocha", proximoLivre: "Hoje, 21:00", chave: { local: "Balcão bloco D", status: "retirada" } },
  { id: 14, codigo: "LAB-14", nome: "Laboratório de Nutrição", tipo: "laboratorio", bloco: "D", andar: 1, capacidade: 18, status: "occupied",
    recursos: ["bancadas", "ar"], qtd: { bancadas: 6 }, softwares: [],
    responsavel: "Téc. Patrícia Rocha", proximoLivre: "Amanhã, 14:00", chave: { local: "Balcão bloco D", status: "retirada" } },
  { id: 15, codigo: "LAB-15", nome: "Laboratório de Robótica", tipo: "laboratorio", bloco: "B", andar: 3, capacidade: 16, status: "maintenance",
    recursos: ["bancadas", "computadores", "impressora3d", "wifi"], qtd: { bancadas: 8, computadores: 8, impressora3d: 1 }, softwares: ["ROS", "Arduino IDE"],
    responsavel: "Téc. Marcos Lima", proximoLivre: "Previsão 17/10", chave: { local: "Coordenação bloco B", status: "nao_aplica" } },
  { id: 16, codigo: "SALA-201", nome: "Sala de Aula 201", tipo: "sala", bloco: "A", andar: 2, capacidade: 50, status: "occupied",
    recursos: ["projetor", "ar", "quadro", "wifi"], qtd: {}, softwares: [],
    responsavel: "Secretaria bloco A", proximoLivre: "Hoje, 18:00", chave: { local: "Secretaria bloco A", status: "retirada" } },
  { id: 17, codigo: "SALA-305", nome: "Sala de Aula 305", tipo: "sala", bloco: "A", andar: 3, capacidade: 45, status: "occupied",
    recursos: ["projetor", "quadro", "wifi"], qtd: {}, softwares: [],
    responsavel: "Secretaria bloco A", proximoLivre: "Hoje, 20:30", chave: { local: "Secretaria bloco A", status: "retirada" } },
  { id: 18, codigo: "AUD-01", nome: "Auditório Principal", tipo: "auditorio", bloco: "C", andar: 0, capacidade: 180, status: "occupied",
    recursos: ["projetor", "som", "ar", "acessivel", "wifi"], qtd: {}, softwares: [],
    responsavel: "Eventos", proximoLivre: "Amanhã, 08:00", chave: { local: "Portaria principal", status: "retirada" } },
  { id: 19, codigo: "REU-02", nome: "Sala de Reunião 2", tipo: "reuniao", bloco: "D", andar: 2, capacidade: 10, status: "available",
    recursos: ["tv", "ar", "wifi", "quadro"], qtd: {}, softwares: [],
    responsavel: "Secretaria bloco D", proximoLivre: "Agora", chave: { local: "Secretaria bloco D", status: "disponivel" } },
  { id: 20, codigo: "SALA-110", nome: "Sala de Aula 110", tipo: "sala", bloco: "D", andar: 1, capacidade: 40, status: "occupied",
    recursos: ["projetor", "quadro"], qtd: {}, softwares: [],
    responsavel: "Secretaria bloco D", proximoLivre: "Hoje, 22:00", chave: { local: "Secretaria bloco D", status: "retirada" } }
];

// Reservas futuras por sala (usado na tela de detalhes)
window.LABTECH.RESERVAS = {
  1: [
    { data: "2026-10-13", inicio: "19:00", fim: "22:00", solicitante: "Prof. Kerlla Luz",     finalidade: "LabTech - Squad 1",         status: "confirmada" },
    { data: "2026-10-14", inicio: "08:00", fim: "10:00", solicitante: "Prof. André Souza",    finalidade: "Programação Web",           status: "confirmada" },
    { data: "2026-10-15", inicio: "14:00", fim: "16:00", solicitante: "João Gabriel Leal",    finalidade: "Estudo em grupo",           status: "pendente" },
    { data: "2026-10-16", inicio: "19:00", fim: "21:00", solicitante: "Prof. Danrley Silva",  finalidade: "Banco de Dados II",         status: "confirmada" }
  ],
  4: [
    { data: "2026-10-13", inicio: "14:00", fim: "16:00", solicitante: "Prof. Helena Castro", finalidade: "Química Geral - prática 3", status: "confirmada" },
    { data: "2026-10-15", inicio: "08:00", fim: "11:00", solicitante: "Prof. Helena Castro", finalidade: "Química Orgânica",          status: "confirmada" },
    { data: "2026-10-17", inicio: "10:00", fim: "12:00", solicitante: "Prof. Rodrigo Alves", finalidade: "Monitoria",                 status: "pendente" }
  ],
  12: [
    { data: "2026-10-14", inicio: "19:00", fim: "22:00", solicitante: "Prof. Kerlla Luz",    finalidade: "LabTech - Squad 3",         status: "confirmada" }
  ]
};

// Grade semanal fictícia (seg..sáb, 7h-22h). Gerada de forma determinística
// a partir do id para a demo ter variedade sem precisar escrever tudo à mão.
window.LABTECH.gradeSemanal = function (sala, offsetSemana) {
  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const horas = []; for (let h = 7; h < 22; h++) horas.push(h);
  const seed = sala.id * 7919 + (offsetSemana || 0) * 104729;
  const rnd = (i) => { const x = Math.sin(seed + i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const grade = {};
  dias.forEach((d, di) => {
    grade[d] = {};
    horas.forEach((h, hi) => {
      let s = "available";
      if (sala.status === "maintenance") { s = "maintenance"; }
      else {
        const r = rnd(di * 100 + hi);
        if (d === "Sáb" && h >= 13) s = "occupied";              // sábado à tarde fechado
        else if (r < 0.42) s = "occupied";
        else if (r < 0.50) s = "reserved";
      }
      grade[d][h] = s;
    });
  });
  return { dias, horas, grade };
};
