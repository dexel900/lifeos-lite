// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lifeos', {
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes)
});
