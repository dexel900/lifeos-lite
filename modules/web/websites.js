// modules/web/websites.js
let currentWebId = null;

async function loadWebList() {
  const list = await window.web.list();
  const container = document.getElementById('webList');
  container.innerHTML = '';
  list.forEach(id => {
    const btn = document.createElement('button');
    btn.textContent = id;
    btn.onclick = () => openWeb(id);
    container.appendChild(btn);
  });
}

async function createWeb() {
  const name = prompt('Projektname:');
  if (!name) return;
  const id = await window.web.create(name);
  await loadWebList();
  openWeb(id);
}

async function openWeb(id) {
  currentWebId = id;
  const data = await window.web.read(id);
  document.getElementById('webHtml').value = data.html;
  document.getElementById('webCss').value  = data.css;
  document.getElementById('webJs').value   = data.js;
  updatePreview();
}

async function saveWeb() {
  if (!currentWebId) return;
  const html = document.getElementById('webHtml').value;
  const css  = document.getElementById('webCss').value;
  const js   = document.getElementById('webJs').value;
  await window.web.save({ id: currentWebId, html, css, js });
  updatePreview();
}

async function deleteWeb() {
  if (!currentWebId) return;
  if (!confirm('Wirklich löschen?')) return;
  await window.web.remove(currentWebId);
  currentWebId = null;
  loadWebList();
}

function updatePreview() {
  const html = document.getElementById('webHtml').value;
  const css  = `<style>${document.getElementById('webCss').value}</style>`;
  const js   = `<script>${document.getElementById('webJs').value}<\/script>`;
  document.getElementById('webPreview').srcdoc = html + css + js;
}

// Tabs
document.querySelectorAll('#viewWeb .tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#viewWeb textarea').forEach(t => t.classList.add('hidden'));
    document.getElementById('web' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.remove('hidden');
  });
});

// Shortcuts (Strg+S)
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveWeb();
  }
});

// Init
document.addEventListener('DOMContentLoaded', loadWebList);
