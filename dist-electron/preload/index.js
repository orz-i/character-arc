"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("characterArc", {
  platform: process.platform,
  version: "0.1.0",
  loadWorkspace: () => electron.ipcRenderer.invoke("characterarc:load-workspace"),
  saveWorkspace: (payload) => electron.ipcRenderer.invoke("characterarc:save-workspace", payload),
  pickCoverImage: () => electron.ipcRenderer.invoke("characterarc:pick-cover-image"),
  generateAi: (payload) => electron.ipcRenderer.invoke("characterarc:ai-generate", payload),
  startAiStream: (payload) => electron.ipcRenderer.invoke("characterarc:ai-stream-start", payload),
  stopAiStream: (streamId) => electron.ipcRenderer.invoke("characterarc:ai-stream-stop", streamId),
  onAiStreamEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("characterarc:ai-stream-event", listener);
    return () => {
      electron.ipcRenderer.removeListener("characterarc:ai-stream-event", listener);
    };
  },
  testAiConnection: (settings) => electron.ipcRenderer.invoke("characterarc:ai-test-connection", settings),
  exportJson: (payload) => electron.ipcRenderer.invoke("characterarc:export-json", payload),
  exportText: (payload) => electron.ipcRenderer.invoke("characterarc:export-text", payload),
  setZoomFactor: (factor) => electron.ipcRenderer.invoke("characterarc:set-zoom-factor", factor),
  getZoomFactor: () => electron.ipcRenderer.invoke("characterarc:get-zoom-factor"),
  importJson: () => electron.ipcRenderer.invoke("characterarc:import-json"),
  openAssistantWindow: () => electron.ipcRenderer.invoke("characterarc:assistant-window-open"),
  closeAssistantWindow: () => electron.ipcRenderer.invoke("characterarc:assistant-window-close"),
  getAssistantWindowState: () => electron.ipcRenderer.invoke("characterarc:assistant-window-state"),
  publishAssistantContext: (payload) => electron.ipcRenderer.invoke("characterarc:assistant-context-publish", payload),
  getAssistantContext: () => electron.ipcRenderer.invoke("characterarc:assistant-context-get"),
  publishAssistantPrompt: (payload) => electron.ipcRenderer.invoke("characterarc:assistant-prompt-publish", payload),
  getAssistantPrompt: () => electron.ipcRenderer.invoke("characterarc:assistant-prompt-get"),
  clearAssistantPrompt: (promptId) => electron.ipcRenderer.invoke("characterarc:assistant-prompt-clear", promptId),
  publishWorkspaceSync: (payload) => electron.ipcRenderer.invoke("characterarc:workspace-sync-publish", payload),
  publishAssistantCommand: (payload) => electron.ipcRenderer.invoke("characterarc:assistant-command-publish", payload),
  onAssistantWindowVisibility: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("characterarc:assistant-window-visibility", listener);
    return () => {
      electron.ipcRenderer.removeListener("characterarc:assistant-window-visibility", listener);
    };
  },
  onAssistantContext: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("characterarc:assistant-context", listener);
    return () => {
      electron.ipcRenderer.removeListener("characterarc:assistant-context", listener);
    };
  },
  onAssistantPrompt: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("characterarc:assistant-prompt", listener);
    return () => {
      electron.ipcRenderer.removeListener("characterarc:assistant-prompt", listener);
    };
  },
  onWorkspaceSync: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("characterarc:workspace-sync-event", listener);
    return () => {
      electron.ipcRenderer.removeListener("characterarc:workspace-sync-event", listener);
    };
  },
  onAssistantCommand: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("characterarc:assistant-command", listener);
    return () => {
      electron.ipcRenderer.removeListener("characterarc:assistant-command", listener);
    };
  }
});
