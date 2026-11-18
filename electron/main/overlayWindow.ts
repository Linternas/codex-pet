import { createRequire } from "node:module";
import type electronType from "electron";
import { type AgentSession, agentSessionChannels } from "../shared/agentSessions.js";
import type { AutoWalkDirection, PetManagerState } from "../shared/ipc.js";
import { petChannels } from "../shared/ipc.js";
import {
  type OverlayPosition,
  clampOverlayPosition,
  resolveAutoWalkX,
  resolveOverlayBounds,
} from "../shared/overlay.js";
import type { PetAnimationState } from "../shared/petAnimation.js";
import { resolveRendererUrl } from "./rendererUrl.js";

const require = createRequire(import.meta.url);
const electron: typeof electronType = require("electron");
const { BrowserWindow, screen } = electron;

export type OverlayWindowController = {
  readonly close: () => void;
  readonly ensure: (
    scale: number,
    position: OverlayPosition | undefined,
    devServerUrl: string | undefined,
  ) => Promise<void>;
  readonly keepOnScreen: () => void;
  readonly setClickThrough: (enabled: boolean) => void;
  readonly hide: () => void;
  readonly isVisible: () => boolean;
  readonly moveBy: (deltaX: number, deltaY: number) => OverlayPosition | undefined;
  readonly stepAutoWalk: (
    sender: electronType.WebContents,
    direction: AutoWalkDirection,
  ) => boolean;
  readonly resize: (scale: number) => void;
  readonly sendAgentSessions: (sessions: readonly AgentSession[]) => void;
  readonly sendKeyboardActivity: () => void;
  readonly sendAnimation: (state: PetAnimationState) => void;
  readonly sendState: (state: PetManagerState) => void;
  readonly showInactive: () => void;
};

export type OverlayWindowOptions = {
  readonly preloadPath: string;
  readonly projectRoot: string;
};

export function createOverlayWindowController({
  preloadPath,
  projectRoot,
}: OverlayWindowOptions): OverlayWindowController {
  let overlayWindow: InstanceType<typeof BrowserWindow> | undefined;

  function getWindow(): InstanceType<typeof BrowserWindow> | undefined {
    if (overlayWindow === undefined || overlayWindow.isDestroyed()) {
      return undefined;
    }

    return overlayWindow;
  }

  function keepOnScreen(): void {
    const window = getWindow();
    if (!window) return;
    const bounds = window.getBounds();
    const { x, y } = clampOverlayPosition(bounds, screen.getDisplayMatching(bounds).workArea);
    if (x !== bounds.x || y !== bounds.y) window.setPosition(x, y);
  }

  return {
    keepOnScreen,
    setClickThrough: (enabled) => {
      getWindow()?.setIgnoreMouseEvents(enabled);
    },
    close: () => {
      getWindow()?.close();
    },
    ensure: async (scale, position, devServerUrl) => {
      if (getWindow() !== undefined) {
        return;
      }

      const bounds = resolveOverlayBounds(scale);
      const requested = position && { ...bounds, ...position };
      overlayWindow = new BrowserWindow({
        ...(requested &&
          clampOverlayPosition(requested, screen.getDisplayMatching(requested).workArea)),
        width: bounds.width,
        height: bounds.height,
        show: false,
        frame: false,
        transparent: true,
        resizable: true,
        focusable: false,
        alwaysOnTop: true,
        hasShadow: false,
        skipTaskbar: true,
        backgroundColor: "#00000000",
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      overlayWindow.setFocusable(false);
      overlayWindow.setAlwaysOnTop(true, "floating");
      overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      overlayWindow.on("closed", () => {
        overlayWindow = undefined;
      });

      await overlayWindow.loadURL(resolveRendererUrl(projectRoot, devServerUrl, "overlay"));
    },
    hide: () => {
      getWindow()?.hide();
    },
    isVisible: () => getWindow()?.isVisible() ?? false,
    moveBy: (deltaX, deltaY) => {
      const window = getWindow();
      if (window === undefined) {
        return;
      }

      const position = window.getPosition();
      const x = position[0] ?? 0;
      const y = position[1] ?? 0;
      window.setPosition(Math.round(x + deltaX), Math.round(y + deltaY), false);
      const { x: actualX, y: actualY } = window.getBounds();
      return { x: actualX, y: actualY };
    },
    stepAutoWalk: (sender, direction) => {
      const window = getWindow();
      if (!window?.isVisible() || sender !== window.webContents) return false;

      const bounds = window.getBounds();
      const { workArea } = screen.getDisplayMatching(bounds);
      const x = resolveAutoWalkX(bounds, workArea, direction === "run-left" ? -2 : 2);
      if (x === bounds.x) return false;
      window.setPosition(x, bounds.y, false);
      return true;
    },
    resize: (scale) => {
      const bounds = resolveOverlayBounds(scale);
      getWindow()?.setSize(bounds.width, bounds.height);
      keepOnScreen();
    },
    sendAgentSessions: (sessions) => {
      getWindow()?.webContents.send(agentSessionChannels.changed, sessions);
    },
    sendKeyboardActivity: () => {
      getWindow()?.webContents.send(petChannels.keyboardActivity);
    },
    sendAnimation: (state) => {
      getWindow()?.webContents.send(petChannels.animationRequested, state);
    },
    sendState: (state) => {
      getWindow()?.webContents.send(petChannels.stateChanged, state);
    },
    showInactive: () => {
      getWindow()?.showInactive();
    },
  };
}
