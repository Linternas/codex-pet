const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexPet", {
  getState: () => ipcRenderer.invoke("pet:get-state"),
  installPet: (petId) => ipcRenderer.invoke("pet:install", { petId }),
  deletePet: (petId) => ipcRenderer.invoke("pet:delete", { petId }),
  applyPet: (petId) => ipcRenderer.invoke("pet:apply", { petId }),
  setOverlayScale: (scale) => ipcRenderer.invoke("pet:set-overlay-scale", { scale }),
  resizeOverlay: (width) => ipcRenderer.invoke("pet:resize-overlay", { width }),
  moveOverlay: (deltaX, deltaY) => ipcRenderer.invoke("pet:move-overlay", { deltaX, deltaY }),
  requestAnimation: (state) => ipcRenderer.invoke("pet:request-animation", { state }),
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("pet:state-changed", listener);
    return () => ipcRenderer.removeListener("pet:state-changed", listener);
  },
  onAnimationRequested: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("pet:animation-requested", listener);
    return () => ipcRenderer.removeListener("pet:animation-requested", listener);
  },
});
