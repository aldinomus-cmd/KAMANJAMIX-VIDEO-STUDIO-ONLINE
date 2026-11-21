"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("kmx", {
  begin: () => ipcRenderer.invoke("rec:begin"),
  write: (u8) => ipcRenderer.invoke("rec:write", u8),
  end: () => ipcRenderer.invoke("rec:end")
});
