import { createRequire } from "node:module";
import type electronType from "electron";
import type { PetManagerState } from "../shared/ipc.js";
import { petChannels } from "../shared/ipc.js";
import { resolveOverlayBounds } from "../shared/overlay.js";
import type { PetAnimationState } from "../shared/petAnimation.js";
import { resolveRendererUrl } from "./rendererUrl.js";

const require = createRequire(import.meta.url);
const electron: typeof electronType = require("electron");
const { BrowserWindow } = electron;

export type OverlayWindowController = {
  readonly close: () => void;
  readonly ensure: (scale: number, devServerUrl: string | undefined) => Promise<void>;
  readonly hide: () => void;
  readonly isVisible: () => boolean;
  readonly moveBy: (deltaX: number, deltaY: number) => void;
  readonly resize: (scale: number) => void;
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

  return {
    close: () => {
      getWindow()?.close();
    },
    ensure: async (scale, devServerUrl) => {
      if (getWindow() !== undefined) {
        return;
      }

      const bounds = resolveOverlayBounds(scale);
      overlayWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
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
    },
    resize: (scale) => {
      const bounds = resolveOverlayBounds(scale);
      getWindow()?.setSize(bounds.width, bounds.height);
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
