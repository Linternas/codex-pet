import { createRequire } from "node:module";
import type electronType from "electron";
import { appUpdateChannels, appUpdateStateSchema } from "../shared/appUpdate.js";
import {
  overlayAnimationRequestSchema,
  overlayMoveRequestSchema,
  petChannels,
  petManagerResultSchema,
  petManagerStateSchema,
} from "../shared/ipc.js";
import { petIdSchema } from "../shared/petAssets.js";
import { releaseHistoryResultSchema } from "../shared/releaseHistory.js";
import { updateCheckResultSchema, updateDownloadRequestSchema } from "../shared/update.js";

const require = createRequire(import.meta.url);
const electron: typeof electronType = require("electron");
const { contextBridge, ipcRenderer } = electron;

const codexPetApi = {
  getAppUpdate: async () =>
    appUpdateStateSchema.parse(await ipcRenderer.invoke(appUpdateChannels.state)),
  checkAppUpdate: async () =>
    appUpdateStateSchema.parse(await ipcRenderer.invoke(appUpdateChannels.check)),
  downloadAppUpdate: async () =>
    appUpdateStateSchema.parse(await ipcRenderer.invoke(appUpdateChannels.download)),
  installAppUpdate: async () =>
    appUpdateStateSchema.parse(await ipcRenderer.invoke(appUpdateChannels.install)),
  onAppUpdate: (callback: (state: unknown) => void) => {
    const listener = (_event: electronType.IpcRendererEvent, state: unknown): void =>
      callback(appUpdateStateSchema.parse(state));
    ipcRenderer.on(appUpdateChannels.changed, listener);
    return () => ipcRenderer.removeListener(appUpdateChannels.changed, listener);
  },
  revealKeyboardMonitor: async () => {
    await ipcRenderer.invoke(petChannels.revealKeyboardMonitor);
  },
  getReleaseHistory: async () =>
    releaseHistoryResultSchema.parse(await ipcRenderer.invoke(petChannels.getReleaseHistory)),
  refreshInstaller: async () =>
    petManagerResultSchema.parse(await ipcRenderer.invoke(petChannels.refreshInstaller)),
  downloadNode: async () => {
    return (await ipcRenderer.invoke(petChannels.downloadNode)) === true;
  },
  getState: async () =>
    petManagerResultSchema.parse(await ipcRenderer.invoke(petChannels.getState)),
  installPet: async (petId: string) =>
    petManagerResultSchema.parse(
      await ipcRenderer.invoke(petChannels.install, { petId: petIdSchema.parse(petId) }),
    ),
  deletePet: async (petId: string) =>
    petManagerResultSchema.parse(
      await ipcRenderer.invoke(petChannels.delete, { petId: petIdSchema.parse(petId) }),
    ),
  applyPet: async (petId: string) =>
    petManagerResultSchema.parse(
      await ipcRenderer.invoke(petChannels.apply, { petId: petIdSchema.parse(petId) }),
    ),
  checkForUpdate: async () =>
    updateCheckResultSchema.parse(await ipcRenderer.invoke(petChannels.checkUpdate)),
  getAccessibilityPermission: async (): Promise<boolean> => {
    const value: unknown = await ipcRenderer.invoke(petChannels.getAccessibilityPermission);
    if (typeof value !== "boolean") throw new Error("Invalid accessibility permission state");
    return value;
  },
  openAccessibilitySettings: async () => {
    await ipcRenderer.invoke(petChannels.openAccessibilitySettings);
  },
  openUpdateDownload: async (downloadUrl: string) => {
    await ipcRenderer.invoke(
      petChannels.openUpdateDownload,
      updateDownloadRequestSchema.parse({ downloadUrl }),
    );
  },
  setOverlayScale: async (scale: number) =>
    petManagerResultSchema.parse(await ipcRenderer.invoke(petChannels.setOverlayScale, { scale })),
  resizeOverlay: async (width: number) =>
    petManagerResultSchema.parse(await ipcRenderer.invoke(petChannels.resizeOverlay, { width })),
  moveOverlay: async (deltaX: number, deltaY: number) => {
    await ipcRenderer.invoke(
      petChannels.moveOverlay,
      overlayMoveRequestSchema.parse({ deltaX, deltaY }),
    );
  },
  requestAnimation: async (state: unknown) => {
    await ipcRenderer.invoke(
      petChannels.requestAnimation,
      overlayAnimationRequestSchema.parse({ state }),
    );
  },
  onStateChanged: (callback: (state: unknown) => void) => {
    const listener = (_event: electronType.IpcRendererEvent, state: unknown): void => {
      callback(petManagerStateSchema.parse(state));
    };
    ipcRenderer.on(petChannels.stateChanged, listener);
    return () => ipcRenderer.removeListener(petChannels.stateChanged, listener);
  },
  onKeyboardActivity: (callback: () => void) => {
    const listener = (): void => callback();
    ipcRenderer.on(petChannels.keyboardActivity, listener);
    return () => ipcRenderer.removeListener(petChannels.keyboardActivity, listener);
  },
  onAnimationRequested: (callback: (state: unknown) => void) => {
    const listener = (_event: electronType.IpcRendererEvent, state: unknown): void => {
      callback(overlayAnimationRequestSchema.parse({ state }).state);
    };
    ipcRenderer.on(petChannels.animationRequested, listener);
    return () => ipcRenderer.removeListener(petChannels.animationRequested, listener);
  },
};

contextBridge.exposeInMainWorld("codexPet", codexPetApi);
