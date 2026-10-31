/* Dados e comportamento compartilhados. Reservas salvas localmente. */
const Lab = (() => {
  const rooms = [
    {id:'lab-01',name:'Laboratório de Informática',type:'Laboratório',block:'Bloco A · Sala 101',capacity:30,features:['Computadores','Projetor','Wi-Fi'],symbol:'fa-flask',bg:'#e8f1fa',ink:'#0055a0'},
    {id:'study-01',name:'Sala de Estudo Coletivo',type:'Sala de estudo',block:'Bloco B · Sala 203',capacity:12,features:['Quadro branco','Wi-Fi','Ar-condicionado'],symbol:'fa-book-open',bg:'#fff4cc',ink:'#775b00'},
    {id:'meeting-01',name:'Sala de Reunião',type:'Sala de reunião',block:'Bloco A · Sala 105',capacity:10,features:['TV','Videoconferência','Wi-Fi'],symbol:'fa-users',bg:'#eef2f7',ink:'#12284b'},
    {id:'lab-02',name:'Laboratório Multimídia',type:'Laboratório',block:'Bloco C · Sala 302',capacity:20,features:['Computadores','Áudio e vídeo','Wi-Fi'],symbol:'fa-desktop',bg:'#e8f1fa',ink:'#0055a0'},
    {id:'study-02',name:'Sala de Estudos Ampliada',type:'Sala de estudo',block:'Bloco B · Sala 204',capacity:24,features:['Mesas coletivas','Quadro branco','Wi-Fi'],symbol:'fa-book-open',bg:'#fff4cc',ink:'#775b00'},
    {id:'meeting-02',name:'Sala de Projetos',type:'Sala de reunião',block:'Bloco C · Sala 301',capacity:16,features:['Projetor','Quadro branco','Wi-Fi'],symbol:'fa-users',bg:'#eef2f7',ink:'#12284b'}
  ];
  const key='labreserva.reservations';
  let storageError=false;
  function read(){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(r=>r&&rooms.some(room=>room.id===r.roomId)&&typeof r.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&/^\d{2}:\d{2}$/.test(r.start)&&/^\d{2}:\d{2}$/.test(r.end)&&typeof r.purpose==='string'&&['confirmed','cancelled'].includes(r.status)):[];}catch{storageError=true;return [];}}
  function save(value){if(storageError)throw new Error('Não foi possível ler suas reservas. Verifique o armazenamento do navegador.');localStorage.setItem(key,JSON.stringify(value));}
  function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function notify(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.hidden=true,5000);}
  function status(r){return r.status==='cancelled'?'cancelled':new Date(`${r.date}T${r.end}`)<=new Date()?'past':'upcoming';}
  function applyTheme(theme){document.documentElement.dataset.theme=theme;const dark=theme==='dark';document.querySelector('#theme-toggle').setAttribute('aria-pressed',String(dark));document.querySelector('#theme-icon').innerHTML=`<i class="fa-solid ${dark?'fa-sun':'fa-moon'}" aria-hidden="true"></i>`;document.querySelector('#theme-label').textContent=dark?'Ativar tema claro':'Ativar tema escuro';}
  let theme='light';try{theme=localStorage.getItem('labreserva.theme')==='dark'?'dark':'light';}catch{}applyTheme(theme);
  document.querySelector('#theme-toggle').addEventListener('click',()=>{theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(theme);try{localStorage.setItem('labreserva.theme',theme);}catch{notify('Tema alterado. Não foi possível salvar sua preferência.');}});
  document.querySelector('#today-label').textContent=new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'short',year:'numeric'});
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}}));
  return {rooms,read,save,localDate,escape,notify,status};
})();
