import { access, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { Server } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import type electronType from "electron";
import { z } from "zod";
import {
  type AgentSession,
  agentProviderSchema,
  agentSessionChannels,
} from "../shared/agentSessions.js";
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
import {
  type PetPreferences,
  defaultPetPreferences,
  readPetPreferences,
  writePetPreferences,
} from "../shared/userPreferences.js";
import {
  configureAgentHooks,
  startAgentSessionReceiver,
  updateAgentSessions,
} from "./agentSessions.js";
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
const {
  BrowserWindow,
  Menu,
  Tray,
  app,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  protocol,
  net,
  screen,
} = electron;
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
let sessionReceiver: Server | undefined;
let agentSessions: AgentSession[] = [];
let statusTray: StatusTray | undefined;
let preferences: PetPreferences = { ...defaultPetPreferences };
let placementToSave: Pick<Partial<PetPreferences>, "overlayScale" | "overlayPosition"> = {};
let placementTimer: ReturnType<typeof setTimeout> | undefined;
let quitting = false;
let pendingPreferencesWrite = Promise.resolve();

function updatePreferences(patch: Partial<PetPreferences>): Promise<void> {
  const update = pendingPreferencesWrite.then(async () => {
    const next = { ...preferences, ...patch };
    await writePetPreferences(app.getPath("userData"), next);
    preferences = next;
  });
  pendingPreferencesWrite = update.catch(() => undefined);
  return update;
}
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
  const appliedPet = pets.find((pet) => pet.manifest.id === preferences.appliedPetId);

  if (appliedPet === undefined) {
    preferences.appliedPetId = null;
  }

  return {
    pets: [...pets],
    appliedPetId: preferences.appliedPetId,
    overlay: {
      visible: overlayController.isVisible(),
      scale: overlayScale,
      autoWalk: preferences.autoWalk,
      clickThrough: preferences.clickThrough,
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

async function createWindow(page?: "sessions"): Promise<void> {
  if (mainWindow !== undefined) {
    focusMainWindow();
    if (page === "sessions") {
      const { webContents } = mainWindow;
      const showSessions = () => {
        if (!webContents.isDestroyed()) webContents.send(agentSessionChannels.showPage);
      };
      if (webContents.isLoadingMainFrame()) webContents.once("did-finish-load", showSessions);
      else showSessions();
    }
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

  const url = new URL(resolveRendererUrl(projectRoot, devServerUrl));
  if (page) url.searchParams.set("page", page);
  await mainWindow.loadURL(url.toString());
  if (page) focusMainWindow();
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

function savePlacement(): void {
  clearTimeout(placementTimer);
  placementTimer = undefined;
  if (Object.keys(placementToSave).length === 0) return;
  const patch = placementToSave;
  placementToSave = {};
  void updatePreferences(patch).catch(console.error);
}

function schedulePlacementSave(patch: typeof placementToSave): void {
  placementToSave = { ...placementToSave, ...patch };
  clearTimeout(placementTimer);
  placementTimer = setTimeout(savePlacement, 250);
}

function movePet(x: number, y: number): void {
  if (preferences.clickThrough) return;
  const position = overlayController.moveTo(x, y);
  if (position) schedulePlacementSave({ overlayPosition: position });
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
    petReady: () => preferences.appliedPetId !== null,
    petVisible: overlayController.isVisible,
    autoWalk: () => preferences.autoWalk,
    clickThrough: () => preferences.clickThrough,
    toggleVisibility: () => {
      if (overlayController.isVisible()) overlayController.hide();
      else {
        overlayController.keepOnScreen();
        overlayController.showInactive();
      }
      void publishState().catch(console.error);
    },
    toggleAutoWalk: () => {
      void setAutoWalk(!preferences.autoWalk).catch(console.error);
    },
    toggleClickThrough: () => {
      void updatePreferences({ clickThrough: !preferences.clickThrough })
        .then(() => {
          overlayController.setClickThrough(preferences.clickThrough);
          return publishState();
        })
        .catch(console.error)
        .finally(() => statusTray?.refresh());
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
  statusTray?.refresh();
  mainWindow?.webContents.send(petChannels.stateChanged, state);
  overlayController.sendState(state);
  return state;
}

async function setAutoWalk(enabled: boolean): Promise<PetManagerResult> {
  await updatePreferences({ autoWalk: enabled });
  return { kind: "ready", state: await publishState() };
}

async function applyPet({ petId }: PetIdRequest): Promise<PetManagerResult> {
  const { VITE_DEV_SERVER_URL: devServerUrl } = process.env;
  const state = await getState();
  if (!state.pets.some((pet) => pet.manifest.id === petId))
    throw new Error("캐릭터를 찾을 수 없습니다.");
  await updatePreferences({ appliedPetId: petId });
  await overlayController.ensure(overlayScale, preferences.overlayPosition, devServerUrl);
  overlayController.setClickThrough(preferences.clickThrough);
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
  if (preferences.appliedPetId === petId) {
    await updatePreferences({ appliedPetId: null });
    overlayController.hide();
  }

  return { kind: "ready", state: await publishState() };
}

async function setOverlayScale({ scale }: OverlayScaleRequest): Promise<PetManagerResult> {
  overlayScale = clampOverlayScale(scale);
  overlayController.resize(overlayScale);
  schedulePlacementSave({ overlayScale });

  return { kind: "ready", state: await publishState() };
}

async function resizeOverlay({ width }: OverlayResizeRequest): Promise<PetManagerResult> {
  return setOverlayScale({ scale: resolveOverlayScaleFromWidth(width) });
}

registerPetIpcHandlers(ipcMain, {
  applyPet,
  deletePet,
  getState,
  installPet,
  setAutoWalk,
  stepAutoWalk: (sender) => (preferences.autoWalk ? overlayController.stepAutoWalk(sender) : null),
  moveOverlayTo: movePet,
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

app.on("before-quit", (event) => {
  if (!quitting) {
    event.preventDefault();
    quitting = true;
    savePlacement();
    void pendingPreferencesWrite.finally(() => app.quit());
    return;
  }
  sessionReceiver?.close();
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
  preferences = await readPetPreferences(app.getPath("userData"));
  overlayScale = preferences.overlayScale;
  if (preferences.appliedPetId === null) {
    preferences.appliedPetId = (await getState()).pets[0]?.manifest.id ?? null;
  }
}

function publishAgentSessions(): void {
  mainWindow?.webContents.send(agentSessionChannels.changed, agentSessions);
  overlayController.sendAgentSessions(agentSessions);
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
  const receiverDir = join(app.getPath("userData"), ".agents");
  const receiverPath = join(receiverDir, "events.sock");
  try {
    await mkdir(receiverDir, { recursive: true, mode: 0o700 });
    sessionReceiver = await startAgentSessionReceiver(receiverPath, (event) => {
      if (!preferences.agentProviders[event.provider]) return;
      agentSessions = updateAgentSessions(agentSessions, event);
      publishAgentSessions();
    });
  } catch (error) {
    console.error("Codex Pet session receiver unavailable", error);
  }
  ipcMain.handle(agentSessionChannels.get, () => agentSessions);
  ipcMain.handle(agentSessionChannels.connections, () => preferences.agentProviders);
  ipcMain.handle(agentSessionChannels.open, () => createWindow("sessions"));
  ipcMain.handle(agentSessionChannels.configure, async (event, payload: unknown) => {
    if (event.sender !== mainWindow?.webContents)
      throw new Error("Invalid session settings sender");
    const { provider, enabled } = z
      .object({
        provider: agentProviderSchema,
        enabled: z.boolean(),
      })
      .parse(payload);
    if (enabled && !sessionReceiver) throw new Error("세션 연결을 시작할 수 없습니다.");
    if (!enabled) {
      await updatePreferences({
        agentProviders: { ...preferences.agentProviders, [provider]: false },
      });
      agentSessions = agentSessions.filter((session) => session.provider !== provider);
      publishAgentSessions();
    }
    await configureAgentHooks(
      provider,
      enabled,
      process.execPath,
      join(projectRoot, "scripts", "session-hook.cjs"),
      receiverPath,
    );
    if (enabled)
      await updatePreferences({
        agentProviders: { ...preferences.agentProviders, [provider]: true },
      });
  });
  startKeyboardMonitor();
  createMenuBarItem();
  screen.on("display-removed", overlayController.keepOnScreen);
  screen.on("display-metrics-changed", overlayController.keepOnScreen);
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
