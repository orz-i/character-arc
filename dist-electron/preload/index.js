"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("characterArc", {
  platform: process.platform,
  version: "0.1.0",
  loadWorkspace: () => electron.ipcRenderer.invoke("characterarc:load-workspace"),
  saveWorkspace: (payload) => electron.ipcRenderer.invoke("characterarc:save-workspace", payload),
  pickCoverImage: () => electron.ipcRenderer.invoke("characterarc:pick-cover-image"),
  generateAi: (payload) => electron.ipcRenderer.invoke("characterarc:ai-generate", payload),
  exportJson: (payload) => electron.ipcRenderer.invoke("characterarc:export-json", payload),
  exportText: (payload) => electron.ipcRenderer.invoke("characterarc:export-text", payload),
  setZoomFactor: (factor) => electron.ipcRenderer.invoke("characterarc:set-zoom-factor", factor),
  getZoomFactor: () => electron.ipcRenderer.invoke("characterarc:get-zoom-factor"),
  importJson: () => electron.ipcRenderer.invoke("characterarc:import-json")
});
