// modules/notes/notes.js

// ---------- State ----------
let notes = [];
let currentId = null;           // aktuell geöffnete Note ODER Ordner
let currentFolderId = null;     // Kontext: Welcher Ordner ist offen? (null = Wurzel)

const listEl     = document.getElementById('list');
const titleEl    = document.getElementById('title');
const editorEl   = document.getElementById('editor');
const saveBtn    = document.getElementById('saveBtn');
const newBtn     = document.getElementById('newBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const searchEl   = document.getElementById('search');
const statusEl   = document.getElementById('status');
const deleteBtn  = document.getElementById('deleteBtn');
const crumbsEl   = document.getElementById('crumbs');

// ---------- Utils / Schema ----------
function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function setEditable(on){ if(titleEl && editorEl){ titleEl.disabled=!on; editorEl.disabled=!on; } }

function toNote(item){
  if(!item.type) item.type = 'note';
  if(typeof item.parentId === 'undefined') item.parentId = null;
  if(typeof item.pinned === 'undefined') item.pinned = false;
  if(typeof item.createdAt === 'undefined') item.createdAt = Date.now();
  if(typeof item.updatedAt === 'undefined') item.updatedAt = Date.now();
  if(item.type === 'folder') delete item.content;
  return item;
}

function createNote({ title='', content='', parentId=null } = {}){
  const now = Date.now();
  return { id: uid(), type:'note', title: title || 'Unbenannt', content: content || '', parentId, pinned:false, createdAt:now, updatedAt:now };
}
function createFolder({ title='', parentId=null } = {}){
  const now = Date.now();
  return { id: uid(), type:'folder', title: title || 'Neuer Ordner', parentId, pinned:false, createdAt:now, updatedAt:now };
}

function getById(id){ return notes.find(n=>n.id===id); }
function childrenOf(pid){ return notes.filter(n=>n.parentId === pid); }
function pathTo(id){
  const chain = [];
  let cur = getById(id);
  while(cur){
    chain.unshift(cur);
    cur = cur.parentId ? getById(cur.parentId) : null;
  }
  return chain;
}

// ---------- Rendering ----------
function renderBreadcrumb(){
  if(!crumbsEl) return;
  crumbsEl.innerHTML = '';
  // Wurzel
  const rootLink = document.createElement('span');
  rootLink.className = 'link';
  rootLink.textContent = 'Wurzel';
  rootLink.onclick = ()=> navigateTo(null);
  crumbsEl.appendChild(rootLink);

  if(!currentFolderId) return;

  const chain = pathTo(currentFolderId);
  for(const f of chain){
    const sep = document.createElement('span'); sep.className='sep'; sep.textContent='›';
    crumbsEl.appendChild(sep);
    const link = document.createElement('span');
    link.className='link';
    link.textContent = f.title || 'Ordner';
    link.onclick = ()=> navigateTo(f.id);
    crumbsEl.appendChild(link);
  }
}

function renderList(filter=''){
  if(!listEl) return;
  listEl.innerHTML = '';

  const q = filter.trim().toLowerCase();
  // nur Inhalte des aktuellen Ordners
  const items = childrenOf(currentFolderId)
    .filter(n => !q || (n.title||'').toLowerCase().includes(q) || (n.content||'').toLowerCase().includes(q))
    .sort((a,b)=>{
      // Ordner zuerst
      if(a.type!==b.type) return a.type==='folder' ? -1 : 1;
      return (b.updatedAt||0) - (a.updatedAt||0);
    });

  for(const n of items){
    const div = document.createElement('div');
    div.className = 'item' + (n.id===currentId ? ' active':'') + (n.type==='folder' ? ' folder' : '');
    const subtitle = new Date(n.updatedAt).toLocaleString();
    div.innerHTML = `<div><strong>${n.title || (n.type==='folder'?'Ordner':'Unbenannt')}</strong></div>
                     <div class="muted" style="font-size:12px">${subtitle}</div>`;
    div.onclick = ()=> {
      if(n.type === 'folder') openFolder(n.id);
      else openNote(n.id);
    };
    listEl.appendChild(div);
  }
  renderBreadcrumb();
}

function openNote(id){
  const n = getById(id);
  if(!n || n.type!=='note') return;
  currentId = id;
  titleEl.value = n.title || '';
  editorEl.value = n.content || '';
  setEditable(true);
  renderList(searchEl.value);
}

function openFolder(id){
  // in Ordner navigieren
  currentFolderId = id;
  currentId = id; // Auswahl im Baum
  // Editor leeren/disable (wir bearbeiten Ordner nicht im Editor)
  titleEl.value = '';
  editorEl.value = '';
  setEditable(false);
  renderList(searchEl.value);
}

// Navigation über Breadcrumb
function navigateTo(folderId){
  currentFolderId = folderId;
  currentId = folderId;
  titleEl.value = '';
  editorEl.value = '';
  setEditable(false);
  renderList(searchEl.value);
}

// ---------- Load / Save / Delete ----------
async function load(){
  try{
    const raw = await window.lifeos.loadNotes();
    notes = (Array.isArray(raw) ? raw : []).map(toNote);
  }catch(e){
    console.error('loadNotes error', e);
    notes = [];
  }
  currentFolderId = null; // starte in der Wurzel
  renderList();
  // falls es in der Wurzel Notes gibt, eine öffnen
  const firstNote = childrenOf(currentFolderId).find(n=>n.type==='note');
  if(firstNote) openNote(firstNote.id); else { setEditable(false); }
}

async function save(){
  const now = Date.now();

  // wenn aktuell ein Ordner ausgewählt war, erstellen wir eine neue Note in diesem Ordner
  if(!currentId || (getById(currentId) && getById(currentId).type==='folder')){
    const n = createNote({
      title: titleEl.value,
      content: editorEl.value,
      parentId: currentFolderId
    });
    notes.push(n);
    currentId = n.id;
  } else {
    const n = getById(currentId);
    if(n){
      if(n.type==='note'){
        n.title = titleEl.value || 'Unbenannt';
        n.content = editorEl.value || '';
      } else if(n.type==='folder'){
        // Ordner: Titel aus dem Editor nicht übernehmen (Editor ist disabled)
      }
      n.updatedAt = now;
    }
  }

  try{
    await window.lifeos.saveNotes(notes);
    statusEl.textContent = 'Gespeichert';
    setTimeout(()=>statusEl.textContent='',1200);
    renderList(searchEl.value);
  }catch(e){ alert('Fehler beim Speichern: ' + (e?.message||e)); }
}

async function deleteCurrent(){
  if(!currentId) return;
  const cur = getById(currentId);
  if(!cur) return;

  if(cur.type === 'folder'){
    const kids = childrenOf(cur.id);
    if(kids.length){
      alert(`Ordner ist nicht leer (${kids.length} Elemente). Bitte Inhalte zuerst verschieben/entfernen.`);
      return;
    }
  }

  const title = cur.title || (cur.type==='folder' ? 'Ordner' : 'Unbenannt');
  if(!confirm(`„${title}“ wirklich löschen?`)) return;

  notes = notes.filter(x=>x.id !== cur.id);
  currentId = null;

  titleEl.value=''; editorEl.value='';
  try{
    await window.lifeos.saveNotes(notes);
    statusEl.textContent='Gelöscht'; setTimeout(()=>statusEl.textContent='',1200);
    renderList(searchEl.value);
    // Nach dem Löschen ggf. erste Note im aktuellen Ordner öffnen
    const first = childrenOf(currentFolderId).find(n=>n.type==='note');
    if(first) openNote(first.id); else setEditable(false);
  }catch(e){ alert('Fehler beim Löschen: ' + (e?.message||e)); }
}

// ---------- Actions ----------
if(newBtn) newBtn.onclick = ()=>{
  // Neue Note IM aktuellen Ordner
  currentId = null; // erzwingt create in save()
  titleEl.value = '';
  editorEl.value = '';
  setEditable(true);
  titleEl.focus();
};

// --- Robuster "Neuer Ordner"-Handler (direkt + delegiert) ---
function handleCreateFolderClick(e) {
  e?.preventDefault?.();

  try {
    const name = prompt('Name des neuen Ordners:', 'Neuer Ordner');
    const title = (name && name.trim()) ? name.trim() : 'Neuer Ordner';

    const folder = createFolder({ title, parentId: currentFolderId });
    notes.push(folder);

    // sofort speichern & in den Ordner wechseln
    window.lifeos.saveNotes(notes).then(() => {
      currentId = folder.id;
      openFolder(folder.id);
      statusEl.textContent = 'Ordner erstellt';
      setTimeout(() => (statusEl.textContent = ''), 1200);
    });
  } catch (err) {
    console.error('Neuer Ordner – Fehler:', err);
    alert('Ordner konnte nicht erstellt werden.');
  }
}

// 1) Direktes Binding (falls Element schon da ist)
const newFolderBtnEl = document.getElementById('newFolderBtn');
if (newFolderBtnEl) {
  newFolderBtnEl.addEventListener('click', handleCreateFolderClick);
}

// 2) Event-Delegation (falls Element später ersetzt wird)
document.addEventListener('click', (ev) => {
  const btn = ev.target && ev.target.closest && ev.target.closest('#newFolderBtn');
  if (btn) handleCreateFolderClick(ev);
});


if(saveBtn) saveBtn.onclick = save;
if(deleteBtn) deleteBtn.onclick = deleteCurrent;

document.addEventListener('keydown', (e)=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); save(); }
});

if(searchEl) searchEl.addEventListener('input', ()=>renderList(searchEl.value));

// ---------- Start ----------
load();
