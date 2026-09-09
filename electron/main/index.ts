import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import type electronType from "electron";
import { appUpdateChannels } from "../shared/appUpdate.js";
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
  type PetView,
  copyCodexPetToProject,
  deleteProjectPet,
  initializePetStorage,
  installCodexPet,
  listProjectPets,
  resolvePetPaths,
} from "../shared/petAssets.js";
import { readPetPreferences, writePetPreferences } from "../shared/userPreferences.js";
import { getInstallerStatus } from "./installerStatus.js";
import {
  getKeyboardPermission,
  startGlobalKeyboardActivity,
  stopGlobalKeyboardActivity,
} from "./keyboardActivity.js";
import { installNodeRuntime } from "./nodeRuntimeInstaller.js";
import { createOverlayWindowController } from "./overlayWindow.js";
import { registerPetIpcHandlers } from "./petIpc.js";
import { getReleaseHistory } from "./releaseHistoryService.js";
import { resolveRendererUrl } from "./rendererUrl.js";
import { registerSparkleUpdater } from "./sparkleUpdater.js";
import { type StatusTray, createStatusTray } from "./statusTray.js";
import { registerUpdateIpcHandlers } from "./updateIpc.js";

const require = createRequire(import.meta.url);
const electron: typeof electronType = require("electron");
const { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, shell, protocol, net } =
  electron;
const projectRoot = process.cwd();
const assetOptions = () => ({
  homeDir: homedir(),
  projectRoot,
  petsRoot: join(app.getPath("userData"), "pets"),
});
let cachedPets: readonly PetView[] | undefined;
const preloadPath = join(projectRoot, "electron-preload.cjs");
let mainWindow: InstanceType<typeof BrowserWindow> | undefined;
let nodeInstallRequest: Promise<boolean> | undefined;
let nodeConfirmationOpen = false;
let statusTray: StatusTray | undefined;
let appliedPetId: string | null = null;
let overlayScale: number = overlayDefaults.defaultScale;
const overlayController = createOverlayWindowController({ preloadPath, projectRoot });
app.setName("Codex Pet");
const accessibilitySettingsUrl =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

function startKeyboardMonitor(): void {
  startGlobalKeyboardActivity(projectRoot, () => overlayController.sendKeyboardActivity());
}

async function getState(): Promise<PetManagerState> {
  const pets = cachedPets ?? (await listProjectPets(assetOptions()));
  cachedPets = pets;
  const appliedPet = pets.find((pet) => pet.manifest.id === appliedPetId);

  if (appliedPet === undefined) {
    appliedPetId = null;
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
    skipTaskbar: true,
    backgroundColor: "#f6f1e8",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "https://codex-pets.net/" || url === "https://codex-pets.net") {
      void shell.openExternal(url).catch((error: unknown) => {
        dialog.showErrorBox("브라우저를 열지 못했습니다", String(error));
      });
    }
    return { action: "deny" };
  });

  // Keep no background settings window for macOS app activation to raise.
  // Native installation sheets must remain attached until the user dismisses them.
  mainWindow.on("blur", () => {
    const window = mainWindow;
    setTimeout(() => {
      if (window && !window.isDestroyed() && !window.isFocused() && !nodeConfirmationOpen)
        window.hide();
    }, 100);
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

  app.focus({ steal: true });
  mainWindow.show();
  mainWindow.moveTop();
  mainWindow.focus();
  if (process.platform === "darwin") app.dock?.hide();
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
  const state = await getState();
  if (!state.pets.some((pet) => pet.manifest.id === petId))
    throw new Error("캐릭터를 찾을 수 없습니다.");
  await writePetPreferences(app.getPath("userData"), { appliedPetId: petId });
  appliedPetId = petId;
  await overlayController.ensure(overlayScale, devServerUrl);
  overlayController.showInactive();
  overlayController.resize(overlayScale);

  return { kind: "ready", state: await publishState() };
}

async function installPet({ petId }: InstallPetRequest): Promise<PetManagerResult> {
  if ((await getState()).pets.some((pet) => pet.manifest.id === petId))
    throw new Error("이미 다운로드한 캐릭터입니다.");
  await installCodexPet(petId);
  await copyCodexPetToProject(petId, assetOptions());
  cachedPets = undefined;
  return applyPet({ petId });
}

async function deletePet({ petId }: PetIdRequest): Promise<PetManagerResult> {
  await deleteProjectPet(petId, assetOptions());
  cachedPets = undefined;
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
  refreshInstaller: async () => {
    await getInstallerStatus(true);
    return { kind: "ready", state: await publishState() };
  },
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
  if (appliedPetId === null) appliedPetId = (await getState()).pets[0]?.manifest.id ?? null;
}

async function startApp(): Promise<void> {
  await initializePetStorage(assetOptions());
  protocol.handle("pet-asset", async (request) => {
    try {
      const url = new URL(request.url);
      if (url.pathname !== "/spritesheet.webp") return new Response(null, { status: 404 });
      const path = resolvePetPaths(url.hostname, assetOptions()).projectSpritePath;
      return new Response(await readFile(path), {
        headers: {
          "Content-Type": "image/webp",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  await restorePreferences();
  startKeyboardMonitor();
  createMenuBarItem();
  await showInitialPet();
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
  ipcMain.handle(petChannels.openAccessibilitySettings, openAccessibilitySettings);
  ipcMain.handle(petChannels.getAccessibilityPermission, () => getKeyboardPermission());
  ipcMain.handle(petChannels.getReleaseHistory, () =>
    getReleaseHistory((url, options) => net.fetch(url, options)),
  );
  ipcMain.handle(petChannels.revealKeyboardMonitor, async () => {
    const helperPath = join(projectRoot, "dist-native", "Codex Pet Keyboard Monitor.app");
    try {
      await access(helperPath);
    } catch {
      throw new Error("키보드 도우미를 찾지 못했습니다. 앱을 다시 설치한 후 시도하세요.");
    }
    shell.showItemInFolder(helperPath);
  });
  ipcMain.handle(petChannels.downloadNode, () => {
    nodeInstallRequest ??= (async () => {
      const options: electronType.MessageBoxOptions = {
        type: "question",
        title: "Node.js 및 npx 설치",
        message: "캐릭터 다운로드에 필요한 Node.js와 npx를 설치할까요?",
        detail:
          "Node.js 공식 사이트에서 파일을 다운로드하여 앱 전용 폴더에 설치합니다.\n\n설치 위치: ~/Library/Application Support/Codex Pet/runtime\n\n기존 Node.js와 시스템 설정은 변경하지 않습니다.",
        buttons: ["취소", "설치"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      };
      nodeConfirmationOpen = true;
      const { response } = await (mainWindow && !mainWindow.isDestroyed()
        ? dialog.showMessageBox(mainWindow, options)
        : dialog.showMessageBox(options)
      ).finally(() => {
        nodeConfirmationOpen = false;
      });
      if (response !== 1) return false;
      await installNodeRuntime();
      return true;
    })().finally(() => {
      nodeInstallRequest = undefined;
    });
    return nodeInstallRequest;
  });

  registerSparkleUpdater(app, ipcMain, (state) => {
    mainWindow?.webContents.send(appUpdateChannels.changed, state);
  });
  await startApp();
}

app.on("window-all-closed", () => {
  if (process.platform === "darwin") {
    mainWindow = undefined;
    return;
  }

  app.quit();
});
