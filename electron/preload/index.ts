import { createRequire } from "node:module";
import type electronType from "electron";
import {
  overlayAnimationRequestSchema,
  overlayMoveRequestSchema,
  petChannels,
  petManagerResultSchema,
  petManagerStateSchema,
} from "../shared/ipc.js";
import { petIdSchema } from "../shared/petAssets.js";
import { updateCheckResultSchema, updateDownloadRequestSchema } from "../shared/update.js";

const require = createRequire(import.meta.url);
const electron: typeof electronType = require("electron");
const { contextBridge, ipcRenderer } = electron;

const codexPetApi = {
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
  onAnimationRequested: (callback: (state: unknown) => void) => {
    const listener = (_event: electronType.IpcRendererEvent, state: unknown): void => {
      callback(overlayAnimationRequestSchema.parse({ state }).state);
    };
    ipcRenderer.on(petChannels.animationRequested, listener);
    return () => ipcRenderer.removeListener(petChannels.animationRequested, listener);
  },
};

contextBridge.exposeInMainWorld("codexPet", codexPetApi);
