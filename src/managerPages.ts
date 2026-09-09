import { BookOpen, History, PawPrint, createElement } from "lucide";
import currentReleaseNotes from "../docs/releases/v0.0.3.md?raw";
import { appMetadata, formatVersionTag } from "../electron/shared/release.js";
import type { ReleaseHistoryEntry } from "../electron/shared/releaseHistory.js";
import { mountAppUpdate } from "./appUpdateView.js";
import { getPetApi } from "./petApi.js";

export const permissionGuideSeenKey = "codex-pet:permission-guide-seen:v1";
type ManagerPage = "pets" | "permissions" | "history";

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
    <span class="navigation-brand">Codex Pet

          <p class="app-version" data-app-version>${formatVersionTag(appMetadata.version)}</p>
    </span>
    <div class="asset-help navigation-catalog">
      <a href="https://codex-pets.net" target="_blank" rel="noreferrer">codex-pets.net에서 캐릭터 찾기</a>
    </div>
    <button type="button" data-page="pets" aria-controls="page-pets">캐릭터</button>
    <button type="button" data-page="permissions" aria-controls="page-permissions">권한 설정</button>
    <button type="button" data-page="history" aria-controls="page-history">버전 히스토리</button>
    <button type="button" class="node-install-button" data-install-help data-download-node title="Node.js와 npx 자동 설치" hidden>npx 설치</button>
  `;
  for (const [page, icon] of [
    ["pets", PawPrint],
    ["permissions", BookOpen],
    ["history", History],
  ] as const) {
    query(navigation, `[data-page="${page}"]`).prepend(
      createElement(icon, { width: 16, height: 16, "aria-hidden": "true" }),
    );
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
      <h2 id="permissions-heading" tabindex="-1">키보드에 반응하도록 설정하기</h2>
      <p class="page-intro">다른 앱에서 키보드를 누를 때 캐릭터가 인사하려면 macOS의 손쉬운 사용 권한이 필요합니다. 입력한 글자는 저장하지 않습니다.</p>
      <div class="guide-note">권한을 설정하지 않아도 캐릭터 표시, 클릭, 드래그와 동작 버튼은 사용할 수 있습니다.</div>
      <ol class="permission-steps">
        <li><h3>시스템 설정 열기</h3>
          <p><strong>시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용</strong>으로 이동하세요.</p>
          <button type="button" data-guide-open-settings>손쉬운 사용 설정 열기</button>
        </li>
        <li><h3>Codex Pet 권한 켜기</h3>
          <p>목록에서 <strong>Codex Pet</strong> 옆 스위치를 켜세요.</p>
          <p class="step-detail">목록에 없다면 아래 <strong>+</strong>를 눌러 설치한 <strong>Codex Pet.app</strong>을 추가하세요.</p>
        </li>
        <li><h3>캐릭터 반응 확인하기</h3>
          <p>앱으로 돌아와 캐릭터를 적용하고 메모 앱 등에서 글자를 입력하세요. 캐릭터가 인사하면 설정이 완료된 것입니다.</p>
          <p class="step-detail">반응이 없으면 권한 스위치를 확인하고 상단 상태바 메뉴에서 앱을 종료한 뒤 다시 실행하세요.</p>
        </li>
      </ol>
      <p class="page-feedback" data-guide-feedback role="status" aria-live="polite"></p>
    </div>
  `;

  const historyPage = document.createElement("section");
  historyPage.id = "page-history";
  historyPage.className = "manager-page";
  historyPage.setAttribute("aria-labelledby", "history-heading");
  historyPage.innerHTML = `
    <div class="page-content">
      <p class="eyebrow">업데이트 기록</p>
      <h2 id="history-heading" tabindex="-1">버전 히스토리</h2>
      <p class="page-intro">현재 앱 <strong>${formatVersionTag(appMetadata.version)}</strong> · GitHub에 게시된 최근 100개 릴리스의 변경 내용을 확인하세요.</p>
      <div class="page-actions"><button type="button" data-refresh-history>새로고침</button></div>
      <p class="page-feedback" data-history-feedback role="status" aria-live="polite"></p>
      <div class="release-history" data-release-history></div>
    </div>
  `;
  root.append(permissionsPage, historyPage);
  const guideFeedback = query<HTMLElement>(permissionsPage, "[data-guide-feedback]");
  const historyFeedback = query<HTMLElement>(historyPage, "[data-history-feedback]");
  const historyList = query<HTMLElement>(historyPage, "[data-release-history]");
  const refreshButton = query<HTMLButtonElement>(historyPage, "[data-refresh-history]");
  const currentRelease: ReleaseHistoryEntry = {
    version: formatVersionTag(appMetadata.version),
    title: formatVersionTag(appMetadata.version),
    notes: currentReleaseNotes,
    publishedAt: "2026-09-09T00:00:00Z",
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
        result.releases.length === 0
          ? "아직 게시된 릴리스가 없습니다."
          : `${result.releases.length}개 릴리스 · 최신 게시순`;
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
    for (const button of navigation.querySelectorAll<HTMLButtonElement>("[data-page]")) {
      if (button.getAttribute("data-page") === page) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (page === "pets") rememberGuide();
    if (page === "history" && !historyLoaded) void loadHistory();
    if (focus) {
      const heading =
        page === "pets"
          ? petsPage
          : query<HTMLElement>(page === "permissions" ? permissionsPage : historyPage, "h2");
      heading.tabIndex = -1;
      heading.focus();
    }
  }
  for (const page of ["pets", "permissions", "history"] as const) {
    query(navigation, `[data-page="${page}"]`).addEventListener("click", () => showPage(page));
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
  mountAppUpdate(navigation, query<HTMLElement>(historyPage, ".page-content"), () =>
    showPage("history"),
  );
  showPage(hasSeenGuide() ? "pets" : "permissions", false);
}

function createReleaseCard(release: ReleaseHistoryEntry): HTMLElement {
  const card = document.createElement("article");
  card.className = "release-card";
  const heading = document.createElement("h3");
  heading.textContent = release.title;
  const metadata = document.createElement("p");
  metadata.className = "release-meta";
  const current = release.version.replace(/^v/, "") === appMetadata.version;
  metadata.textContent = `${release.version} · ${new Date(release.publishedAt).toLocaleDateString("ko-KR")}${current ? " · 현재 앱 버전" : ""}${release.prerelease ? " · 사전 릴리스" : ""}`;
  const notes = document.createElement("p");
  notes.className = "release-notes";
  notes.textContent = release.notes.trim() || "등록된 변경 내용이 없습니다.";
  card.append(heading, metadata, notes);
  return card;
}
