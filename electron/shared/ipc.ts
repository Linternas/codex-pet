import { z } from "zod";
import { installerStatusSchema } from "./installer.js";
import { overlayDefaults } from "./overlay.js";
import { petAnimationStates } from "./petAnimation.js";
import { petIdSchema, petViewSchema } from "./petAssets.js";

export const overlayStateSchema = z.object({
  visible: z.boolean(),
  autoWalk: z.boolean(),
  clickThrough: z.boolean(),
  scale: z.number().min(overlayDefaults.minScale).max(overlayDefaults.maxScale),
});

export const petManagerStateSchema = z.object({
  pets: z.array(petViewSchema),
  appliedPetId: petIdSchema.nullable(),
  overlay: overlayStateSchema,
  installer: installerStatusSchema,
});

export const petManagerResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ready"),
    state: petManagerStateSchema,
  }),
  z.object({
    kind: z.literal("error"),
    message: z.string().min(1),
    state: petManagerStateSchema.optional(),
  }),
]);

export const installPetRequestSchema = z.object({
  petId: petIdSchema,
});

export const petIdRequestSchema = z.object({
  petId: petIdSchema,
});

export const overlayScaleRequestSchema = z.object({
  scale: z.number(),
});

export const overlayResizeRequestSchema = z.object({
  width: z.number().positive(),
});

export const overlayMoveRequestSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const autoWalkSettingSchema = z.boolean();
export type AutoWalkDirection = "run-left" | "run-right";

export const overlayAnimationRequestSchema = z.object({
  state: z.enum(petAnimationStates),
});

export type PetManagerState = z.infer<typeof petManagerStateSchema>;
export type PetManagerResult = z.infer<typeof petManagerResultSchema>;
export type InstallPetRequest = z.infer<typeof installPetRequestSchema>;
export type PetIdRequest = z.infer<typeof petIdRequestSchema>;
export type OverlayScaleRequest = z.infer<typeof overlayScaleRequestSchema>;
export type OverlayResizeRequest = z.infer<typeof overlayResizeRequestSchema>;
export type OverlayMoveRequest = z.infer<typeof overlayMoveRequestSchema>;
export type OverlayAnimationRequest = z.infer<typeof overlayAnimationRequestSchema>;

export const petChannels = {
  getState: "pet:get-state",
  revealKeyboardMonitor: "pet:reveal-keyboard-monitor",
  getReleaseHistory: "pet:get-release-history",
  refreshInstaller: "pet:refresh-installer",
  downloadNode: "pet:download-node",
  install: "pet:install",
  delete: "pet:delete",
  apply: "pet:apply",
  checkUpdate: "pet:check-update",
  openAccessibilitySettings: "pet:open-accessibility-settings",
  getAccessibilityPermission: "pet:get-accessibility-permission",
  openUpdateDownload: "pet:open-update-download",
  setOverlayScale: "pet:set-overlay-scale",
  resizeOverlay: "pet:resize-overlay",
  moveOverlayTo: "pet:move-overlay-to",
  setAutoWalk: "pet:set-auto-walk",
  stepAutoWalk: "pet:step-auto-walk",
  requestAnimation: "pet:request-animation",
  stateChanged: "pet:state-changed",
  animationRequested: "pet:animation-requested",
  keyboardActivity: "pet:keyboard-activity",
} as const;
