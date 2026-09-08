import { Scaling, createElement } from "lucide";
import type { PetManagerResult, PetManagerState } from "../electron/shared/ipc.js";
import {
  type PetAnimationState,
  animationLabels,
  petAnimationStates,
} from "../electron/shared/petAnimation.js";
import { petIdSchema } from "../electron/shared/petManifest.js";
import { mountManagerPages } from "./managerPages.js";
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
    void api.requestAnimation("failed").catch(() => undefined);

    if (result.state !== undefined) {
      renderState(refs, runtime, result.state);
    }
    setStatus(refs, result.message);
    return;
  }

  renderState(refs, runtime, result.state);
}

function renderState(refs: ManagerRefs, runtime: ManagerRuntime, state: PetManagerState): void {
  renderInstallerState(refs, state, runtime);
  runtime.state = state;
  for (const button of refs.animations.querySelectorAll<HTMLButtonElement>("button"))
    button.disabled = !state.overlay.visible || state.appliedPetId === null;
  refs.scale.value = String(state.overlay.scale);
  refs.scaleValue.textContent = `${Math.round(state.overlay.scale * 100)}%`;

  const appliedPet = state.pets.find((pet) => pet.manifest.id === state.appliedPetId);
  const previewPet = state.pets.find((pet) => pet.manifest.id === runtime.previewPetId);
  const displayPet = previewPet ?? appliedPet;
  const isPreviewing = previewPet !== undefined && previewPet.manifest.id !== state.appliedPetId;
  renderPreview(refs, displayPet, isPreviewing ? "Preview Asset" : "Applied Asset");

  if (!runtime.busy && displayPet !== undefined) {
    setStatus(refs, state.overlay.visible ? "적용됨" : "준비됨");
    if (isPreviewing) {
      setStatus(refs, "미리보기 중");
    }
  } else if (!runtime.busy) {
    setStatus(refs, "에셋 없음");
  }

  if (runtime.busy) return;

  refs.list.replaceChildren(
    ...state.pets.map((pet) =>
      createPetCard({
        onApply: (petId) => {
          runtime.previewPetId = petId;
          void runAction(refs, runtime, () => api.applyPet(petId), "적용 중…", false, "waving");
        },
        onDelete: (petId) => {
          void runAction(refs, runtime, () => api.deletePet(petId), "삭제 중…");
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

function renderInstallerState(
  refs: ManagerRefs,
  state: PetManagerState,
  runtime: ManagerRuntime,
): void {
  if (state.installer.npxAvailable) {
    if (refs.input !== null) {
      refs.input.disabled = runtime.busy;
    }
    if (refs.addButton !== null) {
      refs.addButton.disabled = runtime.busy;
    }
    if (refs.installHelp !== null) {
      refs.installHelp.hidden = true;
    }
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
  if (refs.homebrewCommand !== null) {
    refs.homebrewCommand.textContent = state.installer.instructions?.homebrewInstallCommand ?? "";
  }
  if (refs.nodeCommand !== null) {
    refs.nodeCommand.textContent = state.installer.instructions?.nodeInstallCommand ?? "";
  }
}

export function renderManager(root: HTMLElement): void {
  document.documentElement.classList.remove("overlay-mode");
  root.innerHTML = `
    <main class="manager-shell">
      <section class="manager-panel">
        <form class="add-row" data-add-form>
          <input data-pet-id-input placeholder="frieren-full" aria-label="Pet ID" disabled />
          <button type="submit" data-add-button disabled>다운로드</button>
        </form>

        <div class="asset-list" data-asset-list></div>
        <label class="scale-row">
          <span data-scale-icon title="캐릭터 크기"></span>
          <input aria-label="캐릭터 크기" data-scale type="range" min="0.45" max="1" step="0.05" value="0.65" />
          <strong data-scale-value>65%</strong>
        </label>
        <p class="status" data-status role="status" aria-live="polite">상태 확인 중</p>
      </section>
      <section class="preview-panel">
        <div class="preview-artboard">
          <div data-preview-frame class="sprite-frame preview-sprite" role="img"></div>
        </div>
        <div class="preview-meta">
          <p class="path-label" data-preview-label>Applied Asset</p>
          <h2 data-preview-name>선택 없음</h2>
          <p data-preview-description>적용할 에셋을 추가하세요.</p>
          <p class="asset-path" data-preview-path></p>
          <p class="version-info" data-version-info></p>
          <div class="animation-controls" data-animations aria-label="적용된 캐릭터 동작"></div>
          <p class="interaction-help">동작 버튼은 적용된 캐릭터에 반영됩니다. 타이핑: 인사 → 작업 → 검토 → 휴식 / 클릭: 인사 / 더블클릭: 점프 / 드래그: 달리기 / 30초간 반응 없음: 대기. v2는 캐릭터 위 마우스 방향을 바라봅니다.</p>
        </div>
      </section>
    </main>
  `;

  mountManagerPages(root);

  const refs: ManagerRefs = {
    status: query(root, "[data-status]"),
    versionInfo: query(root, "[data-version-info]"),
    animations: query(root, "[data-animations]"),
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
    homebrewCommand: queryOptional(root, "[data-homebrew-command]"),
    nodeCommand: queryOptional(root, "[data-node-command]"),
  };
  const runtime: ManagerRuntime = {
    previewPetId: null,
    busy: false,
    state: null,
    updateDownloadUrl: null,
  };

  query(root, "[data-scale-icon]").append(
    createElement(Scaling, { width: 20, height: 20, "aria-hidden": "true" }),
  );
  for (const animation of petAnimationStates) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = animationLabels[animation];
    button.disabled = true;
    button.addEventListener("click", () => {
      void api.requestAnimation(animation).catch((error) => setStatus(refs, errorMessage(error)));
    });
    refs.animations.append(button);
  }
  query<HTMLButtonElement>(root, "[data-download-node]").addEventListener(
    "click",
    async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      button.textContent = "설치 처리 중…";
      try {
        if (!(await api.downloadNode())) return;
        const result = await api.refreshInstaller();
        if (result.kind === "error" || !result.state.installer.npxAvailable) {
          throw new Error("설치 후 npx를 확인하지 못했습니다. 다시 시도하세요.");
        }
        renderResult(refs, runtime, result);
        setStatus(refs, "Node.js와 npx 설치가 완료되었습니다.");
      } catch (error) {
        setStatus(refs, errorMessage(error));
      } finally {
        button.textContent = "npx 설치";
        button.disabled = false;
      }
    },
  );
  const addForm = queryOptional<HTMLFormElement>(root, "[data-add-form]");
  if (addForm !== null && refs.addButton !== null && refs.input !== null) {
    addForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const parsed = petIdSchema.safeParse(refs.input?.value.trim());
      if (!parsed.success) {
        setStatus(refs, "frieren-full처럼 영문 소문자, 숫자, 하이픈으로 된 pet id를 입력하세요.");
        return;
      }
      void runAction(refs, runtime, () => api.installPet(parsed.data), "다운로드 중…", true);
    });
  }

  refs.scale.addEventListener("input", () => {
    void api
      .setOverlayScale(Number(refs.scale.value))
      .then((result) => renderResult(refs, runtime, result))
      .catch((error) => setStatus(refs, errorMessage(error)));
  });

  api.onStateChanged((state) => renderState(refs, runtime, state));
  void api
    .getState()
    .then((result) => renderResult(refs, runtime, result))
    .catch((error) => setStatus(refs, errorMessage(error)));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다. 다시 시도하세요.";
}

async function runAction(
  refs: ManagerRefs,
  runtime: ManagerRuntime,
  action: () => Promise<PetManagerResult>,
  message: string,
  downloading = false,
  successAnimation?: PetAnimationState,
): Promise<void> {
  if (runtime.busy) return;
  runtime.busy = true;
  if (refs.input !== null) refs.input.disabled = true;
  if (refs.addButton !== null) refs.addButton.disabled = true;
  refs.list.setAttribute("aria-busy", "true");
  for (const button of refs.list.querySelectorAll<HTMLButtonElement>("button"))
    button.disabled = true;
  setStatus(refs, message);
  if (downloading) void api.requestAnimation("running").catch(() => undefined);
  try {
    const result = await action();
    runtime.busy = false;
    renderResult(refs, runtime, result);
    if (result.kind === "ready") {
      if (downloading && refs.input !== null) refs.input.value = "";
      const animation = downloading ? "jumping" : successAnimation;
      if (animation !== undefined) void api.requestAnimation(animation).catch(() => undefined);
    }
  } catch (error) {
    void api.requestAnimation("failed").catch(() => undefined);
    runtime.busy = false;
    if (runtime.state !== null) renderState(refs, runtime, runtime.state);
    setStatus(refs, errorMessage(error));
  } finally {
    runtime.busy = false;
    refs.list.removeAttribute("aria-busy");
    if (runtime.state !== null) renderInstallerState(refs, runtime.state, runtime);
  }
}
