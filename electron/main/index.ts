import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import type electronType from "electron";
import {
  type InstallPetRequest,
  type OverlayResizeRequest,
  type OverlayScaleRequest,
  type PetIdRequest,
  type PetManagerResult,
  type PetManagerState,
  petChannels,
} from "../shared/ipc.js";
import {
  clampOverlayScale,
  overlayDefaults,
  resolveOverlayScaleFromWidth,
} from "../shared/overlay.js";
import {
  copyCodexPetToProject,
  deleteProjectPet,
  installCodexPet,
  listProjectPets,
} from "../shared/petAssets.js";
import { readPetPreferences, writePetPreferences } from "../shared/userPreferences.js";
import { getInstallerStatus } from "./installerStatus.js";
import { startGlobalKeyboardActivity, stopGlobalKeyboardActivity } from "./keyboardActivity.js";
import { createOverlayWindowController } from "./overlayWindow.js";
import { registerPetIpcHandlers } from "./petIpc.js";
import { resolveRendererUrl } from "./rendererUrl.js";
import { type StatusTray, createStatusTray } from "./statusTray.js";
import { registerUpdateIpcHandlers } from "./updateIpc.js";

const require = createRequire(import.meta.url);
const electron: typeof electronType = require("electron");
const { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, shell } = electron;
const projectRoot = process.cwd();
const preloadPath = join(projectRoot, "electron-preload.cjs");
let mainWindow: InstanceType<typeof BrowserWindow> | undefined;
let statusTray: StatusTray | undefined;
let appliedPetId: string | null = null;
let overlayScale: number = overlayDefaults.defaultScale;
const overlayController = createOverlayWindowController({ preloadPath, projectRoot });
app.setName("Codex Pet");
const accessibilitySettingsUrl =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

function startKeyboardMonitor(): void {
  startGlobalKeyboardActivity(projectRoot, (state) => overlayController.sendAnimation(state));
}

async function getState(): Promise<PetManagerState> {
  const pets = await listProjectPets({ homeDir: homedir(), projectRoot });
  const appliedPet = pets.find((pet) => pet.manifest.id === appliedPetId);

  if (appliedPet === undefined) {
    appliedPetId = pets[0]?.manifest.id ?? null;
  }

  return {
    pets: [...pets],
    appliedPetId,
    overlay: {
      visible: overlayController.isVisible(),
      scale: overlayScale,
    },
    installer: await getInstallerStatus(),
  };
}

function toErrorResult(error: unknown, state?: PetManagerState): PetManagerResult {
  if (error instanceof Error) {
    return { kind: "error", message: error.message, state };
  }

  return { kind: "error", message: "Unknown error", state };
}

async function createWindow(): Promise<void> {
  if (mainWindow !== undefined) {
    focusMainWindow();
    return;
  }

  const { VITE_DEV_SERVER_URL: devServerUrl } = process.env;
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    title: "Codex Pet",
    backgroundColor: "#f6f1e8",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });

  await mainWindow.loadURL(resolveRendererUrl(projectRoot, devServerUrl));
}

function focusMainWindow(): void {
  if (mainWindow === undefined) {
    return;
  }

  mainWindow.show();
  mainWindow.moveTop();
  mainWindow.focus();
  app.focus({ steal: true });
}

async function openAccessibilitySettings(): Promise<void> {
  if (process.platform === "darwin") {
    await shell.openExternal(accessibilitySettingsUrl);
    return;
  }

  throw new Error("macOS only");
}

function createMenuBarItem(): void {
  if (statusTray !== undefined) {
    return;
  }

  statusTray = createStatusTray({
    Menu,
    Tray,
    nativeImage,
    projectRoot,
    openManager: () => {
      void createWindow();
    },
    openAccessibilitySettings: () => {
      void openAccessibilitySettings();
    },
    quit: () => {
      app.quit();
    },
  });
}

async function publishState(): Promise<PetManagerState> {
  const state = await getState();
  mainWindow?.webContents.send(petChannels.stateChanged, state);
  overlayController.sendState(state);
  return state;
}

async function applyPet({ petId }: PetIdRequest): Promise<PetManagerResult> {
  const { VITE_DEV_SERVER_URL: devServerUrl } = process.env;
  await writePetPreferences(app.getPath("userData"), { appliedPetId: petId });
  appliedPetId = petId;
  await overlayController.ensure(overlayScale, devServerUrl);
  overlayController.showInactive();
  overlayController.resize(overlayScale);
  focusMainWindow();

  return { kind: "ready", state: await publishState() };
}

async function installPet({ petId }: InstallPetRequest): Promise<PetManagerResult> {
  await installCodexPet(petId);
  await copyCodexPetToProject(petId, { homeDir: homedir(), projectRoot });
  return applyPet({ petId });
}

async function deletePet({ petId }: PetIdRequest): Promise<PetManagerResult> {
  await deleteProjectPet(petId, { homeDir: homedir(), projectRoot });
  if (appliedPetId === petId) {
    await writePetPreferences(app.getPath("userData"), { appliedPetId: null });
    appliedPetId = null;
    overlayController.hide();
  }

  return { kind: "ready", state: await publishState() };
}

async function setOverlayScale({ scale }: OverlayScaleRequest): Promise<PetManagerResult> {
  overlayScale = clampOverlayScale(scale);
  overlayController.resize(overlayScale);

  return { kind: "ready", state: await publishState() };
}

async function resizeOverlay({ width }: OverlayResizeRequest): Promise<PetManagerResult> {
  overlayScale = resolveOverlayScaleFromWidth(width);
  overlayController.resize(overlayScale);

  return { kind: "ready", state: await publishState() };
}

registerPetIpcHandlers(ipcMain, {
  applyPet,
  deletePet,
  getState,
  installPet,
  moveOverlay: (deltaX, deltaY) => overlayController.moveBy(deltaX, deltaY),
  requestAnimation: (state) => overlayController.sendAnimation(state),
  resizeOverlay,
  setOverlayScale,
  toErrorResult,
});
registerUpdateIpcHandlers(ipcMain, shell);

app.on("before-quit", () => {
  stopGlobalKeyboardActivity();
  overlayController.close();
});

app.on("browser-window-created", (_event, window) => {
  window.webContents.on("did-finish-load", () => {
    void publishState();
  });
});

async function showInitialPet(): Promise<void> {
  const state = await getState();
  if (state.appliedPetId !== null) {
    await applyPet({ petId: state.appliedPetId });
  }
}

async function restorePreferences(): Promise<void> {
  const preferences = await readPetPreferences(app.getPath("userData"));
  appliedPetId = preferences.appliedPetId;
}

async function startApp(): Promise<void> {
  await restorePreferences();
  startKeyboardMonitor();
  createMenuBarItem();
  await createWindow();
  await showInitialPet();
  focusMainWindow();
}

if (process.platform !== "darwin") {
  await app.whenReady();
  await dialog.showMessageBox({
    type: "error",
    title: "macOS only",
    message: "Codex Pet is a MacBook-only app.",
  });
  app.quit();
} else {
  await app.whenReady();
  app.setActivationPolicy("accessory");
  app.dock?.hide();
  await startApp();
  ipcMain.handle(petChannels.openAccessibilitySettings, openAccessibilitySettings);

  app.on("browser-window-focus", () => {
    startKeyboardMonitor();
  });
}

app.on("window-all-closed", () => {
  if (process.platform === "darwin") {
    mainWindow = undefined;
    return;
  }

  app.quit();
});
