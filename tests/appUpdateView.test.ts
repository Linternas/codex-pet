// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUpdateState } from "../electron/shared/appUpdate.js";
const mock = vi.hoisted(() => ({
  getAppUpdate: vi.fn(),
  checkAppUpdate: vi.fn(),
  downloadAppUpdate: vi.fn(),
  installAppUpdate: vi.fn(),
  onAppUpdate: vi.fn(),
}));
vi.mock("../src/petApi.js", () => ({ getPetApi: () => mock }));
import { mountAppUpdate } from "../src/appUpdateView.js";
let publish: (state: AppUpdateState) => void;
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
function button() {
  const element = document.querySelector<HTMLButtonElement>("[data-update-action]");
  if (element === null) throw new Error("Missing update button");
  return element;
}
async function mount(state: AppUpdateState) {
  mock.getAppUpdate.mockResolvedValue(state);
  const navigation = document.createElement("nav");
  const history = document.createElement("main");
  document.body.replaceChildren(navigation, history);
  const openHistory = vi.fn();
  mountAppUpdate(navigation, history, openHistory);
  await settle();
  return openHistory;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.onAppUpdate.mockImplementation((callback) => {
    publish = callback;
    return () => undefined;
  });
});
describe("app updater UI", () => {
  it("only exposes download after an update is found, then changes to restart after verification", async () => {
    const open = await mount({ kind: "available", version: "0.0.3" });
    expect(button().textContent).toBe("업데이트 다운로드");
    document.querySelector<HTMLButtonElement>(".update-badge")?.click();
    expect(open).toHaveBeenCalledOnce();
    mock.downloadAppUpdate.mockResolvedValue({
      kind: "downloading",
      version: "0.0.3",
      progress: 0,
    });
    button().click();
    button().click();
    await settle();
    expect(mock.downloadAppUpdate).toHaveBeenCalledOnce();
    publish({ kind: "downloading", version: "0.0.3", progress: 42 });
    expect(document.querySelector("[data-update-detail]")?.textContent).toBe("42%");
    expect(button().disabled).toBe(true);
    publish({ kind: "verifying", version: "0.0.3" });
    expect(button().disabled).toBe(true);
    publish({ kind: "ready", version: "0.0.3" });
    expect(button().textContent).toBe("재시작하여 설치");
    expect(mock.installAppUpdate).not.toHaveBeenCalled();
    mock.installAppUpdate.mockResolvedValue({ kind: "installing" });
    button().click();
    await settle();
    expect(mock.installAppUpdate).toHaveBeenCalledOnce();
  });
  it("keeps the update badge hidden when current or unavailable and exposes retry for errors", async () => {
    await mount({ kind: "current" });
    expect(document.querySelector<HTMLButtonElement>(".update-badge")?.hidden).toBe(true);
    expect(button().textContent).toBe("다시 확인");
    publish({ kind: "error", message: "서명 검증 실패" });
    expect(document.querySelector("[data-update-description]")?.textContent).toBe("서명 검증 실패");
    expect(button().textContent).toBe("다시 시도");
    expect(mock.installAppUpdate).not.toHaveBeenCalled();
    publish({ kind: "unavailable" });
    expect(button().disabled).toBe(true);
  });
  it("does not replace a pushed download state with an older initial snapshot", async () => {
    let resolveState: (state: AppUpdateState) => void = () => undefined;
    mock.getAppUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveState = resolve;
        }),
    );
    const nav = document.createElement("nav");
    const page = document.createElement("main");
    document.body.replaceChildren(nav, page);
    mountAppUpdate(nav, page, () => undefined);
    publish({ kind: "ready", version: "0.0.3" });
    resolveState({ kind: "idle" });
    await settle();
    expect(button().textContent).toBe("재시작하여 설치");
    expect(mock.checkAppUpdate).not.toHaveBeenCalled();
  });
});
