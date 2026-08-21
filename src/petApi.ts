import type { PetManagerResult, PetManagerState } from "../electron/shared/ipc.js";
import { overlayDefaults } from "../electron/shared/overlay.js";

type PetApi = NonNullable<Window["codexPet"]>;

const previewState: PetManagerState = {
  pets: [
    {
      manifest: {
        id: "guga",
        displayName: "咕嘎",
        description:
          "A rounder and cuter chibi penguin hoodie girl pet with a softer face and friendlier proportions.",
        spritesheetPath: "spritesheet.webp",
      },
      spriteUrl: "pets/guga/spritesheet.webp",
    },
  ],
  appliedPetId: "guga",
  overlay: {
    visible: true,
    scale: overlayDefaults.defaultScale,
  },
  installer: {
    npxAvailable: true,
    npxVersion: "preview",
    instructions: null,
  },
};

function ready(state: PetManagerState): PetManagerResult {
  return { kind: "ready", state };
}

export function getPetApi(): PetApi {
  if (window.codexPet !== undefined) {
    return window.codexPet;
  }

  return {
    getState: async () => ready(previewState),
    installPet: async () => ready(previewState),
    deletePet: async () => ready(previewState),
    applyPet: async () => ready(previewState),
    checkForUpdate: async () => ({
      kind: "not-configured",
      message: "CODEX_PET_UPDATE_MANIFEST_URL이 설정되지 않았습니다.",
    }),
    openAccessibilitySettings: async () => undefined,
    openUpdateDownload: async () => undefined,
    setOverlayScale: async (scale: number) => {
      previewState.overlay.scale = scale;
      return ready(previewState);
    },
    resizeOverlay: async (width: number) => {
      previewState.overlay.scale = width / 320;
      return ready(previewState);
    },
    moveOverlay: async () => undefined,
    requestAnimation: async () => undefined,
    onStateChanged: () => () => undefined,
    onAnimationRequested: () => () => undefined,
    onInstallProgress: () => () => undefined,
  };
}
