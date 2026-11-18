// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodeInstallInstructions } from "../electron/shared/installer.js";
import type { PetManagerState } from "../electron/shared/ipc.js";

const pet = {
  manifest: {
    id: "frieren-full",
    displayName: "Frieren",
    description: "An elf",
    spritesheetPath: "spritesheet.webp" as const,
    spriteVersionNumber: 2 as const,
  },
  spriteUrl: "pet-asset://frieren-full/spritesheet.webp",
};
let state: PetManagerState;
let listener: (value: PetManagerState) => void;
let api: NonNullable<Window["codexPet"]>;
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
function button(selector: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(selector);
  if (element === null) throw new Error(`Missing ${selector}`);
  return element;
}
async function render() {
  const { renderManager } = await import("../src/manager.js");
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  renderManager(root);
  await settle();
}
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  state = {
    pets: [],
    appliedPetId: null,
    overlay: { visible: false, scale: 0.65, autoWalk: false, clickThrough: false },
    installer: { npxAvailable: true, npxVersion: "10.0.0", instructions: null },
  };
  api = {
    getAppUpdate: vi.fn(async () => ({ kind: "current" as const })),
    checkAppUpdate: vi.fn(async () => ({ kind: "current" as const })),
    downloadAppUpdate: vi.fn(async () => ({ kind: "downloading" as const })),
    installAppUpdate: vi.fn(async () => ({ kind: "installing" as const })),
    onAppUpdate: vi.fn(() => () => undefined),
    revealKeyboardMonitor: vi.fn(async () => undefined),
    getReleaseHistory: vi.fn(async () => ({ kind: "ready" as const, releases: [] })),
    getState: vi.fn(async () => ({ kind: "ready" as const, state })),
    installPet: vi.fn(async () => {
      state = {
        ...state,
        pets: [pet],
        appliedPetId: pet.manifest.id,
        overlay: { ...state.overlay, visible: true },
      };
      return { kind: "ready" as const, state };
    }),
    deletePet: vi.fn(async () => {
      state = {
        ...state,
        pets: [],
        appliedPetId: null,
        overlay: { ...state.overlay, visible: false },
      };
      return { kind: "ready" as const, state };
    }),
    applyPet: vi.fn(async () => ({ kind: "ready" as const, state })),
    setOverlayScale: vi.fn(async () => ({ kind: "ready" as const, state })),
    resizeOverlay: vi.fn(async () => ({ kind: "ready" as const, state })),
    refreshInstaller: vi.fn(async () => {
      state = {
        ...state,
        installer: { npxAvailable: true, npxVersion: "11.0.0", instructions: null },
      };
      return { kind: "ready" as const, state };
    }),
    downloadNode: vi.fn(async () => true),
    setAutoWalk: vi.fn(async (enabled: boolean) => {
      state.overlay.autoWalk = enabled;
      return { kind: "ready", state };
    }),
    stepAutoWalk: vi.fn(async () => false),
    onShowAgentSessions: vi.fn(() => () => undefined),
    openAgentSessions: vi.fn(async () => undefined),
    getAgentSessions: vi.fn(async () => []),
    onAgentSessions: vi.fn(() => () => undefined),
    configureAgentHooks: vi.fn(async () => undefined),
    moveOverlay: vi.fn(async () => undefined),
    getAccessibilityPermission: vi.fn(async () => true),
    openAccessibilitySettings: vi.fn(async () => undefined),
    checkForUpdate: vi.fn(async () => ({
      kind: "not-configured" as const,
      message: "Not enabled",
    })),
    openUpdateDownload: vi.fn(async () => undefined),
    requestAnimation: vi.fn(async () => undefined),
    onKeyboardActivity: vi.fn(() => () => undefined),
    onAnimationRequested: vi.fn(() => () => undefined),
    onStateChanged: vi.fn((callback) => {
      listener = callback;
      return () => undefined;
    }),
  };
  Object.defineProperty(window, "codexPet", { value: api, configurable: true });
});

describe("pet manager user flows", () => {
  it("saves the auto-walk toggle in either direction", async () => {
    await render();
    const toggle = document.querySelector<HTMLInputElement>("[data-auto-walk]");
    if (toggle === null) throw new Error("missing auto-walk toggle");

    expect(toggle.checked).toBe(false);
    toggle.click();
    await settle();
    expect(api.setAutoWalk).toHaveBeenLastCalledWith(true);
    expect(toggle.checked).toBe(true);
    toggle.click();
    await settle();
    expect(api.setAutoWalk).toHaveBeenLastCalledWith(false);
    expect(toggle.checked).toBe(false);
  });

  it("downloads a typed pet ID, lists its version and deletes the downloaded pet", async () => {
    await render();
    const input = document.querySelector<HTMLInputElement>("[data-pet-id-input]");
    if (input === null) throw new Error("missing input");
    input.value = "frieren-full";
    button("[data-add-button]").click();
    expect(button("[data-add-button]").disabled).toBe(true);
    await settle();
    expect(api.installPet).toHaveBeenCalledWith("frieren-full");
    expect(api.requestAnimation).toHaveBeenNthCalledWith(1, "running");
    expect(api.requestAnimation).toHaveBeenLastCalledWith("jumping");
    expect(document.querySelector(".version-badge")?.textContent).toBe("v2");
    expect(document.querySelector<HTMLElement>(".card-sprite")?.style.backgroundSize).toBe(
      "800% 1100%",
    );
    expect(document.querySelector("[data-version-info]")?.textContent).toContain("16방향");
    expect(input.value).toBe("");
    button(".danger-button").click();
    await settle();
    expect(api.deletePet).toHaveBeenCalledWith("frieren-full");
    expect(document.querySelectorAll(".asset-card")).toHaveLength(0);
  });
  it("greets after applying a character successfully", async () => {
    state = { ...state, pets: [pet], appliedPetId: pet.manifest.id };
    await render();
    button(".asset-actions button").click();
    await settle();
    expect(api.applyPet).toHaveBeenCalledWith(pet.manifest.id);
    expect(api.requestAnimation).toHaveBeenLastCalledWith("waving");
  });
  it("installs Node+npx and re-enables downloads without manual rechecking", async () => {
    state.installer = {
      npxAvailable: false,
      npxVersion: null,
      instructions: nodeInstallInstructions,
    };
    await render();
    expect(button("[data-add-button]").disabled).toBe(true);
    expect(document.querySelector<HTMLElement>("[data-install-help]")?.hidden).toBe(false);
    expect(document.querySelector("#page-pets [data-install-help]")).toBeNull();
    expect(document.querySelector(".manager-navigation [data-download-node]")).not.toBeNull();
    button("[data-download-node]").click();
    await settle();
    expect(api.downloadNode).toHaveBeenCalledOnce();
    expect(api.refreshInstaller).toHaveBeenCalledOnce();
    expect(button("[data-add-button]").disabled).toBe(false);
    expect(document.querySelector<HTMLElement>("[data-install-help]")?.hidden).toBe(true);
  });
  it("keeps the installer UI unchanged when installation confirmation is cancelled", async () => {
    state.installer = {
      npxAvailable: false,
      npxVersion: null,
      instructions: nodeInstallInstructions,
    };
    vi.mocked(api.downloadNode).mockResolvedValue(false);
    await render();
    button("[data-download-node]").click();
    await settle();
    expect(api.refreshInstaller).not.toHaveBeenCalled();
    expect(button("[data-download-node]").disabled).toBe(false);
    expect(button("[data-add-button]").disabled).toBe(true);
    expect(document.querySelector("[data-status]")?.textContent).not.toContain("완료");
  });
  it("rejects invalid input without invoking the installer", async () => {
    await render();
    const input = document.querySelector<HTMLInputElement>("[data-pet-id-input]");
    if (input === null) throw new Error("missing input");
    input.value = "../../bad; open";
    button("[data-add-button]").click();
    expect(api.installPet).not.toHaveBeenCalled();
    expect(document.querySelector("[data-status]")?.textContent).toContain("pet id");
  });
  it("preserves a download error when the IPC response also includes state", async () => {
    state.pets = [pet];
    state.appliedPetId = pet.manifest.id;
    vi.mocked(api.installPet).mockResolvedValue({
      kind: "error",
      message: "다운로드 실패: 연결 없음",
      state,
    });
    await render();
    const input = document.querySelector<HTMLInputElement>("[data-pet-id-input]");
    if (input === null) throw new Error("missing input");
    input.value = "missing-pet";
    button("[data-add-button]").click();
    await settle();
    expect(document.querySelector("[data-status]")?.textContent).toBe("다운로드 실패: 연결 없음");
    expect(api.requestAnimation).toHaveBeenLastCalledWith("failed");
    expect(api.requestAnimation).not.toHaveBeenCalledWith("jumping");
    expect(button("[data-add-button]").disabled).toBe(false);
  });
  it("does not re-enable downloads or replace progress during an in-flight download", async () => {
    let finish: (() => void) | undefined;
    vi.mocked(api.installPet).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ kind: "ready", state });
        }),
    );
    await render();
    const input = document.querySelector<HTMLInputElement>("[data-pet-id-input]");
    if (input === null) throw new Error("missing input");
    input.value = "frieren-full";
    button("[data-add-button]").click();
    listener(state);
    expect(button("[data-add-button]").disabled).toBe(true);
    expect(document.querySelector("[data-status]")?.textContent).toBe("다운로드 중…");
    finish?.();
    await settle();
    expect(button("[data-add-button]").disabled).toBe(false);
  });
  it("exposes all nine animations, a Lucide size icon and the accessibility API", async () => {
    state = {
      ...state,
      pets: [pet],
      appliedPetId: pet.manifest.id,
      overlay: { visible: true, scale: 0.65, autoWalk: false, clickThrough: false },
    };
    await render();
    expect(document.querySelectorAll("[data-animations] button")).toHaveLength(9);
    expect(document.querySelector("[data-scale]")).toBeNull();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-animations] button")];
    buttons.find((element) => element.textContent === "검토")?.click();
    expect(api.requestAnimation).toHaveBeenCalledWith("review");
    expect(document.querySelector("[data-open-accessibility-settings]")).toBeNull();
    expect(api.checkForUpdate).not.toHaveBeenCalled();
  });
});

describe("onboarding and history pages", () => {
  it("opens the work sessions page from its navigation tab", async () => {
    await render();
    const sessionsPage = document.querySelector<HTMLElement>("#page-sessions");
    const sessionsTab = button('[data-page="sessions"]');
    expect(sessionsPage?.hidden).toBe(true);

    sessionsTab.click();

    expect(sessionsPage?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("#page-permissions")?.hidden).toBe(true);
    expect(sessionsTab.getAttribute("aria-current")).toBe("page");
    expect(document.activeElement?.id).toBe("sessions-heading");
    button("[data-connect=codex]").click();
    expect(api.configureAgentHooks).toHaveBeenCalledWith("codex", true);
    await settle();

    button('[data-page="pets"]').click();
    expect(sessionsPage?.hidden).toBe(true);
  });

  it("shows the guide on first use, persists dismissal and lets users reopen it", async () => {
    await render();
    expect(document.querySelector<HTMLElement>("#page-permissions")?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("#page-pets")?.hidden).toBe(true);
    expect(api.getReleaseHistory).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".permission-steps li")).toHaveLength(3);
    expect(document.querySelector(".manager-navigation .asset-help a")?.getAttribute("href")).toBe(
      "https://codex-pets.net",
    );
    expect(document.querySelector("#page-pets .asset-help")).toBeNull();
    button('[data-page="pets"]').click();
    expect(document.querySelector<HTMLElement>("#page-pets")?.hidden).toBe(false);
    await render();
    expect(document.querySelector<HTMLElement>("#page-pets")?.hidden).toBe(false);
    button('[data-page="permissions"]').click();
    expect(document.querySelector<HTMLElement>("#page-permissions")?.hidden).toBe(false);
    expect(document.activeElement?.id).toBe("permissions-heading");
  });
  it("marks missing permission in the header and clears it after returning from settings", async () => {
    vi.mocked(api.getAccessibilityPermission).mockResolvedValue(false);
    await render();
    const header = button('[data-page="permissions"]');
    expect(header.classList.contains("permission-required")).toBe(true);
    expect(header.getAttribute("aria-label")).toContain("권한 필요");
    expect(document.querySelector("[data-open-accessibility-settings]")).toBeNull();
    vi.mocked(api.getAccessibilityPermission).mockResolvedValue(true);
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(header.classList.contains("permission-required")).toBe(false);
    vi.mocked(api.getAccessibilityPermission).mockResolvedValue(null);
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(header.classList.contains("permission-required")).toBe(false);
  });
  it("opens settings without requiring a separate keyboard helper permission", async () => {
    await render();
    button("[data-guide-open-settings]").click();
    await settle();
    expect(api.openAccessibilitySettings).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-reveal-keyboard-monitor]")).toBeNull();
    expect(api.revealKeyboardMonitor).not.toHaveBeenCalled();
    expect(document.querySelector("[data-guide-feedback]")?.textContent).toBe("");
    vi.mocked(api.openAccessibilitySettings).mockRejectedValue(
      new Error("설정을 열지 못했습니다."),
    );
    button("[data-guide-open-settings]").click();
    await settle();
    expect(document.querySelector("[data-guide-feedback]")?.textContent).toContain(
      "열지 못했습니다",
    );
    expect(button("[data-guide-open-settings]").disabled).toBe(false);
  });
  it("loads releases only on opening history and renders remote notes as text", async () => {
    vi.mocked(api.getReleaseHistory).mockResolvedValue({
      kind: "ready",
      releases: [
        {
          version: "v0.0.1",
          title: "First release",
          notes: '<img src=x onerror="alert(1)">',
          publishedAt: "2026-06-17T07:55:14Z",
          prerelease: false,
        },
      ],
    });
    await render();
    button('[data-page="history"]').click();
    await settle();
    expect(api.getReleaseHistory).toHaveBeenCalledOnce();
    expect(document.querySelector(".release-meta")?.textContent).toContain("현재 앱 버전");
    expect(document.querySelectorAll(".release-notes")[1]?.textContent).toContain("<img");
    expect(document.querySelector(".release-notes img")).toBeNull();
    expect(api.checkForUpdate).not.toHaveBeenCalled();
    expect(api.openUpdateDownload).not.toHaveBeenCalled();
    button('[data-page="pets"]').click();
    button('[data-page="history"]').click();
    await settle();
    expect(api.getReleaseHistory).toHaveBeenCalledOnce();
  });
  it("supports retry after a history failure and preserves entered pet ID across navigation", async () => {
    vi.mocked(api.getReleaseHistory).mockResolvedValueOnce({
      kind: "error",
      message: "인터넷 연결을 확인하세요.",
    });
    await render();
    button('[data-page="pets"]').click();
    const input = document.querySelector<HTMLInputElement>("[data-pet-id-input]");
    if (input === null) throw new Error("missing input");
    input.value = "frieren-full";
    button('[data-page="history"]').click();
    await settle();
    expect(document.querySelector("[data-history-feedback]")?.textContent).toContain("인터넷 연결");
    button("[data-refresh-history]").click();
    await settle();
    expect(document.querySelector("[data-history-feedback]")?.textContent).toBe(
      "아직 게시된 릴리스가 없습니다.",
    );
    button('[data-page="pets"]').click();
    expect(input.value).toBe("frieren-full");
  });
});
