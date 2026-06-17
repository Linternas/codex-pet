import type { PetManagerState } from "../electron/shared/ipc.js";
import {
  type PetAnimationState,
  animationTiming,
  defaultAnimationState,
  resolveAnimationFrameDurationMs,
  resolveAnimationRow,
  resolveDragAnimationState,
  resolveSpritePosition,
} from "../electron/shared/petAnimation.js";
import {
  type VisibleFrameColumns,
  createFallbackVisibleFrameColumns,
  detectVisibleFrameColumns,
} from "./frameDetection.js";
import { getPetApi } from "./petApi.js";

const api = getPetApi();

type OverlayRefs = {
  readonly shell: HTMLElement;
  readonly sprite: HTMLElement;
  readonly grip: HTMLButtonElement;
};

type DragSession = {
  readonly pointerId: number;
  readonly screenX: number;
  readonly screenY: number;
};

type AnimationRuntime = {
  column: number;
  dragState: PetAnimationState | null;
  hover: boolean;
  lastFrameAt: number;
  requestedState: PetAnimationState | null;
  requestedUntil: number;
  state: PetAnimationState;
  spriteUrl: string | null;
  visibleFrameColumns: VisibleFrameColumns;
};

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function resolveRuntimeState(runtime: AnimationRuntime, now: number): PetAnimationState {
  if (runtime.dragState !== null) {
    return runtime.dragState;
  }

  if (runtime.hover) {
    return "jumping";
  }

  if (runtime.requestedState !== null && now <= runtime.requestedUntil) {
    return runtime.requestedState;
  }

  return defaultAnimationState;
}

function paint(refs: OverlayRefs, runtime: AnimationRuntime, now = Date.now()): void {
  const nextState = resolveRuntimeState(runtime, now);
  if (nextState !== runtime.state) {
    runtime.state = nextState;
    runtime.column = 0;
    runtime.lastFrameAt = now;
  }

  const visibleColumns = runtime.visibleFrameColumns[resolveAnimationRow(runtime.state)] ?? [0];
  const actualColumn = visibleColumns[runtime.column % visibleColumns.length] ?? 0;
  const position = resolveSpritePosition(runtime.state, actualColumn);
  refs.sprite.style.backgroundPosition = `${position.x} ${position.y}`;
  refs.sprite.setAttribute("data-animation-state", runtime.state);
}

function renderState(refs: OverlayRefs, runtime: AnimationRuntime, state: PetManagerState): void {
  const pet = state.pets.find((candidate) => candidate.manifest.id === state.appliedPetId);
  if (pet === undefined) {
    refs.sprite.style.backgroundImage = "";
    runtime.spriteUrl = null;
    runtime.visibleFrameColumns = createFallbackVisibleFrameColumns();
    refs.sprite.removeAttribute("aria-label");
    return;
  }

  refs.sprite.style.backgroundImage = `url("${pet.spriteUrl}")`;
  refs.sprite.setAttribute("aria-label", pet.manifest.displayName);
  if (runtime.spriteUrl === pet.spriteUrl) {
    return;
  }

  runtime.spriteUrl = pet.spriteUrl;
  void detectVisibleFrameColumns(pet.spriteUrl).then((visibleFrameColumns) => {
    if (runtime.spriteUrl !== pet.spriteUrl) {
      return;
    }

    runtime.visibleFrameColumns = visibleFrameColumns;
    runtime.column = 0;
    paint(refs, runtime);
  });
}

function requestAnimation(
  refs: OverlayRefs,
  runtime: AnimationRuntime,
  state: PetAnimationState,
): void {
  const now = Date.now();
  runtime.requestedState = state;
  runtime.requestedUntil = now + animationTiming.requestedAnimationDurationMs;
  paint(refs, runtime, now);
}

function bindAnimationTimers(refs: OverlayRefs, runtime: AnimationRuntime): void {
  const tick = (): void => {
    const now = Date.now();
    const state = resolveRuntimeState(runtime, now);
    const frameDurationMs = resolveAnimationFrameDurationMs(state);
    if (state === runtime.state && now - runtime.lastFrameAt >= frameDurationMs) {
      const visibleColumns = runtime.visibleFrameColumns[resolveAnimationRow(state)] ?? [0];
      runtime.column = (runtime.column + 1) % visibleColumns.length;
      runtime.lastFrameAt = now;
    }

    paint(refs, runtime, now);
    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

function bindHover(refs: OverlayRefs, runtime: AnimationRuntime): void {
  refs.shell.addEventListener("pointerenter", () => {
    runtime.hover = true;
    paint(refs, runtime);
  });

  refs.shell.addEventListener("pointerleave", () => {
    runtime.hover = false;
    paint(refs, runtime);
  });
}

function bindDrag(refs: OverlayRefs, runtime: AnimationRuntime): void {
  let dragSession: DragSession | undefined;

  const stopDrag = (event: PointerEvent): void => {
    if (dragSession?.pointerId !== event.pointerId) {
      return;
    }

    dragSession = undefined;
    runtime.dragState = null;
    refs.shell.setAttribute("data-dragging", "false");
    paint(refs, runtime);
  };

  refs.shell.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    if (event.target instanceof Element && event.target.closest("[data-resize-grip]") !== null) {
      return;
    }

    event.preventDefault();
    refs.shell.setPointerCapture(event.pointerId);
    refs.shell.setAttribute("data-dragging", "true");
    dragSession = {
      pointerId: event.pointerId,
      screenX: event.screenX,
      screenY: event.screenY,
    };
  });

  refs.shell.addEventListener("pointermove", (event) => {
    if (dragSession === undefined || dragSession.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.screenX - dragSession.screenX;
    const deltaY = event.screenY - dragSession.screenY;
    dragSession = {
      pointerId: event.pointerId,
      screenX: event.screenX,
      screenY: event.screenY,
    };

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    runtime.dragState = resolveDragAnimationState(deltaX);
    void api.moveOverlay(deltaX, deltaY);
    paint(refs, runtime);
  });

  refs.shell.addEventListener("pointerup", stopDrag);
  refs.shell.addEventListener("pointercancel", stopDrag);
}

function bindResizeGrip(refs: OverlayRefs): void {
  refs.grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    refs.grip.setPointerCapture(event.pointerId);
    refs.grip.setAttribute("data-resizing", "true");
    const startX = event.screenX;
    const startWidth = window.innerWidth;

    const onMove = (moveEvent: PointerEvent): void => {
      const nextWidth = Math.max(144, startWidth + moveEvent.screenX - startX);
      void api.resizeOverlay(nextWidth);
    };

    const onUp = (): void => {
      refs.grip.setAttribute("data-resizing", "false");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

export function renderOverlay(root: HTMLElement): void {
  document.documentElement.classList.add("overlay-mode");
  root.innerHTML = `
    <main class="overlay-shell" data-dragging="false">
      <div data-overlay-sprite class="sprite-frame overlay-sprite" role="img"></div>
      <button data-resize-grip class="resize-grip" type="button" aria-label="Resize"></button>
    </main>
  `;

  const refs: OverlayRefs = {
    shell: query(root, ".overlay-shell"),
    sprite: query(root, "[data-overlay-sprite]"),
    grip: query(root, "[data-resize-grip]"),
  };
  const runtime: AnimationRuntime = {
    column: 0,
    dragState: null,
    hover: false,
    lastFrameAt: Date.now(),
    requestedState: null,
    requestedUntil: 0,
    state: defaultAnimationState,
    spriteUrl: null,
    visibleFrameColumns: createFallbackVisibleFrameColumns(),
  };

  bindAnimationTimers(refs, runtime);
  bindHover(refs, runtime);
  bindDrag(refs, runtime);
  bindResizeGrip(refs);
  paint(refs, runtime);

  api.onAnimationRequested((state) => requestAnimation(refs, runtime, state));
  api.onStateChanged((state) => renderState(refs, runtime, state));
  void api.getState().then((result) => {
    if (result.kind === "ready") {
      renderState(refs, runtime, result.state);
    }
  });
}
