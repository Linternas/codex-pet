/// <reference types="vite/client" />
import type { AppUpdateState } from "../electron/shared/appUpdate.js";
import type { PetManagerResult, PetManagerState } from "../electron/shared/ipc.js";
import type { PetAnimationState } from "../electron/shared/petAnimation.js";
import type { ReleaseHistoryResult } from "../electron/shared/releaseHistory.js";
import type { UpdateCheckResult } from "../electron/shared/update.js";

declare global {
  interface Window {
    readonly codexPet?: {
      readonly getAppUpdate: () => Promise<AppUpdateState>;
      readonly checkAppUpdate: () => Promise<AppUpdateState>;
      readonly downloadAppUpdate: () => Promise<AppUpdateState>;
      readonly installAppUpdate: () => Promise<AppUpdateState>;
      readonly onAppUpdate: (callback: (state: AppUpdateState) => void) => () => void;
      readonly revealKeyboardMonitor: () => Promise<void>;
      readonly getReleaseHistory: () => Promise<ReleaseHistoryResult>;
      readonly refreshInstaller: () => Promise<PetManagerResult>;
      readonly downloadNode: () => Promise<boolean>;
      readonly getState: () => Promise<PetManagerResult>;
      readonly installPet: (petId: string) => Promise<PetManagerResult>;
      readonly deletePet: (petId: string) => Promise<PetManagerResult>;
      readonly applyPet: (petId: string) => Promise<PetManagerResult>;
      readonly checkForUpdate: () => Promise<UpdateCheckResult>;
      readonly getAccessibilityPermission: () => Promise<boolean | null>;
      readonly openAccessibilitySettings: () => Promise<void>;
      readonly openUpdateDownload: (downloadUrl: string) => Promise<void>;
      readonly setOverlayScale: (scale: number) => Promise<PetManagerResult>;
      readonly resizeOverlay: (width: number) => Promise<PetManagerResult>;
      readonly moveOverlay: (deltaX: number, deltaY: number) => Promise<void>;
      readonly requestAnimation: (state: PetAnimationState) => Promise<void>;
      readonly onStateChanged: (callback: (state: PetManagerState) => void) => () => void;
      readonly onKeyboardActivity: (callback: () => void) => () => void;
      readonly onAnimationRequested: (callback: (state: PetAnimationState) => void) => () => void;
    };
  }
}
