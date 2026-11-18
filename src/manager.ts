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
  refs.autoWalk.checked = state.overlay.autoWalk;
  for (const button of refs.animations.querySelectorAll<HTMLButtonElement>("button"))
    button.disabled = !state.overlay.visible || state.appliedPetId === null;

  const appliedPet = state.pets.find((pet) => pet.manifest.id === state.appliedPetId);
  const previewPet = state.pets.find((pet) => pet.manifest.id === runtime.previewPetId);
  const displayPet = previewPet ?? appliedPet;
  const isPreviewing = previewPet !== undefined && previewPet.manifest.id !== state.appliedPetId;
  renderPreview(refs, displayPet, isPreviewing);

  if (!runtime.busy) setStatus(refs, "");

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
}

export function renderManager(root: HTMLElement): void {
  document.documentElement.classList.remove("overlay-mode");
  root.innerHTML = `
    <main class="manager-shell">
      <section class="manager-panel" aria-label="캐릭터 목록">
        <form class="add-row" data-add-form>
          <input data-pet-id-input placeholder="frieren-full" aria-label="Pet ID" disabled />
          <button type="submit" data-add-button disabled>다운로드</button>
        </form>

        <p class="status" data-status role="status" aria-live="polite">불러오는 중…</p>
        <div class="asset-list" data-asset-list></div>
      </section>
      <section class="preview-panel">
        <div class="preview-artboard">
          <div data-preview-frame class="sprite-frame preview-sprite" role="img"></div>
        </div>
        <div class="preview-meta">
          <div class="preview-heading">
            <h2 data-preview-name>선택한 캐릭터 없음</h2>
            <span class="preview-marker" data-preview-label hidden>미리보기</span>
          </div>
          <label class="auto-walk-setting"><input type="checkbox" data-auto-walk disabled /> 자동 산책</label>
          <details class="character-actions">
            <summary>적용된 캐릭터 동작</summary>
            <div class="animation-controls" data-animations aria-label="적용된 캐릭터 동작"></div>
          </details>
        </div>
      </section>
    </main>
  `;

  mountManagerPages(root);

  const refs: ManagerRefs = {
    status: query(root, "[data-status]"),
    animations: query(root, "[data-animations]"),
    autoWalk: query(root, "[data-auto-walk]"),
    input: queryOptional(root, "[data-pet-id-input]"),
    addButton: queryOptional(root, "[data-add-button]"),
    list: query(root, "[data-asset-list]"),
    previewFrame: query(root, "[data-preview-frame]"),
    previewName: query(root, "[data-preview-name]"),
    previewLabel: query(root, "[data-preview-label]"),
    installHelp: queryOptional(root, "[data-install-help]"),
  };
  const runtime: ManagerRuntime = {
    previewPetId: null,
    busy: false,
    state: null,
    updateDownloadUrl: null,
  };

  refs.autoWalk.addEventListener("change", async () => {
    const enabled = refs.autoWalk.checked;
    refs.autoWalk.disabled = true;
    try {
      const result = await api.setAutoWalk(enabled);
      if (result.kind === "error") {
        refs.autoWalk.checked =
          result.state?.overlay.autoWalk ?? runtime.state?.overlay.autoWalk ?? false;
        setStatus(refs, result.message);
      } else {
        renderState(refs, runtime, result.state);
      }
    } catch (error) {
      refs.autoWalk.checked = runtime.state?.overlay.autoWalk ?? false;
      setStatus(refs, errorMessage(error));
    } finally {
      refs.autoWalk.disabled = false;
    }
  });

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

  api.onStateChanged((state) => renderState(refs, runtime, state));
  void api
    .getState()
    .then((result) => {
      renderResult(refs, runtime, result);
      refs.autoWalk.disabled = runtime.state === null;
    })
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
