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
    autoWalk: false,
    clickThrough: false,
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
    openAgentSessions: async () => undefined,
    onShowAgentSessions: () => () => undefined,
    getAgentConnections: async () => ({ codex: false, claude: false }),
    getAgentSessions: async () => [],
    configureAgentHooks: async () => {
      throw new Error("macOS 앱에서 세션을 연결하세요.");
    },
    onAgentSessions: () => () => undefined,
    getAppUpdate: async () => ({
      kind: "unavailable",
      message: "설치한 앱에서 업데이트를 확인할 수 있습니다.",
    }),
    checkAppUpdate: async () => ({ kind: "unavailable" }),
    downloadAppUpdate: async () => ({ kind: "unavailable" }),
    installAppUpdate: async () => ({ kind: "unavailable" }),
    onAppUpdate: () => () => undefined,
    revealKeyboardMonitor: async () => {
      throw new Error("키보드 도우미 찾기는 macOS 앱에서 사용할 수 있습니다.");
    },
    getReleaseHistory: async () => ({
      kind: "error",
      message: "버전 히스토리는 macOS 앱에서 확인하세요.",
    }),
    refreshInstaller: async () => ready(previewState),
    downloadNode: async () => {
      throw new Error("Node.js 자동 설치는 macOS 앱에서 실행하세요.");
    },
    getState: async () => ready(previewState),
    installPet: async () => ready(previewState),
    deletePet: async () => ready(previewState),
    applyPet: async () => ready(previewState),
    checkForUpdate: async () => ({
      kind: "not-configured",
      message: "CODEX_PET_UPDATE_MANIFEST_URL이 설정되지 않았습니다.",
    }),
    getAccessibilityPermission: async () => null,
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
    setAutoWalk: async (enabled) => {
      previewState.overlay.autoWalk = enabled;
      return ready(previewState);
    },
    stepAutoWalk: async () => null,
    moveOverlayTo: async () => undefined,
    requestAnimation: async () => undefined,
    onStateChanged: () => () => undefined,
    onKeyboardActivity: () => () => undefined,
    onAnimationRequested: () => () => undefined,
  };
}
