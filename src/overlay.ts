import { MoveDiagonal2, createElement } from "lucide";
import {
  type AgentSession,
  agentProviderLabels,
  agentStatusLabels,
} from "../electron/shared/agentSessions.js";
import type { AutoWalkDirection, PetManagerState } from "../electron/shared/ipc.js";
import {
  type KeyboardAnimationActivity,
  recordKeyboardActivity,
  resolveKeyboardAnimation,
} from "../electron/shared/keyboardAnimation.js";
import {
  type PetAnimationState,
  animationTiming,
  defaultAnimationState,
  resolveAnimationFrameDurationMs,
  resolveAnimationRow,
  resolveDragAnimationState,
  resolveLookPosition,
  resolveRestAnimation,
  resolveSpriteGrid,
  resolveSpritePosition,
} from "../electron/shared/petAnimation.js";
import type { PetView } from "../electron/shared/petAssets.js";
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
  readonly outgoingSprite: HTMLElement;
  readonly grip: HTMLButtonElement;
  readonly session: HTMLButtonElement;
  readonly sessionProvider: HTMLElement;
  readonly sessionStatus: HTMLElement;
  readonly sessionTask: HTMLElement;
};

type DragSession = {
  readonly pointerId: number;
  readonly screenX: number;
  readonly screenY: number;
};

type AnimationRuntime = {
  autoWalk: boolean;
  clickThrough: boolean;
  agentState: "review" | "running" | null;
  walkState: AutoWalkDirection | null;
  keyboard: KeyboardAnimationActivity;
  column: number;
  version: number;
  lookDirection: number;
  lastActivityAt: number;
  frameDurationMs: number;
  dragState: PetAnimationState | null;
  hover: boolean;
  lastFrameAt: number;
  requestedState: PetAnimationState | null;
  requestedUntil: number;
  state: PetAnimationState;
  spriteUrl: string | null;
  requestedSpriteUrl: string | null;
  transition: Animation | undefined;
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

  if (runtime.requestedState !== null && now <= runtime.requestedUntil) {
    return runtime.requestedState;
  }

  if (runtime.agentState !== null) return runtime.agentState;

  const keyboardState = resolveKeyboardAnimation(runtime.keyboard, now);
  if (keyboardState !== null) return keyboardState;

  if (runtime.hover && runtime.version !== 2) return "jumping";
  return runtime.walkState ?? resolveRestAnimation(runtime.lastActivityAt, now);
}

function transitionFromCurrentFrame(refs: OverlayRefs, runtime: AnimationRuntime): void {
  runtime.transition?.cancel();
  if (
    !refs.sprite.style.backgroundImage ||
    !refs.outgoingSprite.animate ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )
    return;

  refs.outgoingSprite.style.backgroundImage = refs.sprite.style.backgroundImage;
  refs.outgoingSprite.style.backgroundSize = refs.sprite.style.backgroundSize;
  refs.outgoingSprite.style.backgroundPosition = refs.sprite.style.backgroundPosition;
  runtime.transition = refs.outgoingSprite.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 140,
    easing: "ease-out",
  });
}

function paint(
  refs: OverlayRefs,
  runtime: AnimationRuntime,
  now = Date.now(),
  nextPet?: PetView,
): void {
  const nextState = resolveRuntimeState(runtime, now);
  if (nextState !== runtime.state) {
    runtime.state = nextState;
    runtime.column = 0;
    runtime.lastFrameAt = now;
    runtime.frameDurationMs = resolveAnimationFrameDurationMs(nextState);
  }

  const visibleColumns = runtime.visibleFrameColumns[resolveAnimationRow(runtime.state)] ?? [0];
  const actualColumn = visibleColumns[runtime.column % visibleColumns.length] ?? 0;
  const looking =
    runtime.version === 2 &&
    runtime.hover &&
    runtime.dragState === null &&
    runtime.agentState === null &&
    now > runtime.requestedUntil &&
    resolveKeyboardAnimation(runtime.keyboard, now) === null;
  const position = looking
    ? resolveLookPosition(runtime.lookDirection)
    : resolveSpritePosition(runtime.state, actualColumn, runtime.version);
  const displayedState = looking ? "looking" : runtime.state;
  if (nextPet || refs.sprite.getAttribute("data-animation-state") !== displayedState) {
    transitionFromCurrentFrame(refs, runtime);
    refs.sprite.setAttribute("data-animation-state", displayedState);
  }
  if (nextPet) {
    refs.sprite.style.backgroundSize = `800% ${resolveSpriteGrid(runtime.version).rows * 100}%`;
    refs.sprite.style.backgroundImage = `url("${nextPet.spriteUrl}")`;
    refs.sprite.setAttribute("aria-label", nextPet.manifest.displayName);
  }
  refs.sprite.style.backgroundPosition = `${position.x} ${position.y}`;
}

function renderState(refs: OverlayRefs, runtime: AnimationRuntime, state: PetManagerState): void {
  runtime.autoWalk = state.overlay.autoWalk;
  runtime.clickThrough = state.overlay.clickThrough;
  if (runtime.clickThrough) runtime.hover = false;
  if (!runtime.autoWalk) runtime.walkState = null;
  const pet = state.pets.find((candidate) => candidate.manifest.id === state.appliedPetId);
  if (pet === undefined) {
    runtime.requestedSpriteUrl = null;
    runtime.transition?.cancel();
    refs.sprite.style.backgroundImage = "";
    runtime.spriteUrl = null;
    runtime.visibleFrameColumns = createFallbackVisibleFrameColumns();
    refs.sprite.removeAttribute("aria-label");
    return;
  }

  if (runtime.requestedSpriteUrl === pet.spriteUrl) return;
  runtime.requestedSpriteUrl = pet.spriteUrl;
  if (runtime.spriteUrl === pet.spriteUrl) return;
  const version = pet.manifest.spriteVersionNumber ?? 1;
  void detectVisibleFrameColumns(pet.spriteUrl, version).then((visibleFrameColumns) => {
    if (runtime.requestedSpriteUrl !== pet.spriteUrl || runtime.spriteUrl === pet.spriteUrl) return;
    const now = Date.now();
    runtime.spriteUrl = pet.spriteUrl;
    runtime.version = version;
    runtime.keyboard = { lastKeyAt: null, greetingUntil: 0 };
    runtime.visibleFrameColumns = visibleFrameColumns;
    runtime.column = 0;
    runtime.lastFrameAt = now;
    runtime.lastActivityAt = now;
    paint(refs, runtime, now, pet);
  });
}

function requestAnimation(
  refs: OverlayRefs,
  runtime: AnimationRuntime,
  state: PetAnimationState,
): void {
  const now = Date.now();
  runtime.lastActivityAt = now;
  runtime.requestedState = state;
  const frameCount = runtime.visibleFrameColumns[resolveAnimationRow(state)]?.length ?? 1;
  runtime.requestedUntil =
    now +
    Math.max(
      animationTiming.requestedAnimationDurationMs,
      frameCount * resolveAnimationFrameDurationMs(state),
    );
  paint(refs, runtime, now);
}

const walkDurationMs = 3_000;
const walkRestMs = 5_000;
const walkStepMs = 32;

function bindAnimationTimers(refs: OverlayRefs, runtime: AnimationRuntime): void {
  let direction: AutoWalkDirection = "run-right";
  let nextWalkAt = Date.now() + walkRestMs;
  let walkUntil = 0;
  let nextStepAt = 0;
  let stepping = false;

  function canWalk(now: number): boolean {
    return (
      runtime.autoWalk &&
      runtime.agentState === null &&
      runtime.spriteUrl !== null &&
      !document.hidden &&
      !runtime.hover &&
      refs.shell.getAttribute("data-dragging") !== "true" &&
      refs.grip.getAttribute("data-resizing") !== "true" &&
      now > runtime.requestedUntil &&
      resolveKeyboardAnimation(runtime.keyboard, now) === null
    );
  }

  function rest(now: number): void {
    walkUntil = 0;
    runtime.walkState = null;
    nextWalkAt = now + walkRestMs;
  }

  function tickWalk(now: number): void {
    if (!canWalk(now) || (walkUntil > 0 && now >= walkUntil)) {
      rest(now);
      return;
    }
    if (stepping || now < nextWalkAt || now < nextStepAt) return;

    if (walkUntil === 0) walkUntil = now + walkDurationMs;
    nextStepAt = now + walkStepMs;
    stepping = true;
    void api
      .stepAutoWalk(direction)
      .then((moved) => {
        const completedAt = Date.now();
        if (!canWalk(completedAt) || walkUntil === 0) return;
        if (moved) {
          runtime.walkState = direction;
        } else {
          direction = direction === "run-right" ? "run-left" : "run-right";
          rest(completedAt);
        }
        paint(refs, runtime, completedAt);
      })
      .catch(() => rest(Date.now()))
      .finally(() => {
        stepping = false;
      });
  }

  const tick = (): void => {
    const now = Date.now();
    tickWalk(now);
    const state = resolveRuntimeState(runtime, now);
    const frameDurationMs = runtime.frameDurationMs;
    if (state === runtime.state && now - runtime.lastFrameAt >= frameDurationMs) {
      const visibleColumns = runtime.visibleFrameColumns[resolveAnimationRow(state)] ?? [0];
      runtime.column = (runtime.column + 1) % visibleColumns.length;
      runtime.lastFrameAt = now;
      runtime.frameDurationMs = resolveAnimationFrameDurationMs(state);
    }

    paint(refs, runtime, now);
    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

function bindHover(refs: OverlayRefs, runtime: AnimationRuntime): void {
  refs.shell.addEventListener("pointerenter", () => {
    if (runtime.clickThrough) return;
    runtime.hover = true;
    runtime.lastActivityAt = Date.now();
    paint(refs, runtime);
  });

  refs.shell.addEventListener("pointermove", (event) => {
    runtime.lastActivityAt = Date.now();
    runtime.lookDirection =
      (Math.atan2(
        event.clientX - window.innerWidth / 2,
        -(event.clientY - window.innerHeight / 2),
      ) *
        180) /
      Math.PI;
  });
  refs.shell.addEventListener("dblclick", (event) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    requestAnimation(refs, runtime, "jumping");
  });
  refs.shell.addEventListener("pointerleave", () => {
    runtime.hover = false;
    paint(refs, runtime);
  });
}

function bindDrag(refs: OverlayRefs, runtime: AnimationRuntime): void {
  let dragSession: DragSession | undefined;
  let distance = 0;

  const stopDrag = (event: PointerEvent): void => {
    if (dragSession?.pointerId !== event.pointerId) {
      return;
    }

    if (distance < 4 && event.type === "pointerup") requestAnimation(refs, runtime, "waving");
    dragSession = undefined;
    runtime.dragState = null;
    refs.shell.setAttribute("data-dragging", "false");
    paint(refs, runtime);
  };

  refs.shell.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    if (event.target instanceof Element && event.target.closest("button") !== null) {
      return;
    }

    distance = 0;
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

    distance += Math.abs(deltaX) + Math.abs(deltaY);
    runtime.lastActivityAt = Date.now();
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
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}

export function renderOverlay(root: HTMLElement): void {
  document.documentElement.classList.add("overlay-mode");
  root.innerHTML = `
    <main class="overlay-shell" data-dragging="false">
      <button data-overlay-session class="overlay-session" type="button" hidden>
        <span class="overlay-session-meta">
          <span data-session-provider></span>
          <span data-session-status></span>
        </span>
        <span data-session-task class="overlay-session-task"></span>
      </button>
      <div class="overlay-artboard">
        <div data-overlay-sprite class="sprite-frame overlay-sprite" role="img"></div>
        <div data-outgoing-sprite class="sprite-frame overlay-sprite outgoing-sprite" aria-hidden="true"></div>
      </div>
      <button data-resize-grip class="resize-grip" type="button" aria-label="Resize"></button>
    </main>
  `;

  const refs: OverlayRefs = {
    shell: query(root, ".overlay-shell"),
    sprite: query(root, "[data-overlay-sprite]"),
    outgoingSprite: query(root, "[data-outgoing-sprite]"),
    grip: query(root, "[data-resize-grip]"),
    session: query(root, "[data-overlay-session]"),
    sessionProvider: query(root, "[data-session-provider]"),
    sessionStatus: query(root, "[data-session-status]"),
    sessionTask: query(root, "[data-session-task]"),
  };
  const runtime: AnimationRuntime = {
    autoWalk: false,
    clickThrough: false,
    agentState: null,
    walkState: null,
    keyboard: { lastKeyAt: null, greetingUntil: 0 },
    column: 0,
    version: 1,
    lookDirection: 0,
    lastActivityAt: Date.now(),
    frameDurationMs: resolveAnimationFrameDurationMs("idle"),
    dragState: null,
    hover: false,
    lastFrameAt: Date.now(),
    requestedState: null,
    requestedUntil: 0,
    state: defaultAnimationState,
    spriteUrl: null,
    requestedSpriteUrl: null,
    transition: undefined,
    visibleFrameColumns: createFallbackVisibleFrameColumns(),
  };

  refs.grip.append(createElement(MoveDiagonal2, { width: 14, height: 14, "aria-hidden": "true" }));
  bindAnimationTimers(refs, runtime);
  bindHover(refs, runtime);
  bindDrag(refs, runtime);
  bindResizeGrip(refs);
  paint(refs, runtime);

  refs.session.addEventListener("click", () => {
    void api.openAgentSessions().catch(console.error);
  });

  let lastSession: AgentSession | undefined;
  let summaryTimer: ReturnType<typeof setTimeout> | undefined;
  const renderSessions = (sessions: readonly AgentSession[], animate: boolean): void => {
    const latest = sessions[0];
    const active =
      sessions.find((session) => session.status === "waiting") ??
      sessions.find((session) => session.status === "working");
    runtime.agentState = active?.status === "waiting" ? "review" : active ? "running" : null;
    const recent = sessions.find(
      (session) => session.status === "completed" || session.status === "failed",
    );
    const remaining = recent ? recent.updatedAt + 12_000 - Date.now() : 0;
    const summary = active ?? (remaining > 0 ? recent : undefined);
    clearTimeout(summaryTimer);
    refs.session.hidden = summary === undefined;
    if (summary) {
      const task = summary.task || summary.tool || "작업 내용 수신 대기";
      refs.session.setAttribute("data-status", summary.status);
      refs.sessionProvider.textContent = agentProviderLabels[summary.provider];
      refs.sessionStatus.textContent = agentStatusLabels[summary.status];
      refs.sessionTask.textContent = task;
      refs.session.title = summary.project ? `${summary.project} · ${task}` : task;
      refs.session.setAttribute(
        "aria-label",
        `작업 세션 열기 · ${agentProviderLabels[summary.provider]} · ${agentStatusLabels[summary.status]} · ${task}`,
      );
      if (!active)
        summaryTimer = setTimeout(() => {
          refs.session.hidden = true;
        }, remaining);
    }
    if (
      animate &&
      latest &&
      (latest.updatedAt !== lastSession?.updatedAt ||
        latest.provider !== lastSession?.provider ||
        latest.sessionId !== lastSession?.sessionId ||
        latest.status !== lastSession?.status)
    ) {
      if (latest.status === "completed") requestAnimation(refs, runtime, "jumping");
      if (latest.status === "failed") requestAnimation(refs, runtime, "failed");
    }
    lastSession = latest;
    paint(refs, runtime);
  };
  let receivedSessionEvent = false;
  api.onAgentSessions((sessions) => {
    receivedSessionEvent = true;
    renderSessions(sessions, true);
  });
  void api
    .getAgentSessions()
    .then((sessions) => {
      if (!receivedSessionEvent) renderSessions(sessions, false);
    })
    .catch(() => undefined);

  api.onKeyboardActivity(() => {
    const now = Date.now();
    recordKeyboardActivity(runtime.keyboard, now);
    runtime.lastActivityAt = now;
    paint(refs, runtime, now);
  });
  api.onAnimationRequested((state) => requestAnimation(refs, runtime, state));
  api.onStateChanged((state) => renderState(refs, runtime, state));
  void api.getState().then((result) => {
    if (result.kind === "ready") {
      renderState(refs, runtime, result.state);
    }
  });
}
