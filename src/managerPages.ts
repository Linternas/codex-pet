import { BookOpen, History, PawPrint, Terminal, createElement } from "lucide";
import currentReleaseNotes from "../docs/releases/v0.0.9.md?raw";
import { appMetadata, formatVersionTag } from "../electron/shared/release.js";
import type { ReleaseHistoryEntry } from "../electron/shared/releaseHistory.js";
import { mountAgentSessionsPage } from "./agentSessionsView.js";
import { mountAppUpdate } from "./appUpdateView.js";
import { getPetApi } from "./petApi.js";

export const permissionGuideSeenKey = "codex-pet:permission-guide-seen:v1";
type ManagerPage = "pets" | "permissions" | "history" | "sessions";

function hasSeenGuide(): boolean {
  try {
    return localStorage.getItem(permissionGuideSeenKey) === "true";
  } catch {
    return false;
  }
}
function rememberGuide(): void {
  try {
    localStorage.setItem(permissionGuideSeenKey, "true");
  } catch {
    /* The guide remains available when storage is disabled. */
  }
}
function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing page element: ${selector}`);
  return element;
}

export function mountManagerPages(root: HTMLElement): void {
  const api = getPetApi();
  root.classList.add("manager-app");
  const petsPage = query<HTMLElement>(root, ".manager-shell");
  petsPage.id = "page-pets";
  const navigation = document.createElement("nav");
  navigation.className = "manager-navigation";
  navigation.setAttribute("aria-label", "앱 메뉴");
  navigation.innerHTML = `
    <span class="navigation-brand">Codex Pet</span>
    <div class="asset-help navigation-catalog">
      <a href="https://codex-pets.net" target="_blank" rel="noreferrer">캐릭터 찾기 ↗</a>
    </div>
    <button type="button" data-page="pets" aria-controls="page-pets">캐릭터</button>
    <button type="button" data-page="sessions" aria-controls="page-sessions">작업 세션</button>
    <button type="button" data-page="permissions" aria-controls="page-permissions">권한 설정</button>
    <button type="button" data-page="history" aria-controls="page-history">버전 히스토리</button>
    <button type="button" class="node-install-button" data-install-help data-download-node title="Node.js와 npx 자동 설치" hidden>npx 설치</button>
  `;
  for (const [page, icon] of [
    ["pets", PawPrint],
    ["sessions", Terminal],
    ["permissions", BookOpen],
    ["history", History],
  ] as const) {
    const button = query(navigation, `[data-page="${page}"]`);
    button.prepend(createElement(icon, { width: 16, height: 16, "aria-hidden": "true" }));
    button.addEventListener("click", () => showPage(page));
  }
  root.prepend(navigation);
  const permissionButton = query<HTMLButtonElement>(navigation, '[data-page="permissions"]');
  const permissionMark = document.createElement("span");
  permissionMark.className = "permission-alert-mark";
  permissionMark.textContent = "!";
  permissionMark.setAttribute("aria-hidden", "true");
  permissionMark.hidden = true;
  permissionButton.append(permissionMark);
  let checkingPermission = false;
  async function refreshPermission(): Promise<void> {
    if (!root.isConnected || document.hidden || checkingPermission) return;
    checkingPermission = true;
    try {
      const granted = await api.getAccessibilityPermission();
      permissionButton.classList.toggle("permission-required", granted === false);
      permissionMark.hidden = granted !== false;
      permissionButton.setAttribute(
        "aria-label",
        granted === false ? "권한 설정: 손쉬운 사용 권한 필요" : "권한 설정",
      );
      permissionButton.title = granted === false ? "손쉬운 사용 권한이 필요합니다" : "";
    } catch {
      // An unavailable check must not be presented as a denied permission.
    } finally {
      checkingPermission = false;
    }
  }
  const permissionTimer = window.setInterval(() => {
    if (!root.isConnected) {
      window.clearInterval(permissionTimer);
      window.removeEventListener("focus", onPermissionFocus);
      return;
    }
    void refreshPermission();
  }, 2500);
  function onPermissionFocus(): void {
    void refreshPermission();
  }
  window.addEventListener("focus", onPermissionFocus);
  window.addEventListener(
    "pagehide",
    () => {
      window.clearInterval(permissionTimer);
      window.removeEventListener("focus", onPermissionFocus);
    },
    { once: true },
  );
  void refreshPermission();

  const permissionsPage = document.createElement("section");
  permissionsPage.id = "page-permissions";
  permissionsPage.className = "manager-page";
  permissionsPage.setAttribute("aria-labelledby", "permissions-heading");
  permissionsPage.innerHTML = `
    <div class="page-content">
      <h2 id="permissions-heading" tabindex="-1">키보드 반응 권한</h2>
      <div class="settings-card">
        <p class="page-intro">다른 앱에서 타이핑할 때 캐릭터가 반응하려면 손쉬운 사용 권한이 필요합니다. 입력한 글자는 저장하지 않습니다.</p>
        <ol class="permission-steps">
          <li><strong>Codex Pet</strong>을 켭니다. 목록에 없으면 <strong>+</strong>로 앱을 추가하세요.</li>
          <li>메모 앱에서 타이핑해 캐릭터가 반응하는지 확인합니다.</li>
        </ol>
        <button class="primary-button" type="button" data-guide-open-settings>손쉬운 사용 설정 열기</button>
      </div>
      <p class="page-feedback" data-guide-feedback role="status" aria-live="polite"></p>
    </div>
  `;

  const historyPage = document.createElement("section");
  historyPage.id = "page-history";
  historyPage.className = "manager-page";
  historyPage.setAttribute("aria-labelledby", "history-heading");
  historyPage.innerHTML = `
    <div class="page-content">
      <h2 id="history-heading" tabindex="-1">버전 히스토리</h2>
      <div data-update-slot></div>
      <div class="history-heading">
        <h3>변경 내역</h3>
        <button type="button" data-refresh-history>새로고침</button>
      </div>
      <p class="page-feedback" data-history-feedback role="status" aria-live="polite"></p>
      <div class="release-history" data-release-history></div>
    </div>
  `;
  const sessionsPage = mountAgentSessionsPage(api);
  root.append(permissionsPage, historyPage, sessionsPage);
  const guideFeedback = query<HTMLElement>(permissionsPage, "[data-guide-feedback]");
  const historyFeedback = query<HTMLElement>(historyPage, "[data-history-feedback]");
  const historyList = query<HTMLElement>(historyPage, "[data-release-history]");
  const refreshButton = query<HTMLButtonElement>(historyPage, "[data-refresh-history]");
  const currentRelease: ReleaseHistoryEntry = {
    version: formatVersionTag(appMetadata.version),
    title: formatVersionTag(appMetadata.version),
    notes: currentReleaseNotes,
    publishedAt: "2026-11-18T00:00:00Z",
    prerelease: false,
  };
  historyList.append(createReleaseCard(currentRelease));
  let historyLoading = false;
  let historyLoaded = false;

  async function loadHistory(): Promise<void> {
    if (historyLoading) return;
    historyLoading = true;
    refreshButton.disabled = true;
    historyList.setAttribute("aria-busy", "true");
    historyFeedback.textContent = "버전 히스토리를 불러오는 중…";
    try {
      const result = await api.getReleaseHistory();
      if (result.kind === "error") {
        historyFeedback.textContent = `${result.message}${historyLoaded ? " 이전에 불러온 기록을 표시합니다." : ""}`;
        return;
      }
      historyList.replaceChildren(
        createReleaseCard(currentRelease),
        ...result.releases
          .filter((release) => release.version.replace(/^v/, "") !== appMetadata.version)
          .map(createReleaseCard),
      );
      historyLoaded = true;
      historyFeedback.textContent =
        result.releases.length === 0 ? "아직 게시된 릴리스가 없습니다." : "";
    } catch {
      historyFeedback.textContent =
        "버전 히스토리를 불러오지 못했습니다. 새로고침으로 다시 시도하세요.";
    } finally {
      historyLoading = false;
      refreshButton.disabled = false;
      historyList.removeAttribute("aria-busy");
    }
  }

  function showPage(page: ManagerPage, focus = true): void {
    petsPage.hidden = page !== "pets";
    permissionsPage.hidden = page !== "permissions";
    historyPage.hidden = page !== "history";
    sessionsPage.hidden = page !== "sessions";
    for (const button of navigation.querySelectorAll<HTMLButtonElement>("[data-page]")) {
      if (button.getAttribute("data-page") === page) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (page === "pets") rememberGuide();
    if (page === "history" && !historyLoaded) void loadHistory();
    if (focus) {
      const heading =
        page === "pets"
          ? query<HTMLElement>(petsPage, "[data-preview-name]")
          : query<HTMLElement>(
              page === "permissions"
                ? permissionsPage
                : page === "sessions"
                  ? sessionsPage
                  : historyPage,
              "h2",
            );
      heading.tabIndex = -1;
      heading.focus();
    }
  }
  refreshButton.addEventListener("click", () => {
    void loadHistory();
  });

  async function guideAction(
    button: HTMLButtonElement,
    action: () => Promise<void>,
  ): Promise<void> {
    button.disabled = true;
    guideFeedback.textContent = "";
    try {
      await action();
    } catch (error) {
      guideFeedback.textContent =
        error instanceof Error ? error.message : "열지 못했습니다. 다시 시도하세요.";
    } finally {
      button.disabled = false;
    }
  }
  const settingsButton = query<HTMLButtonElement>(permissionsPage, "[data-guide-open-settings]");
  settingsButton.addEventListener("click", () => {
    void guideAction(settingsButton, () => api.openAccessibilitySettings());
  });
  mountAppUpdate(navigation, query<HTMLElement>(historyPage, "[data-update-slot]"), () =>
    showPage("history"),
  );
  const initialPage = new URLSearchParams(window.location.search).get("page");
  showPage(
    initialPage === "sessions" ? "sessions" : hasSeenGuide() ? "pets" : "permissions",
    false,
  );
  const stop = api.onShowAgentSessions(() => showPage("sessions"));
  window.addEventListener("pagehide", stop, { once: true });
}

function createReleaseCard(release: ReleaseHistoryEntry): HTMLElement {
  const card = document.createElement("article");
  card.className = "release-card";
  const heading = document.createElement("h3");
  heading.textContent = release.title;
  const metadata = document.createElement("p");
  metadata.className = "release-meta";
  const current = release.version.replace(/^v/, "") === appMetadata.version;
  const version = release.title === release.version ? "" : `${release.version} · `;
  metadata.textContent = `${version}${new Date(release.publishedAt).toLocaleDateString("ko-KR")}${current ? " · 현재 앱 버전" : ""}${release.prerelease ? " · 사전 릴리스" : ""}`;
  const notes = document.createElement("p");
  notes.className = "release-notes";
  notes.textContent =
    release.notes
      .trim()
      .replace(/^#{1,6}[ \t]+/gm, "")
      .replace(/^[ \t]*[-*][ \t]+/gm, "• ")
      .replace(/\*\*([^*\n]+)\*\*/g, "$1") || "등록된 변경 내용이 없습니다.";
  card.append(heading, metadata, notes);
  return card;
}
