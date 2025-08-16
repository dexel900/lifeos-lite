// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lifeos', {
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes)
});

contextBridge.exposeInMainWorld('web', {
  list:   () => ipcRenderer.invoke('web:list'),
  create: (name) => ipcRenderer.invoke('web:create', name),
  read:   (id) => ipcRenderer.invoke('web:read', id),
  save:   (data) => ipcRenderer.invoke('web:save', data),
  remove: (id) => ipcRenderer.invoke('web:delete', id),
});

