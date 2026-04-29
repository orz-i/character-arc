import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('characterArc', {
  platform: process.platform,
  version: '0.1.0',
  loadWorkspace: () => ipcRenderer.invoke('characterarc:load-workspace'),
  saveWorkspace: (payload: unknown) => ipcRenderer.invoke('characterarc:save-workspace', payload),
  pickCoverImage: () => ipcRenderer.invoke('characterarc:pick-cover-image'),
  generateAi: (payload: unknown) => ipcRenderer.invoke('characterarc:ai-generate', payload),
  startAiStream: (payload: unknown) => ipcRenderer.invoke('characterarc:ai-stream-start', payload),
  stopAiStream: (streamId: string) => ipcRenderer.invoke('characterarc:ai-stream-stop', streamId),
  onAiStreamEvent: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on('characterarc:ai-stream-event', listener)
    return () => {
      ipcRenderer.removeListener('characterarc:ai-stream-event', listener)
    }
  },
  testAiConnection: (settings: unknown) => ipcRenderer.invoke('characterarc:ai-test-connection', settings),
  exportJson: (payload: unknown) => ipcRenderer.invoke('characterarc:export-json', payload),
  exportText: (payload: unknown) => ipcRenderer.invoke('characterarc:export-text', payload),
  setZoomFactor: (factor: number) => ipcRenderer.invoke('characterarc:set-zoom-factor', factor),
  getZoomFactor: () => ipcRenderer.invoke('characterarc:get-zoom-factor'),
  importJson: () => ipcRenderer.invoke('characterarc:import-json'),
  openAssistantWindow: () => ipcRenderer.invoke('characterarc:assistant-window-open'),
  closeAssistantWindow: () => ipcRenderer.invoke('characterarc:assistant-window-close'),
  getAssistantWindowState: () => ipcRenderer.invoke('characterarc:assistant-window-state'),
  publishAssistantContext: (payload: unknown) => ipcRenderer.invoke('characterarc:assistant-context-publish', payload),
  getAssistantContext: () => ipcRenderer.invoke('characterarc:assistant-context-get'),
  publishAssistantPrompt: (payload: unknown) => ipcRenderer.invoke('characterarc:assistant-prompt-publish', payload),
  getAssistantPrompt: () => ipcRenderer.invoke('characterarc:assistant-prompt-get'),
  clearAssistantPrompt: (promptId: string) => ipcRenderer.invoke('characterarc:assistant-prompt-clear', promptId),
  publishWorkspaceSync: (payload: unknown) => ipcRenderer.invoke('characterarc:workspace-sync-publish', payload),
  publishAssistantCommand: (payload: unknown) => ipcRenderer.invoke('characterarc:assistant-command-publish', payload),
  onAssistantWindowVisibility: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on('characterarc:assistant-window-visibility', listener)
    return () => {
      ipcRenderer.removeListener('characterarc:assistant-window-visibility', listener)
    }
  },
  onAssistantContext: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on('characterarc:assistant-context', listener)
    return () => {
      ipcRenderer.removeListener('characterarc:assistant-context', listener)
    }
  },
  onAssistantPrompt: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on('characterarc:assistant-prompt', listener)
    return () => {
      ipcRenderer.removeListener('characterarc:assistant-prompt', listener)
    }
  },
  onWorkspaceSync: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on('characterarc:workspace-sync-event', listener)
    return () => {
      ipcRenderer.removeListener('characterarc:workspace-sync-event', listener)
    }
  },
  onAssistantCommand: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on('characterarc:assistant-command', listener)
    return () => {
      ipcRenderer.removeListener('characterarc:assistant-command', listener)
    }
  }
})
