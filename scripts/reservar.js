const grid=document.querySelector('#room-grid');
const search=document.querySelector('#search');
const typeFilter=document.querySelector('#type-filter');
const capacityFilter=document.querySelector('#capacity-filter');
const dialog=document.querySelector('#booking-dialog');
const form=document.querySelector('#booking-form');
let selectedRoom=null;
function renderRooms(){
 const query=search.value.trim().toLocaleLowerCase('pt-BR');
 const rooms=Lab.rooms.filter(r=>(r.name+' '+r.block).toLocaleLowerCase('pt-BR').includes(query)&&(typeFilter.value==='all'||r.type===typeFilter.value)&&r.capacity>=Number(capacityFilter.value));
 document.querySelector('#room-count').textContent=`${rooms.length} ${rooms.length===1?'espaço encontrado':'espaços encontrados'} no campus`;
 grid.innerHTML=rooms.length?rooms.map(r=>`<article class="room-card"><div class="room-visual" style="--room-bg:${r.bg};--room-ink:${r.ink}"><span class="room-tag">Espaço do campus</span><span class="space-symbol" aria-hidden="true"><i class="fa-solid ${r.symbol}"></i></span><span class="room-number">${r.id.toUpperCase()}</span></div><div class="room-body"><span class="room-type">${r.type}</span><h3>${r.name}</h3><div class="room-meta"><span><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${r.block}</span><span><i class="fa-solid fa-users" aria-hidden="true"></i> Até ${r.capacity} pessoas</span></div><div class="features">${r.features.map(f=>`<span>${f}</span>`).join('')}</div><button class="book-button" data-room="${r.id}">Reservar sala <span aria-hidden="true"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span></button></div></article>`).join(''):'<div class="empty-state"><h3>Nenhum espaço encontrado</h3><p>Tente outro nome ou ajuste os filtros.</p></div>';
}
[search,typeFilter,capacityFilter].forEach(el=>el.addEventListener('input',renderRooms));
grid.addEventListener('click',event=>{const button=event.target.closest('[data-room]');if(!button)return;selectedRoom=Lab.rooms.find(r=>r.id===button.dataset.room);form.reset();document.querySelector('#booking-error').textContent='';document.querySelector('#booking-title').textContent=selectedRoom.name;document.querySelector('#booking-description').textContent=`${selectedRoom.block} · Até ${selectedRoom.capacity} pessoas`;const date=document.querySelector('#booking-date');date.min=Lab.localDate();date.value=Lab.localDate();document.querySelector('#participants').max=selectedRoom.capacity;dialog.showModal();});
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());
form.addEventListener('submit',event=>{
 event.preventDefault();const date=document.querySelector('#booking-date').value;const start=document.querySelector('#start-time').value;const end=document.querySelector('#end-time').value;const purpose=document.querySelector('#purpose').value.trim();const participants=Number(document.querySelector('#participants').value);const error=document.querySelector('#booking-error');error.textContent='';
 if(!selectedRoom)return;
 if(!purpose){error.textContent='Informe a finalidade da reserva.';return;}
 if(!Number.isInteger(participants)||participants<1||participants>selectedRoom.capacity){error.textContent='Confira a quantidade de participantes.';return;}
 if(date<Lab.localDate()||new Date(`${date}T${start}`)<=new Date()){error.textContent='Escolha uma data e horário futuros.';return;}
 if(start<'07:00'||end>'22:00'||start>=end){error.textContent='O término deve ser após o início, entre 7h e 22h.';return;}
 const reservations=Lab.read();if(reservations.some(r=>r.roomId===selectedRoom.id&&r.date===date&&r.status!=='cancelled'&&start<r.end&&end>r.start)){error.textContent='Esta sala já está reservada nesse período. Escolha outro horário.';return;}
 const reservation={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,roomId:selectedRoom.id,date,start,end,purpose,participants,status:'confirmed'};
 try{Lab.save([...reservations,reservation]);dialog.close();Lab.notify('Reserva confirmada! Consulte os detalhes em Minhas reservas.');}catch{error.textContent='Não foi possível salvar a reserva. Verifique se o navegador permite armazenamento local.';}
});
renderRooms();
