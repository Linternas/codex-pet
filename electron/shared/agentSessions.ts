import { z } from "zod";

export const agentProviderSchema = z.enum(["codex", "claude"]);
export type AgentProvider = z.infer<typeof agentProviderSchema>;

export const agentSessionEventSchema = z.object({
  provider: agentProviderSchema,
  sessionId: z.string().min(1).max(128),
  project: z.string().max(120),
  task: z.string().max(180).optional(),
  tool: z.string().max(80).optional(),
  event: z.enum([
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PermissionRequest",
    "Stop",
    "Interrupt",
    "StopFailure",
    "SessionEnd",
  ]),
});
export type AgentSessionEvent = z.infer<typeof agentSessionEventSchema>;

export type AgentSession = {
  readonly provider: AgentProvider;
  readonly sessionId: string;
  readonly project: string;
  readonly task: string;
  readonly tool: string;
  readonly status: "idle" | "working" | "waiting" | "completed" | "failed" | "ended";
  readonly updatedAt: number;
};

export const agentProviderLabels = { codex: "Codex", claude: "Claude Code" } as const;
export const agentStatusLabels: Record<AgentSession["status"], string> = {
  idle: "대기",
  working: "작업 중",
  waiting: "입력·승인 대기",
  completed: "응답 완료",
  failed: "오류",
  ended: "세션 종료",
};

export const agentSessionChannels = {
  get: "session:get",
  connections: "session:connections",
  open: "session:open",
  showPage: "session:show-page",
  changed: "session:changed",
  configure: "session:configure",
} as const;
