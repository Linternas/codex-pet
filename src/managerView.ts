import type { PetManagerState } from "../electron/shared/ipc.js";
import type { UpdateCheckResult } from "../electron/shared/update.js";

export type ManagerRefs = {
  readonly status: HTMLElement;
  readonly input: HTMLInputElement | null;
  readonly addButton: HTMLButtonElement | null;
  readonly list: HTMLElement;
  readonly previewFrame: HTMLElement;
  readonly previewName: HTMLElement;
  readonly previewDescription: HTMLElement;
  readonly previewLabel: HTMLElement;
  readonly previewPath: HTMLElement;
  readonly scale: HTMLInputElement;
  readonly scaleValue: HTMLElement;
  readonly installHelp: HTMLElement | null;
  readonly installerStatus: HTMLElement | null;
  readonly homebrewCommand: HTMLElement | null;
  readonly nodeCommand: HTMLElement | null;
  readonly openAccessibilitySettingsButton: HTMLButtonElement;
  readonly updateCheckButton: HTMLButtonElement | null;
  readonly updateDownloadButton: HTMLButtonElement | null;
  readonly updateStatus: HTMLElement | null;
};

export type ManagerRuntime = {
  previewPetId: string | null;
  updateDownloadUrl: string | null;
};

type PetCardOptions = {
  readonly onApply: (petId: string) => void;
  readonly onDelete: (petId: string) => void;
  readonly onPreview: (petId: string) => void;
  readonly pet: PetManagerState["pets"][number];
  readonly runtime: ManagerRuntime;
  readonly state: PetManagerState;
};

export function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

export function queryOptional<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

export function setStatus(refs: ManagerRefs, message: string): void {
  refs.status.textContent = message;
}

function setSpriteFrame(element: HTMLElement, spriteUrl: string): void {
  element.style.backgroundImage = `url("${spriteUrl}")`;
}

export function renderPreview(
  refs: ManagerRefs,
  pet: PetManagerState["pets"][number] | undefined,
  label: string,
): void {
  refs.previewLabel.textContent = label;
  if (pet === undefined) {
    refs.previewFrame.style.backgroundImage = "";
    refs.previewFrame.removeAttribute("aria-label");
    refs.previewName.textContent = "선택 없음";
    refs.previewDescription.textContent = "적용할 에셋을 추가하세요.";
    refs.previewPath.textContent = "public/pets";
    return;
  }

  setSpriteFrame(refs.previewFrame, pet.spriteUrl);
  refs.previewFrame.setAttribute("aria-label", pet.manifest.displayName);
  refs.previewName.textContent = pet.manifest.displayName;
  refs.previewDescription.textContent = pet.manifest.description;
  refs.previewPath.textContent = `public/pets/${pet.manifest.id}/${pet.manifest.spritesheetPath}`;
}

export function createPetCard(options: PetCardOptions): HTMLElement {
  const { onApply, onDelete, onPreview, pet, runtime, state } = options;
  const card = document.createElement("article");
  card.className = "asset-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  if (pet.manifest.id === state.appliedPetId) {
    card.setAttribute("data-active", "true");
  }
  if (pet.manifest.id === runtime.previewPetId) {
    card.setAttribute("data-previewing", "true");
  }

  const preview = (): void => onPreview(pet.manifest.id);
  card.addEventListener("click", preview);
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    preview();
  });

  const image = document.createElement("div");
  image.className = "sprite-frame card-sprite";
  image.setAttribute("role", "img");
  image.setAttribute("aria-label", pet.manifest.displayName);
  setSpriteFrame(image, pet.spriteUrl);

  const body = document.createElement("div");
  const name = document.createElement("h3");
  name.textContent = pet.manifest.displayName;
  const id = document.createElement("p");
  id.textContent = pet.manifest.id;
  const actions = document.createElement("div");
  actions.className = "asset-actions";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = "적용";
  applyButton.addEventListener("click", (event) => {
    event.stopPropagation();
    onApply(pet.manifest.id);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    onDelete(pet.manifest.id);
  });

  actions.append(applyButton, deleteButton);
  body.append(name, id, actions);
  card.append(image, body);
  return card;
}

export function renderUpdateResult(
  refs: ManagerRefs,
  runtime: ManagerRuntime,
  result: UpdateCheckResult,
): void {
  if (refs.updateDownloadButton === null || refs.updateStatus === null) {
    return;
  }

  runtime.updateDownloadUrl = result.kind === "available" ? result.downloadUrl : null;
  refs.updateDownloadButton.hidden = result.kind !== "available";
  if (result.kind === "available") {
    refs.updateStatus.textContent = `${result.version} 업데이트 가능`;
    return;
  }

  refs.updateStatus.textContent = result.message;
}
