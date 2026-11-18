import { lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { type Server, createConnection, createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
  type AgentProvider,
  type AgentSession,
  type AgentSessionEvent,
  agentSessionEventSchema,
} from "../shared/agentSessions.js";

const sessionStatuses = {
  SessionStart: "idle",
  UserPromptSubmit: "working",
  PreToolUse: "working",
  PostToolUse: "working",
  PermissionRequest: "waiting",
  Stop: "completed",
  Interrupt: "idle",
  StopFailure: "failed",
  SessionEnd: "ended",
} as const satisfies Record<AgentSessionEvent["event"], AgentSession["status"]>;

export function updateAgentSessions(
  sessions: readonly AgentSession[],
  event: AgentSessionEvent,
  now = Date.now(),
): AgentSession[] {
  const others = sessions.filter(
    (session) => session.provider !== event.provider || session.sessionId !== event.sessionId,
  );
  const previous = sessions.find(
    (session) => session.provider === event.provider && session.sessionId === event.sessionId,
  );
  const asksForInput =
    event.event === "PreToolUse" &&
    (event.tool === "AskUserQuestion" || event.tool === "ExitPlanMode");
  return [
    {
      provider: event.provider,
      sessionId: event.sessionId,
      project: event.project || previous?.project || "",
      task: event.task ?? previous?.task ?? "",
      tool: event.tool ?? "",
      status: asksForInput ? "waiting" : sessionStatuses[event.event],
      updatedAt: now,
    },
    ...others,
  ].slice(0, 50);
}

async function listen(server: Server, path: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}

async function socketIsActive(path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
  });
}

export async function startAgentSessionReceiver(
  path: string,
  onEvent: (event: AgentSessionEvent) => void,
): Promise<Server> {
  const server = createServer((socket) => {
    let input = "";
    socket.setEncoding("utf8");
    socket.setTimeout(800, () => socket.destroy());
    socket.on("error", () => socket.destroy());
    socket.on("data", (chunk: string) => {
      input += chunk;
      if (input.length > 4096) socket.destroy();
    });
    socket.on("end", () => {
      if (input.length > 4096) return;
      try {
        onEvent(agentSessionEventSchema.parse(JSON.parse(input)));
      } catch {
        // Hook events are best effort. Invalid data does not affect either client.
      }
    });
  });
  try {
    await listen(server, path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    if (!(await lstat(path)).isSocket() || (await socketIsActive(path))) throw error;
    await unlink(path);
    await listen(server, path);
  }
  return server;
}

const hookGroupSchema = z
  .object({ hooks: z.array(z.object({ command: z.unknown() }).passthrough()) })
  .passthrough();
const hookSettingsSchema = z
  .object({
    hooks: z.record(z.array(hookGroupSchema)).optional(),
  })
  .passthrough();

const hookMarker = /^ELECTRON_RUN_AS_NODE=1 CODEX_PET_SESSION_HOOK=1 /;
const commonEvents = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "Stop",
  "SessionEnd",
] as const;

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export async function configureAgentHooks(
  provider: AgentProvider,
  enabled: boolean,
  executable: string,
  hookScript: string,
  socketPath: string,
): Promise<void> {
  const { CODEX_HOME, CLAUDE_CONFIG_DIR } = process.env;
  const config =
    provider === "codex"
      ? join(CODEX_HOME || join(homedir(), ".codex"), "hooks.json")
      : join(CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "settings.json");
  let source: string | undefined;
  let settings: z.infer<typeof hookSettingsSchema>;
  try {
    source = await readFile(config, "utf8");
    settings = hookSettingsSchema.parse(JSON.parse(source));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`기존 훅 설정을 읽을 수 없습니다. ${config}`, { cause: error });
    }
    if (!enabled) return;
    settings = {};
  }

  const hooks = settings.hooks ?? {};
  const events = [...commonEvents, provider === "codex" ? "Interrupt" : "StopFailure"];
  const command = `ELECTRON_RUN_AS_NODE=1 CODEX_PET_SESSION_HOOK=1 ${[executable, hookScript, provider, socketPath].map(quote).join(" ")}`;
  for (const event of events) {
    const groups = (hooks[event] ?? []).flatMap((group) => {
      const handlers = group.hooks.filter(
        (handler) => typeof handler.command !== "string" || !hookMarker.test(handler.command),
      );
      return handlers.length ? [{ ...group, hooks: handlers }] : [];
    });
    if (enabled) {
      groups.push({
        ...(event === "SessionStart" && { matcher: "startup|resume|clear|fork" }),
        hooks: [{ type: "command", command, timeout: 1 }],
      });
    }
    if (groups.length) hooks[event] = groups;
    else delete hooks[event];
  }

  await mkdir(dirname(config), { recursive: true });
  const temporary = `${config}.codex-pet-${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify({ ...settings, hooks }, null, 2)}\n`, {
      mode: 0o600,
    });
    const current = await readFile(config, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return undefined;
    });
    if (current !== source) throw new Error("훅 설정이 변경됐습니다. 다시 시도하세요.");
    await rename(temporary, config);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
