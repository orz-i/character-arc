"use strict";
const electron = require("electron");
const node_path = require("node:path");
const promises = require("node:fs/promises");
const APP_MIN_WIDTH = 1360;
const APP_MIN_HEIGHT = 860;
function createMainWindow() {
  const window = new electron.BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: APP_MIN_WIDTH,
    minHeight: APP_MIN_HEIGHT,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    // Keep native caption buttons while giving the renderer a compact title-bar area to style around.
    titleBarOverlay: process.platform === "win32" ? {
      color: "#f5f5f7",
      symbolColor: "#1d1d1f",
      height: 28
    } : false,
    backgroundColor: "#f5f5f7",
    show: false,
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.once("ready-to-show", () => {
    window.show();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    void window.loadFile(node_path.join(__dirname, "../../dist/index.html"));
  }
}
electron.ipcMain.handle("characterarc:export-json", async (_event, payload) => {
  const window = electron.BrowserWindow.getFocusedWindow();
  if (!window) {
    return { success: false, canceled: true };
  }
  const result = await electron.dialog.showSaveDialog(window, {
    title: "导出项目数据",
    defaultPath: "characterarc-export.json",
    filters: [
      { name: "JSON 文件", extensions: ["json"] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  await promises.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf-8");
  return {
    success: true,
    canceled: false,
    filePath: result.filePath
  };
});
electron.ipcMain.handle("characterarc:export-text", async (_event, payload) => {
  const window = electron.BrowserWindow.getFocusedWindow();
  if (!window) {
    return { success: false, canceled: true };
  }
  const result = await electron.dialog.showSaveDialog(window, {
    title: "导出章节文本",
    defaultPath: "characterarc-export.txt",
    filters: [
      { name: "文本文档", extensions: ["txt"] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  const data = payload;
  const text = [
    data.project?.title ? `# ${data.project.title}` : "# CharacterArc 导出",
    "",
    ...(data.chapters ?? []).flatMap((chapter, index) => [
      `第${index + 1}章 ${chapter.title ?? "未命名章节"}`,
      "",
      chapter.content?.trim() || "（暂无正文内容）",
      "",
      "".padEnd(48, "-"),
      ""
    ])
  ].join("\n");
  await promises.writeFile(result.filePath, text, "utf-8");
  return {
    success: true,
    canceled: false,
    filePath: result.filePath
  };
});
electron.ipcMain.handle("characterarc:import-json", async () => {
  const window = electron.BrowserWindow.getFocusedWindow();
  if (!window) {
    return { success: false, canceled: true };
  }
  const result = await electron.dialog.showOpenDialog(window, {
    title: "导入项目 JSON",
    properties: ["openFile"],
    filters: [
      { name: "JSON 文件", extensions: ["json"] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  const raw = await promises.readFile(result.filePaths[0], "utf-8");
  const parsed = JSON.parse(raw);
  return {
    success: true,
    canceled: false,
    payload: parsed
  };
});
electron.app.whenReady().then(() => {
  createMainWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
