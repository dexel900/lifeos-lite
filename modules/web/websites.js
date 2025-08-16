// modules/web/websites.js

let projects = [];
let currentProjectId = null;

const webListEl   = document.getElementById('webList');
const webNewBtn   = document.getElementById('webNewBtn');
const webSearchEl = document.getElementById('webSearch');
const nameEl      = document.getElementById('webProjectName');

const tabBar      = document.getElementById('webTabs');
const tabBtns     = [...tabBar.querySelectorAll('.tab')];
const htmlEl      = document.getElementById('webHtml');
const cssEl       = document.getElementById('webCss');
const jsEl        = document.getElementById('webJs');
const saveBtn     = document.getElementById('webSaveBtn');
const delBtn      = document.getElementById('webDeleteBtn');
const statusEl    = document.getElementById('webStatus');
const previewEl   = document.getElementById('webPreview');

function activateTab(kind){
  tabBtns.forEach(b=>b.classList.toggle('active', b.dataset.tab===kind));
  htmlEl.classList.toggle('hidden', kind!=='html');
  cssEl.classList.toggle('hidden',  kind!=='css');
  jsEl.classList.toggle('hidden',   kind!=='js');
}

tabBar.addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab'); if(!btn) return;
  activateTab(btn.dataset.tab);
  // kleines UX: Cursor in aktivem Feld
  (btn.dataset.tab==='html'?htmlEl:btn.dataset.tab==='css'?cssEl:jsEl).focus();
});

function renderProjects(filter=''){
  const q = filter.trim().toLowerCase();
  webListEl.innerHTML = '';
  const list = projects
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0));

  for(const p of list){
    const div = document.createElement('div');
    div.className = 'item' + (p.id===currentProjectId?' active':'');
    const time = new Date(p.updatedAt||p.createdAt||Date.now()).toLocaleString();
    div.innerHTML = `<div><strong>${p.name}</strong></div>
                     <div class="muted" style="font-size:12px">${time}</div>`;
    div.onclick = ()=> openProject(p.id);
    webListEl.appendChild(div);
  }
}

async function refresh() {
  projects = await window.web.list();
  renderProjects(webSearchEl.value);
  if (projects.length && !currentProjectId) {
    openProject(projects[0].id);
  }
}

async function openProject(id){
  currentProjectId = id;
  const data = await window.web.read(id);
  htmlEl.value = data.html || '';
  cssEl.value  = data.css  || '';
  jsEl.value   = data.js   || '';
  const p = projects.find(x=>x.id===id);
  nameEl.textContent = p ? `· ${p.name}` : '';
  renderProjects(webSearchEl.value);
  rerenderPreview();
}

function rerenderPreview(){
  const html = htmlEl.value || '';
  const css  = cssEl.value  || '';
  const js   = jsEl.value   || '';
  const doc = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${css}</style>
</head>
<body>
${html}
<script>
try { ${js} } catch (e) { console.error(e); }
</script>
</body>
</html>`;
  previewEl.srcdoc = doc;
}

async function save(){
  if(!currentProjectId) return;
  try {
    await window.web.save({
      id: currentProjectId,
      html: htmlEl.value,
      css:  cssEl.value,
      js:   jsEl.value
    });
    statusEl.textContent = 'Gespeichert';
    setTimeout(()=> statusEl.textContent='', 1200);
    await refresh();
    rerenderPreview();
  } catch(e){
    alert('Speichern fehlgeschlagen: ' + (e?.message||e));
  }
}

async function createProject(){
  const name = prompt('Projektname:', 'Neues Projekt');
  if (name === null) return;
  const p = await window.web.create(name.trim() || 'Neues Projekt');
  await refresh();
  openProject(p.id);
}

async function removeProject(){
  if(!currentProjectId) return;
  const p = projects.find(x=>x.id===currentProjectId);
  if(!p) return;
  if(!confirm(`Projekt „${p.name}“ wirklich löschen?`)) return;
  await window.web.remove(p.id);
  currentProjectId = null;
  htmlEl.value = cssEl.value = jsEl.value = '';
  statusEl.textContent = 'Gelöscht'; setTimeout(()=> statusEl.textContent='', 1200);
  await refresh();
}

// Events
webNewBtn?.addEventListener('click', createProject);
webSearchEl?.addEventListener('input', ()=> renderProjects(webSearchEl.value));
saveBtn?.addEventListener('click', save);
delBtn?.addEventListener('click', removeProject);
[htmlEl, cssEl, jsEl].forEach(el => el.addEventListener('input', () => {
  // Live-Preview beim Tippen
  rerenderPreview();
}));

document.addEventListener('keydown', (e)=>{
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s') {
    e.preventDefault(); save();
  }
});

// Start
refresh().then(()=> activateTab('html'));
