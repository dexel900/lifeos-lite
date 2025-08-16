// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const NOTES_FILE = 'notes.json';
function notesPath() {
  return path.join(app.getPath('userData'), NOTES_FILE);
}
function ensureNotesFile() {
  try { fs.accessSync(notesPath()); }
  catch { fs.writeFileSync(notesPath(), JSON.stringify({ notes: [] }, null, 2), 'utf8'); }
}

function createWindow() {
  ensureNotesFile();
  ensureWebsitesRoot();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0f1115',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  win.loadFile('index.html');
}

// ---- Websites: Pfade & Setup ----
const WEBS_DIR = 'websites';

function websitesRoot() {
  return path.join(app.getPath('userData'), WEBS_DIR);
}

async function ensureWebsitesRoot() {
  const root = websitesRoot();
  try { await fs.mkdir(root, { recursive: true }); } catch {}
}

function projPath(id) {
  return path.join(websitesRoot(), id);
}


// IPC: Laden / Speichern
// --- ROBUST: Laden ---
ipcMain.handle('notes:load', async () => {
  try {
    const filePath = notesPath();
    const raw = fs.readFileSync(filePath, 'utf8');

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }

    // Akzeptiere sowohl { notes: [...] } als auch reines Array
    let arr = [];
    if (Array.isArray(parsed)) arr = parsed;
    else if (parsed && Array.isArray(parsed.notes)) arr = parsed.notes;

    // Fallback: leeres Array
    if (!Array.isArray(arr)) arr = [];

    return arr;
  } catch (err) {
    // Wenn Datei fehlt/kaputt: NICHT überschreiben – nur leer zurück
    return [];
  }
});

// --- ROBUST: Speichern (mit Backup & Normalisierung) ---
ipcMain.handle('notes:save', async (_e, notesArr) => {
  const filePath = notesPath();

  if (!Array.isArray(notesArr)) {
    throw new Error('Ungültiges Format: notes ist kein Array');
  }

  // Nur erlaubte Felder übernehmen + Defaults
  const cleaned = notesArr.map((nRaw) => {
    const n = nRaw || {};
    const type = (n.type === 'folder') ? 'folder' : 'note';
    const base = {
      id: String(n.id || ''),
      type,
      title: String(n.title || ''),
      parentId: (typeof n.parentId === 'undefined' ? null : n.parentId),
      pinned: !!n.pinned,
      createdAt: Number(n.createdAt || Date.now()),
      updatedAt: Number(n.updatedAt || Date.now())
    };
    if (type === 'note') base.content = String(n.content || '');
    return base;
  });

  // Vor dem Schreiben eine Sicherung anlegen
  try {
    if (fs.existsSync(filePath)) {
      const prev = fs.readFileSync(filePath, 'utf8');
      const backupPath = filePath.replace(/notes\.json$/, 'notes.prev.json');
      fs.writeFileSync(backupPath, prev, 'utf8');
    }
  } catch { /* Backup ist best effort */ }

  // Ordner-Objekte ohne "content" schreiben
  const toWrite = cleaned.map(x => (x.type === 'note' ? x : (() => { const { content, ...rest } = x; return rest; })()));

  fs.writeFileSync(filePath, JSON.stringify({ notes: toWrite }, null, 2), 'utf8');
  return true;
});

// ---- Websites IPC ----
ipcMain.handle('web:list', async () => {
  const root = websitesRoot();
  const out = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const id = e.name;
      const p = projPath(id);
      // Metadaten aus project.json (optional)
      let name = id;
      let createdAt = Date.now(), updatedAt = createdAt;
      try {
        const metaRaw = await fs.readFile(path.join(p, 'project.json'), 'utf8');
        const meta = JSON.parse(metaRaw);
        name = meta.name || name;
        createdAt = meta.createdAt || createdAt;
        updatedAt = meta.updatedAt || updatedAt;
      } catch {}
      out.push({ id, name, createdAt, updatedAt });
    }
  } catch {}
  // Sortierung: zuletzt benutzt oben
  out.sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0));
  return out;
});

ipcMain.handle('web:create', async (_e, name) => {
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2,8)).toLowerCase();
  const base = projPath(id);
  await fs.mkdir(base, { recursive: true });

  const now = Date.now();
  // Default-Dateien
  await fs.writeFile(path.join(base, 'index.html'),
`<section class="hero">
  <h1>Hallo 👋</h1>
  <p>Dein neues Projekt läuft.</p>
</section>`, 'utf8');

  await fs.writeFile(path.join(base, 'styles.css'),
`*{box-sizing:border-box} body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:32px;background:#0b0f14;color:#e7eef7}
.hero{max-width:800px;margin:auto}
h1{font-size:42px;margin:0 0 8px}
p{opacity:.9}`, 'utf8');

  await fs.writeFile(path.join(base, 'script.js'),
`console.log("Hello from script.js");`, 'utf8');

  await fs.writeFile(path.join(base, 'project.json'),
    JSON.stringify({ id, name: name || 'Neues Projekt', createdAt: now, updatedAt: now }, null, 2),
  'utf8');

  return { id, name: name || 'Neues Projekt' };
});

ipcMain.handle('web:read', async (_e, id) => {
  const base = projPath(id);
  const read = async f => {
    try { return await fs.readFile(path.join(base, f), 'utf8'); }
    catch { return ''; }
  };
  return {
    id,
    html: await read('index.html'),
    css:  await read('styles.css'),
    js:   await read('script.js'),
  };
});

ipcMain.handle('web:save', async (_e, payload) => {
  const { id, html, css, js } = payload || {};
  if (!id) throw new Error('id fehlt');
  const base = projPath(id);
  // schreiben
  await fs.writeFile(path.join(base, 'index.html'), html ?? '', 'utf8');
  await fs.writeFile(path.join(base, 'styles.css'),  css  ?? '', 'utf8');
  await fs.writeFile(path.join(base, 'script.js'),   js   ?? '', 'utf8');
  // meta bump
  try {
    const metaPath = path.join(base, 'project.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    meta.updatedAt = Date.now();
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  } catch {}
  return true;
});

ipcMain.handle('web:delete', async (_e, id) => {
  await fs.rm(projPath(id), { recursive: true, force: true });
  return true;
});



app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
