const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexPet", {
  openAgentSessions: () => ipcRenderer.invoke("session:open"),
  onShowAgentSessions: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("session:show-page", listener);
    return () => ipcRenderer.removeListener("session:show-page", listener);
  },
  getAgentSessions: () => ipcRenderer.invoke("session:get"),
  configureAgentHooks: (provider, enabled) =>
    ipcRenderer.invoke("session:configure", { provider, enabled }),
  onAgentSessions: (callback) => {
    const listener = (_event, sessions) => callback(sessions);
    ipcRenderer.on("session:changed", listener);
    return () => ipcRenderer.removeListener("session:changed", listener);
  },
  getAppUpdate: () => ipcRenderer.invoke("app-update:state"),
  checkAppUpdate: () => ipcRenderer.invoke("app-update:check"),
  downloadAppUpdate: () => ipcRenderer.invoke("app-update:download"),
  installAppUpdate: () => ipcRenderer.invoke("app-update:install"),
  onAppUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("app-update:changed", listener);
    return () => ipcRenderer.removeListener("app-update:changed", listener);
  },
  revealKeyboardMonitor: () => ipcRenderer.invoke("pet:reveal-keyboard-monitor"),
  getReleaseHistory: () => ipcRenderer.invoke("pet:get-release-history"),
  refreshInstaller: () => ipcRenderer.invoke("pet:refresh-installer"),
  downloadNode: () => ipcRenderer.invoke("pet:download-node"),
  getAccessibilityPermission: () => ipcRenderer.invoke("pet:get-accessibility-permission"),
  openAccessibilitySettings: () => ipcRenderer.invoke("pet:open-accessibility-settings"),
  checkForUpdate: () => ipcRenderer.invoke("pet:check-update"),
  openUpdateDownload: (downloadUrl) =>
    ipcRenderer.invoke("pet:open-update-download", { downloadUrl }),
  getState: () => ipcRenderer.invoke("pet:get-state"),
  installPet: (petId) => ipcRenderer.invoke("pet:install", { petId }),
  deletePet: (petId) => ipcRenderer.invoke("pet:delete", { petId }),
  applyPet: (petId) => ipcRenderer.invoke("pet:apply", { petId }),
  setOverlayScale: (scale) => ipcRenderer.invoke("pet:set-overlay-scale", { scale }),
  resizeOverlay: (width) => ipcRenderer.invoke("pet:resize-overlay", { width }),
  setAutoWalk: (enabled) => ipcRenderer.invoke("pet:set-auto-walk", enabled),
  stepAutoWalk: (direction) => ipcRenderer.invoke("pet:step-auto-walk", direction),
  moveOverlay: (deltaX, deltaY) => ipcRenderer.invoke("pet:move-overlay", { deltaX, deltaY }),
  requestAnimation: (state) => ipcRenderer.invoke("pet:request-animation", { state }),
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("pet:state-changed", listener);
    return () => ipcRenderer.removeListener("pet:state-changed", listener);
  },
  onKeyboardActivity: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("pet:keyboard-activity", listener);
    return () => ipcRenderer.removeListener("pet:keyboard-activity", listener);
  },
  onAnimationRequested: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("pet:animation-requested", listener);
    return () => ipcRenderer.removeListener("pet:animation-requested", listener);
  },
});
