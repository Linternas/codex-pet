import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureAgentHooks,
  startAgentSessionReceiver,
  updateAgentSessions,
} from "../electron/main/agentSessions.js";
import type {
  AgentProvider,
  AgentSession,
  AgentSessionEvent,
} from "../electron/shared/agentSessions.js";

let data: string;
const hookScript = new URL("../scripts/session-hook.cjs", import.meta.url).pathname;

beforeEach(async () => {
  data = await mkdtemp("/tmp/pet-hooks-");
  vi.stubEnv("CODEX_HOME", join(data, "codex"));
  vi.stubEnv("CLAUDE_CONFIG_DIR", join(data, "claude"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(data, { recursive: true, force: true });
});

async function runHook(provider: AgentProvider, socket: string, payload: Record<string, unknown>) {
  const hook = spawn(process.execPath, [hookScript, provider, socket], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  hook.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    output += chunk;
  });
  hook.stdin.end(JSON.stringify(payload));
  const [status] = await once(hook, "close");
  expect(status).toBe(0);
  expect(JSON.parse(output)).toEqual({});
}

describe("agent session hooks", () => {
  it("keeps the providers distinct and tracks prompt, tool, approval, completion and end", async () => {
    const socket = join(data, "events.sock");
    let sessions: AgentSession[] = [];
    const events: AgentSessionEvent[] = [];
    const receiver = await startAgentSessionReceiver(socket, (event) => {
      events.push(event);
      sessions = updateAgentSessions(sessions, event, 1);
    });
    try {
      const first = {
        session_id: "sess-1",
        cwd: "/tmp/project with spaces",
        hook_event_name: "UserPromptSubmit",
        prompt: "파일 수정\n그리고 테스트",
        transcript_path: "/private/transcript.jsonl",
      };
      await runHook("codex", socket, first);
      await runHook("claude", socket, { ...first, prompt: "다른 요청" });
      await runHook("codex", socket, {
        ...first,
        hook_event_name: "PermissionRequest",
        tool_name: "Bash",
      });
      expect(events[0]).not.toHaveProperty("transcript_path");
      expect(sessions).toMatchObject([
        {
          provider: "codex",
          sessionId: "sess-1",
          project: "project with spaces",
          task: "파일 수정 그리고 테스트",
          status: "waiting",
          tool: "Bash",
        },
        { provider: "claude", sessionId: "sess-1", task: "다른 요청", status: "working" },
      ]);
      await runHook("claude", socket, {
        ...first,
        hook_event_name: "PreToolUse",
        tool_name: "AskUserQuestion",
      });
      expect(sessions[0]?.status).toBe("waiting");
      await runHook("claude", socket, {
        ...first,
        hook_event_name: "PostToolUse",
        tool_name: "AskUserQuestion",
      });
      expect(sessions[0]?.status).toBe("working");
      await runHook("claude", socket, { ...first, hook_event_name: "Stop" });
      expect(sessions[0]?.status).toBe("completed");
      await runHook("claude", socket, { ...first, hook_event_name: "SessionEnd" });
      expect(sessions[0]?.status).toBe("ended");
    } finally {
      const closed = once(receiver, "close");
      receiver.close();
      await closed;
    }
    await runHook("codex", socket, { session_id: "offline", hook_event_name: "Stop" });
  });

  it.each(["codex", "claude"] as const)(
    "installs and removes %s hooks without replacing existing hooks",
    async (provider) => {
      const home = join(data, provider);
      const config = join(home, provider === "codex" ? "hooks.json" : "settings.json");
      const saved = {
        custom: "keep",
        hooks: { Stop: [{ hooks: [{ type: "command", command: "existing-command" }] }] },
      };
      await mkdir(home);
      await writeFile(config, JSON.stringify(saved));

      for (let attempt = 0; attempt < 2; attempt++) {
        await configureAgentHooks(
          provider,
          true,
          process.execPath,
          hookScript,
          join(data, "events.sock"),
        );
      }
      const enabled = JSON.parse(await readFile(config, "utf8"));
      expect(enabled.hooks.Stop).toHaveLength(2);
      expect(enabled.hooks.SessionStart[0].matcher).not.toContain("compact");
      expect(enabled.hooks.Stop[1].hooks[0].command).toContain(`'${provider}'`);
      await configureAgentHooks(
        provider,
        false,
        process.execPath,
        hookScript,
        join(data, "events.sock"),
      );
      expect(JSON.parse(await readFile(config, "utf8"))).toEqual(saved);
    },
  );
});
