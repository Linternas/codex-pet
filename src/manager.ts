import type { PetManagerResult, PetManagerState } from "../electron/shared/ipc.js";
import { appMetadata, formatVersionTag } from "../electron/shared/release.js";
import {
  type ManagerRefs,
  type ManagerRuntime,
  createPetCard,
  query,
  queryOptional,
  renderPreview,
  setStatus,
} from "./managerView.js";
import { getPetApi } from "./petApi.js";

const api = getPetApi();

function renderResult(refs: ManagerRefs, runtime: ManagerRuntime, result: PetManagerResult): void {
  if (result.kind === "error") {
    void api.requestAnimation("failed");
    setStatus(refs, result.message);
    if (result.state !== undefined) {
      renderState(refs, runtime, result.state);
    }
    return;
  }

  renderState(refs, runtime, result.state);
}

function renderState(refs: ManagerRefs, runtime: ManagerRuntime, state: PetManagerState): void {
  renderInstallerState(refs, state);
  refs.scale.value = String(state.overlay.scale);
  refs.scaleValue.textContent = `${Math.round(state.overlay.scale * 100)}%`;

  const appliedPet = state.pets.find((pet) => pet.manifest.id === state.appliedPetId);
  const previewPet = state.pets.find((pet) => pet.manifest.id === runtime.previewPetId);
  const displayPet = previewPet ?? appliedPet;
  const isPreviewing = previewPet !== undefined && previewPet.manifest.id !== state.appliedPetId;
  renderPreview(refs, displayPet, isPreviewing ? "Preview Asset" : "Applied Asset");

  if (displayPet !== undefined) {
    setStatus(refs, state.overlay.visible ? "적용됨" : "준비됨");
    if (isPreviewing) {
      setStatus(refs, "미리보기 중");
    }
  } else {
    setStatus(refs, "에셋 없음");
  }

  refs.list.replaceChildren(
    ...state.pets.map((pet) =>
      createPetCard({
        onApply: (petId) => {
          runtime.previewPetId = petId;
          void api.applyPet(petId).then((result) => renderResult(refs, runtime, result));
        },
        onDelete: (petId) => {
          void api.deletePet(petId).then((result) => renderResult(refs, runtime, result));
        },
        onPreview: (petId) => {
          runtime.previewPetId = petId;
          renderState(refs, runtime, state);
        },
        pet,
        runtime,
        state,
      }),
    ),
  );
}

function renderInstallerState(refs: ManagerRefs, state: PetManagerState): void {
  if (state.installer.npxAvailable) {
    if (refs.input !== null) {
      refs.input.disabled = false;
    }
    if (refs.addButton !== null) {
      refs.addButton.disabled = false;
    }
    if (refs.installHelp !== null) {
      refs.installHelp.hidden = true;
    }
    refs.installerStatus.textContent = `npx ${state.installer.npxVersion} 확인됨`;
    return;
  }

  if (refs.input !== null) {
    refs.input.disabled = true;
  }
  if (refs.addButton !== null) {
    refs.addButton.disabled = true;
  }
  if (refs.installHelp !== null) {
    refs.installHelp.hidden = false;
  }
  refs.installerStatus.textContent = "npx가 없어 에셋을 추가할 수 없습니다.";
  if (refs.homebrewCommand !== null) {
    refs.homebrewCommand.textContent = state.installer.instructions.homebrewInstallCommand;
  }
  if (refs.nodeCommand !== null) {
    refs.nodeCommand.textContent = state.installer.instructions.nodeInstallCommand;
  }
}

export function renderManager(root: HTMLElement): void {
  document.documentElement.classList.remove("overlay-mode");
  root.innerHTML = `
    <main class="manager-shell">
      <section class="manager-panel">
        <div>
          <p class="eyebrow">MacBook App</p>
          <h1>Codex Pet</h1>
          <p class="app-version" data-app-version>${formatVersionTag(appMetadata.version)}</p>
        </div>
      <!-- v0.0.2: 검색 영역
      <form class="add-row" data-add-form>
        <input data-pet-id-input placeholder="guga" aria-label="Pet ID" />
        <button type="submit" data-add-button>추가</button>
      </form>
      -->
        <!-- v0.0.2: 검색 후 다운로드 안내
        <div class="asset-help">
          <a href="https://codex-pets.net" target="_blank" rel="noreferrer">codex-pets.net</a>
          <span>에서 pet id를 찾고, 앱에서 추가하면 <code>npx --yes codex-pets add</code>로 받습니다.</span>
        </div>
        -->
        <p class="installer-status" data-installer-status>npx 확인 중</p>
        <!-- v0.0.2: Node.js 설치 안내 비활성화
        <div class="install-help" data-install-help hidden>
          <strong>Node.js 설치가 필요합니다.</strong>
          <p>터미널에서 아래 순서대로 실행한 뒤 앱을 다시 열어주세요.</p>
          <code data-homebrew-command></code>
          <code data-node-command></code>
        </div>
        -->
        <button type="button" class="accessibility-button" data-open-accessibility-settings>
          접근성 권한 열기
        </button>
        <div class="asset-list" data-asset-list></div>
        <label class="scale-row">
          <span>크기</span>
          <input data-scale type="range" min="0.45" max="1" step="0.05" value="0.65" />
          <strong data-scale-value>65%</strong>
        </label>
        <!-- v0.0.2: 최신 버전 확인 후 다운로드
        <div class="update-row">
          <button type="button" data-update-check-button>업데이트 확인</button>
          <button type="button" data-update-download-button hidden>업데이트</button>
        </div>
        <p class="update-status" data-update-status>최신 버전 확인 전</p>
        -->
        <p class="status" data-status>상태 확인 중</p>
      </section>
      <section class="preview-panel">
        <div class="preview-artboard">
          <div data-preview-frame class="sprite-frame preview-sprite" role="img"></div>
        </div>
        <div class="preview-meta">
          <p class="path-label" data-preview-label>Applied Asset</p>
          <h2 data-preview-name>선택 없음</h2>
          <p data-preview-description>적용할 에셋을 추가하세요.</p>
          <p class="asset-path" data-preview-path>public/pets</p>
        </div>
      </section>
    </main>
  `;

  const refs: ManagerRefs = {
    status: query(root, "[data-status]"),
    input: queryOptional(root, "[data-pet-id-input]"),
    addButton: queryOptional(root, "[data-add-button]"),
    list: query(root, "[data-asset-list]"),
    previewFrame: query(root, "[data-preview-frame]"),
    previewName: query(root, "[data-preview-name]"),
    previewDescription: query(root, "[data-preview-description]"),
    previewLabel: query(root, "[data-preview-label]"),
    previewPath: query(root, "[data-preview-path]"),
    scale: query(root, "[data-scale]"),
    scaleValue: query(root, "[data-scale-value]"),
    installHelp: queryOptional(root, "[data-install-help]"),
    installerStatus: query(root, "[data-installer-status]"),
    homebrewCommand: queryOptional(root, "[data-homebrew-command]"),
    nodeCommand: queryOptional(root, "[data-node-command]"),
    openAccessibilitySettingsButton: query(root, "[data-open-accessibility-settings]"),
  };
  const runtime: ManagerRuntime = {
    previewPetId: null,
    updateDownloadUrl: null,
  };

  const addForm = queryOptional<HTMLFormElement>(root, "[data-add-form]");
  if (addForm !== null && refs.addButton !== null && refs.input !== null) {
    addForm.addEventListener("submit", (event) => {
      event.preventDefault();
      refs.addButton.disabled = true;
      setStatus(refs, "추가 중");
      void api.requestAnimation("running");
      void api
        .installPet(refs.input.value.trim())
        .then((result) => renderResult(refs, runtime, result))
        .finally(() => {
          if (refs.addButton !== null) {
            refs.addButton.disabled = false;
          }
        });
    });
  }

  refs.openAccessibilitySettingsButton.addEventListener("click", () => {
    void api.openAccessibilitySettings();
    setStatus(refs, "접근성 권한 설정으로 이동했습니다.");
  });

  refs.scale.addEventListener("input", () => {
    void api
      .setOverlayScale(Number(refs.scale.value))
      .then((result) => renderResult(refs, runtime, result));
  });

  api.onStateChanged((state) => renderState(refs, runtime, state));
  void api.getState().then((result) => renderResult(refs, runtime, result));
}
