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



app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
