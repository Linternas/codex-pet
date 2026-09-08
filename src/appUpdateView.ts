import { ArrowDownToLine, RefreshCw, Sparkles, createElement } from "lucide";
import type { AppUpdateState } from "../electron/shared/appUpdate.js";
import { appMetadata, formatVersionTag } from "../electron/shared/release.js";
import { getPetApi } from "./petApi.js";

export function mountAppUpdate(
  navigation: HTMLElement,
  historyContent: HTMLElement,
  openHistory: () => void,
): void {
  const api = getPetApi();
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "update-badge";
  badge.hidden = true;
  badge.append(createElement(ArrowDownToLine, { width: 20, height: 20, "aria-hidden": "true" }));
  badge.addEventListener("click", openHistory);
  navigation.append(badge);
  const panel = document.createElement("section");
  panel.className = "app-update-panel";
  panel.setAttribute("aria-label", "앱 업데이트");
  panel.innerHTML = `
    <div class="update-heading"><span data-update-icon></span><div><p class="eyebrow">앱 업데이트</p><h3 data-update-title>업데이트 확인</h3></div></div>
    <p class="update-description" data-update-description role="status" aria-live="polite"></p>
    <div class="update-versions"><span>현재 버전 <strong>${formatVersionTag(appMetadata.version)}</strong></span><span data-update-latest hidden>최신 버전 <strong></strong></span></div>
    <progress data-update-progress max="100" hidden aria-label="업데이트 다운로드 진행률"></progress>
    <div class="update-actions"><button type="button" class="primary-button" data-update-action>업데이트 확인</button><span data-update-detail></span></div>
  `;
  historyContent.prepend(panel);
  const element = <T extends HTMLElement>(selector: string): T => {
    const match = panel.querySelector<T>(selector);
    if (match === null) throw new Error(`Missing update element ${selector}`);
    return match;
  };
  const title = element("[data-update-title]");
  const description = element("[data-update-description]");
  const latest = element("[data-update-latest]");
  const progress = element<HTMLProgressElement>("[data-update-progress]");
  const button = element<HTMLButtonElement>("[data-update-action]");
  const detail = element("[data-update-detail]");
  element("[data-update-icon]").append(
    createElement(Sparkles, { width: 24, height: 24, "aria-hidden": "true" }),
  );
  let state: AppUpdateState = { kind: "idle" };
  function render(next: AppUpdateState): void {
    state = next;
    panel.setAttribute("data-state", state.kind);
    const hasUpdate = ["available", "downloading", "verifying", "ready", "installing"].includes(
      state.kind,
    );
    badge.hidden = !hasUpdate;
    const badgeLabel = state.kind === "ready" ? "업데이트 설치 준비 완료" : "앱 업데이트";
    badge.setAttribute("aria-label", badgeLabel);
    badge.title = badgeLabel;
    latest.hidden = !state.version;
    element("[data-update-latest] strong").textContent = state.version
      ? formatVersionTag(state.version.replace(/^v/, ""))
      : "";
    progress.hidden = state.kind !== "downloading";
    if (state.progress === undefined) progress.removeAttribute("value");
    else progress.value = state.progress;
    button.disabled = [
      "unavailable",
      "checking",
      "downloading",
      "verifying",
      "installing",
      "installed",
    ].includes(state.kind);
    button.replaceChildren();
    const labels: Record<AppUpdateState["kind"], [string, string, string]> = {
      idle: [
        "새 버전을 확인하세요",
        "업데이트가 있으면 여기에서 다운로드할 수 있습니다.",
        "업데이트 확인",
      ],
      unavailable: [
        "앱 업데이트",
        state.message ?? "설치한 앱에서 업데이트를 확인할 수 있습니다.",
        "업데이트 확인",
      ],
      checking: ["새 버전 확인 중", "", "확인 중…"],
      current: ["최신 버전을 사용 중입니다", "", "다시 확인"],
      available: [
        "새 버전이 준비되었습니다",
        "다운로드가 끝나면 재시작하여 설치할 수 있습니다.",
        "업데이트 다운로드",
      ],
      downloading: ["업데이트 다운로드 중", "캐릭터는 계속 사용할 수 있습니다.", "다운로드 중…"],
      verifying: [
        "업데이트 확인 중",
        "다운로드한 파일을 검증하고 설치를 준비합니다.",
        "설치 준비 중…",
      ],
      ready: [
        "업데이트 설치 준비 완료",
        "재시작하면 새 버전이 적용됩니다. 캐릭터와 설정은 유지됩니다.",
        "재시작하여 설치",
      ],
      installing: ["새 버전으로 재시작 중", "", "설치 중…"],
      installed: ["업데이트 완료", "", "설치 완료"],
      error: [
        "업데이트를 완료하지 못했습니다",
        state.message ?? "인터넷 연결을 확인한 뒤 다시 시도하세요.",
        "다시 시도",
      ],
    };
    const copy = labels[state.kind];
    title.textContent = copy[0];
    description.textContent = copy[1];
    button.append(
      createElement(state.kind === "available" ? ArrowDownToLine : RefreshCw, {
        width: 16,
        height: 16,
        "aria-hidden": "true",
      }),
      document.createTextNode(copy[2]),
    );
    detail.textContent =
      state.kind === "downloading" && state.progress !== undefined
        ? `${Math.floor(state.progress)}%`
        : state.kind === "available"
          ? "설치는 다운로드 후 선택할 수 있습니다."
          : "";
  }
  async function action(): Promise<void> {
    const kind = state.kind;
    button.disabled = true;
    try {
      render(
        await (kind === "available"
          ? api.downloadAppUpdate()
          : kind === "ready"
            ? api.installAppUpdate()
            : api.checkAppUpdate()),
      );
    } catch {
      render({ kind: "error", message: "업데이트 요청을 처리하지 못했습니다. 다시 시도하세요." });
    }
  }
  button.addEventListener("click", () => {
    void action();
  });
  let receivedEvent = false;
  api.onAppUpdate((next) => {
    receivedEvent = true;
    render(next);
  });
  render(state);
  void api
    .getAppUpdate()
    .then(async (next) => {
      if (receivedEvent) return;
      render(next);
      if (next.kind === "idle") render(await api.checkAppUpdate());
    })
    .catch(() => render({ kind: "error", message: "업데이트 상태를 불러오지 못했습니다." }));
}
