import { z } from "zod";

export const appUpdateStateSchema = z.object({
  kind: z.enum([
    "idle",
    "unavailable",
    "checking",
    "current",
    "available",
    "downloading",
    "verifying",
    "ready",
    "installing",
    "installed",
    "error",
  ]),
  version: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
});
export type AppUpdateState = z.infer<typeof appUpdateStateSchema>;
export const appUpdateChannels = {
  state: "app-update:state",
  check: "app-update:check",
  download: "app-update:download",
  install: "app-update:install",
  changed: "app-update:changed",
} as const;
