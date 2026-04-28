import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('characterArc', {
  platform: process.platform,
  version: '0.1.0',
  exportJson: (payload: unknown) => ipcRenderer.invoke('characterarc:export-json', payload),
  exportText: (payload: unknown) => ipcRenderer.invoke('characterarc:export-text', payload),
  importJson: () => ipcRenderer.invoke('characterarc:import-json')
})
