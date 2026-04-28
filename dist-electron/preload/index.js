"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("characterArc", {
  platform: process.platform,
  version: "0.1.0",
  exportJson: (payload) => electron.ipcRenderer.invoke("characterarc:export-json", payload),
  exportText: (payload) => electron.ipcRenderer.invoke("characterarc:export-text", payload),
  importJson: () => electron.ipcRenderer.invoke("characterarc:import-json")
});
