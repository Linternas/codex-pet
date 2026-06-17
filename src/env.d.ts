import type { PetManagerResult, PetManagerState } from "../electron/shared/ipc.js";
import type { PetAnimationState } from "../electron/shared/petAnimation.js";
import type { UpdateCheckResult } from "../electron/shared/update.js";

declare global {
  interface Window {
    readonly codexPet?: {
      readonly getState: () => Promise<PetManagerResult>;
      readonly installPet: (petId: string) => Promise<PetManagerResult>;
      readonly deletePet: (petId: string) => Promise<PetManagerResult>;
      readonly applyPet: (petId: string) => Promise<PetManagerResult>;
      readonly checkForUpdate: () => Promise<UpdateCheckResult>;
      readonly openAccessibilitySettings: () => Promise<void>;
      readonly openUpdateDownload: (downloadUrl: string) => Promise<void>;
      readonly setOverlayScale: (scale: number) => Promise<PetManagerResult>;
      readonly resizeOverlay: (width: number) => Promise<PetManagerResult>;
      readonly moveOverlay: (deltaX: number, deltaY: number) => Promise<void>;
      readonly requestAnimation: (state: PetAnimationState) => Promise<void>;
      readonly onStateChanged: (callback: (state: PetManagerState) => void) => () => void;
      readonly onAnimationRequested: (callback: (state: PetAnimationState) => void) => () => void;
    };
  }
}
