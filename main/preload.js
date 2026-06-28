const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('koliko', {
  // Today
  getToday:                ()      => ipcRenderer.invoke('db:getToday'),
  toggleObligation:        (id)    => ipcRenderer.invoke('db:toggleObligation', id),
  getTodayDistractionCount:()      => ipcRenderer.invoke('db:getTodayDistractionCount'),

  // Plan
  getTomorrowPlan:         ()      => ipcRenderer.invoke('db:getTomorrowPlan'),
  createObligation:        (args)  => ipcRenderer.invoke('db:createObligation', args),
  deleteObligation:        (id)    => ipcRenderer.invoke('db:deleteObligation', id),
  reorderObligations:      (ids)   => ipcRenderer.invoke('db:reorderObligations', ids),
  lockPlan:                (id)    => ipcRenderer.invoke('db:lockPlan', id),

  // Stats
  getStats:                ()      => ipcRenderer.invoke('db:getStats'),

  // Settings
  getSettings:             ()      => ipcRenderer.invoke('db:getSettings'),
  saveSetting:             (k, v)  => ipcRenderer.invoke('db:saveSetting', { key: k, value: v }),

  // Blocking
  getBlockingStatus:       ()      => ipcRenderer.invoke('blocker:getStatus'),

  // Reports
  reportObligation:        (args)  => ipcRenderer.invoke('db:reportObligation', args),
  getReportCount:          (id)    => ipcRenderer.invoke('db:getReportCount', id),

  // PIN
  verifyPin:               (pin)   => ipcRenderer.invoke('pin:verify', pin),
  unlockPin:               (args)  => ipcRenderer.invoke('pin:unlock', args),

  // Video
  pickVideoFile:           ()      => ipcRenderer.invoke('video:pickFile'),
  videoEnded:              (args)  => ipcRenderer.invoke('video:ended', args),

  // App blocker
  pickAppFile:             ()      => ipcRenderer.invoke('app:pickFile'),

  // Main → Renderer events
  on: (channel, fn) => {
    const allowed = ['blocking:changed', 'reminder:trigger', 'distraction:intercepted']
    if (allowed.includes(channel)) {
      const wrapped = (_, ...args) => fn(...args)
      ipcRenderer.on(channel, wrapped)
      return () => ipcRenderer.removeListener(channel, wrapped)
    }
  },

  // Window control
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
})
