const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // налаштування
  getConfig: () => ipcRenderer.invoke('config:get'),
  getSources: () => ipcRenderer.invoke('sources:get'),
  saveConfig: (c) => ipcRenderer.invoke('config:save', c),
  getEvents: () => ipcRenderer.invoke('events:get'),
  refresh: () => ipcRenderer.invoke('events:refresh'),
  test: () => ipcRenderer.invoke('test'),
  testNotif: () => ipcRenderer.invoke('test-notif'),
  openPrivacy: (what) => ipcRenderer.invoke('open-privacy', what),
  onEventsUpdated: (cb) => ipcRenderer.on('events-updated', cb),
  // вікно з Clawd
  onShow: (cb) => ipcRenderer.on('overlay:show', (_e, data) => cb(data)),
  setInteractive: (on) => ipcRenderer.send('overlay:interactive', on),
  done: () => ipcRenderer.send('overlay:done'),
});
