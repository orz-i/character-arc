import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('characterArc', {
  platform: process.platform,
  version: '0.1.0',
  loadWorkspace: () => ipcRenderer.invoke('characterarc:load-workspace'),
  saveWorkspace: (payload: unknown) => ipcRenderer.invoke('characterarc:save-workspace', payload),
  pickCoverImage: () => ipcRenderer.invoke('characterarc:pick-cover-image'),
  generateAi: (payload: unknown) => ipcRenderer.invoke('characterarc:ai-generate', payload),
  exportJson: (payload: unknown) => ipcRenderer.invoke('characterarc:export-json', payload),
  exportText: (payload: unknown) => ipcRenderer.invoke('characterarc:export-text', payload),
  setZoomFactor: (factor: number) => ipcRenderer.invoke('characterarc:set-zoom-factor', factor),
  getZoomFactor: () => ipcRenderer.invoke('characterarc:get-zoom-factor'),
  importJson: () => ipcRenderer.invoke('characterarc:import-json')
})
