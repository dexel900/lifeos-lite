1// main.js
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

// === Websites Root erstellen ===
const websitesDir = path.join(app.getPath('userData'), 'websites');

async function ensureWebsitesRoot() {
  try {
    await fs.promises.mkdir(websitesDir, { recursive: true });
  } catch (err) {
    console.error('Fehler beim Anlegen des Websites-Ordners:', err);
  }
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

// === Websites IPC ===
ipcMain.handle('web:list', async () => {
  const files = await fs.promises.readdir(websitesDir);
  return files.map(f => path.parse(f).name);
});

ipcMain.handle('web:create', async (event, name) => {
  const id = name.replace(/\s+/g, '_');
  const file = path.join(websitesDir, `${id}.json`);
  await fs.promises.writeFile(file, JSON.stringify({
    html: "<!DOCTYPE html><html><head><title>Neu</title></head><body><h1>Hello World</h1></body></html>",
    css: "body { font-family: sans-serif; }",
    js: "console.log('Hello World');"
  }, null, 2));
  return id;
});

ipcMain.handle('web:read', async (event, id) => {
  const file = path.join(websitesDir, `${id}.json`);
  const data = await fs.promises.readFile(file, 'utf8');
  return JSON.parse(data);
});

ipcMain.handle('web:save', async (event, { id, html, css, js }) => {
  const file = path.join(websitesDir, `${id}.json`);
  await fs.promises.writeFile(file, JSON.stringify({ html, css, js }, null, 2));
  return true;
});

ipcMain.handle('web:delete', async (event, id) => {
  const file = path.join(websitesDir, `${id}.json`);
  await fs.promises.unlink(file);
  return true;
});



app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
