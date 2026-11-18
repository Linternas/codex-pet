import type { IpcMain } from "electron";
import {
  type AutoWalkDirection,
  type InstallPetRequest,
  type OverlayResizeRequest,
  type OverlayScaleRequest,
  type PetIdRequest,
  type PetManagerResult,
  type PetManagerState,
  autoWalkDirectionSchema,
  autoWalkSettingSchema,
  installPetRequestSchema,
  overlayAnimationRequestSchema,
  overlayMoveRequestSchema,
  overlayResizeRequestSchema,
  overlayScaleRequestSchema,
  petChannels,
  petIdRequestSchema,
} from "../shared/ipc.js";
import type { PetAnimationState } from "../shared/petAnimation.js";

type PetIpcHandlers = {
  readonly applyPet: (request: PetIdRequest) => Promise<PetManagerResult>;
  readonly deletePet: (request: PetIdRequest) => Promise<PetManagerResult>;
  readonly refreshInstaller: () => Promise<PetManagerResult>;
  readonly getState: () => Promise<PetManagerState>;
  readonly installPet: (request: InstallPetRequest) => Promise<PetManagerResult>;
  readonly setAutoWalk: (enabled: boolean) => Promise<PetManagerResult>;
  readonly stepAutoWalk: (sender: Electron.WebContents, direction: AutoWalkDirection) => boolean;
  readonly moveOverlay: (deltaX: number, deltaY: number) => void;
  readonly requestAnimation: (state: PetAnimationState) => void;
  readonly resizeOverlay: (request: OverlayResizeRequest) => Promise<PetManagerResult>;
  readonly setOverlayScale: (request: OverlayScaleRequest) => Promise<PetManagerResult>;
  readonly toErrorResult: (error: unknown, state?: PetManagerState) => PetManagerResult;
};

function parseRequest<T>(schema: { readonly parse: (value: unknown) => T }, value: unknown): T {
  return schema.parse(value);
}

export function registerPetIpcHandlers(ipcMain: IpcMain, handlers: PetIpcHandlers): void {
  ipcMain.handle(petChannels.refreshInstaller, () => handlers.refreshInstaller());
  ipcMain.handle(petChannels.getState, async (): Promise<PetManagerResult> => {
    try {
      return { kind: "ready", state: await handlers.getState() };
    } catch (error) {
      return handlers.toErrorResult(error);
    }
  });

  ipcMain.handle(
    petChannels.install,
    async (_event, payload: unknown): Promise<PetManagerResult> => {
      try {
        return await handlers.installPet(parseRequest(installPetRequestSchema, payload));
      } catch (error) {
        return handlers.toErrorResult(error, await handlers.getState().catch(() => undefined));
      }
    },
  );

  ipcMain.handle(
    petChannels.delete,
    async (_event, payload: unknown): Promise<PetManagerResult> => {
      try {
        return await handlers.deletePet(parseRequest(petIdRequestSchema, payload));
      } catch (error) {
        return handlers.toErrorResult(error, await handlers.getState().catch(() => undefined));
      }
    },
  );

  ipcMain.handle(petChannels.apply, async (_event, payload: unknown): Promise<PetManagerResult> => {
    try {
      return await handlers.applyPet(parseRequest(petIdRequestSchema, payload));
    } catch (error) {
      return handlers.toErrorResult(error, await handlers.getState().catch(() => undefined));
    }
  });

  ipcMain.handle(
    petChannels.setOverlayScale,
    async (_event, payload: unknown): Promise<PetManagerResult> => {
      try {
        return await handlers.setOverlayScale(parseRequest(overlayScaleRequestSchema, payload));
      } catch (error) {
        return handlers.toErrorResult(error, await handlers.getState().catch(() => undefined));
      }
    },
  );

  ipcMain.handle(
    petChannels.resizeOverlay,
    async (_event, payload: unknown): Promise<PetManagerResult> => {
      try {
        return await handlers.resizeOverlay(parseRequest(overlayResizeRequestSchema, payload));
      } catch (error) {
        return handlers.toErrorResult(error, await handlers.getState().catch(() => undefined));
      }
    },
  );

  ipcMain.handle(petChannels.moveOverlay, (_event, payload: unknown): void => {
    const { deltaX, deltaY } = parseRequest(overlayMoveRequestSchema, payload);
    handlers.moveOverlay(deltaX, deltaY);
  });

  ipcMain.handle(petChannels.setAutoWalk, async (_event, enabled: unknown) => {
    try {
      return await handlers.setAutoWalk(autoWalkSettingSchema.parse(enabled));
    } catch (error) {
      return handlers.toErrorResult(error, await handlers.getState().catch(() => undefined));
    }
  });

  ipcMain.handle(petChannels.stepAutoWalk, (event, direction: unknown) =>
    handlers.stepAutoWalk(event.sender, autoWalkDirectionSchema.parse(direction)),
  );

  ipcMain.handle(petChannels.requestAnimation, (_event, payload: unknown): void => {
    const { state } = parseRequest(overlayAnimationRequestSchema, payload);
    handlers.requestAnimation(state);
  });
}
