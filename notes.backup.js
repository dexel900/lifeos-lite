// modules/notes/notes.js
let notes = [];
let currentId = null;

const listEl   = document.getElementById('list');
const titleEl  = document.getElementById('title');
const editorEl = document.getElementById('editor');
const saveBtn  = document.getElementById('saveBtn');
const newBtn   = document.getElementById('newBtn');
const searchEl = document.getElementById('search');
const statusEl = document.getElementById('status');
const deleteBtn= document.getElementById('deleteBtn');

function setEditable(on){ if(titleEl&&editorEl){ titleEl.disabled=!on; editorEl.disabled=!on; } }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

function renderList(filter=''){
  if(!listEl) return;
  listEl.innerHTML='';
  const q = filter.trim().toLowerCase();
  const items = notes
    .slice()
    .sort((a,b)=>b.updatedAt - a.updatedAt)
    .filter(n=>!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  for(const n of items){
    const div = document.createElement('div');
    div.className = 'item' + (n.id===currentId ? ' active':'');
    div.innerHTML = `<div><strong>${n.title || 'Unbenannt'}</strong></div>
                     <div class="muted" style="font-size:12px">${new Date(n.updatedAt).toLocaleString()}</div>`;
    div.onclick = ()=>openNote(n.id);
    listEl.appendChild(div);
  }
}

function openNote(id){
  const n = notes.find(x=>x.id===id);
  if(!n) return;
  currentId = id;
  titleEl.value = n.title || '';
  editorEl.value = n.content || '';
  renderList(searchEl.value);
  setEditable(true);
}

async function load(){
  try { notes = await window.lifeos.loadNotes(); }
  catch (e) { console.error('loadNotes error', e); notes=[]; }
  renderList();
  if(notes[0]) openNote(notes[0].id);
  setEditable(true);
}

async function save(){
  const now = Date.now();
  if(!currentId){
    currentId = uid();
    notes.push({ id: currentId, title: titleEl.value || 'Unbenannt', content: editorEl.value || '', createdAt: now, updatedAt: now });
  } else {
    const n = notes.find(x=>x.id===currentId);
    if(n){ n.title = titleEl.value || 'Unbenannt'; n.content = editorEl.value || ''; n.updatedAt = now; }
  }
  try{
    await window.lifeos.saveNotes(notes);
    statusEl.textContent = 'Gespeichert'; setTimeout(()=>statusEl.textContent='', 1200);
    renderList(searchEl.value);
  }catch(e){ alert('Fehler beim Speichern: ' + (e?.message||e)); }
}

async function deleteCurrent(){
  if(!currentId) return;
  const n = notes.find(x=>x.id===currentId);
  const title = n?.title || 'Unbenannt';
  if(!confirm(`„${title}“ wirklich löschen?`)) return;

  notes = notes.filter(x=>x.id!==currentId);
  currentId = null;
  titleEl.value=''; editorEl.value='';

  try{
    await window.lifeos.saveNotes(notes);
    statusEl.textContent='Gelöscht'; setTimeout(()=>statusEl.textContent='',1200);
    renderList(searchEl.value);
    if(notes[0]) openNote(notes[0].id); else { setEditable(true); }
  }catch(e){ alert('Fehler beim Löschen: ' + (e?.message||e)); }
}

// Events
if(newBtn) newBtn.onclick = ()=>{ currentId=null; titleEl.value=''; editorEl.value=''; setEditable(true); titleEl.focus(); };
if(saveBtn) saveBtn.onclick = save;
if(deleteBtn) deleteBtn.onclick = deleteCurrent;
document.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ e.preventDefault(); save(); }});
if(searchEl) searchEl.addEventListener('input', ()=>renderList(searchEl.value));

// Start nur, wenn Notes-View im DOM existiert
if(listEl) load();
