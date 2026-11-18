import {
  type AgentProvider,
  type AgentSession,
  agentProviderLabels,
  agentProviderSchema,
  agentStatusLabels,
} from "../electron/shared/agentSessions.js";
import { query } from "./managerView.js";

export function mountAgentSessionsPage(api: NonNullable<Window["codexPet"]>): HTMLElement {
  const page = document.createElement("section");
  page.id = "page-sessions";
  page.className = "manager-page";
  page.setAttribute("aria-labelledby", "sessions-heading");
  page.innerHTML = `
    <div class="page-content">
      <h2 id="sessions-heading" tabindex="-1">작업 세션</h2>
      <div class="settings-card session-connections" aria-label="도구 연결">
        <div class="connection-row">
          <div><strong>Codex</strong><span data-connection-state="codex"></span></div>
          <button type="button" data-session-action="codex" disabled>연결</button>
        </div>
        <div class="connection-row">
          <div><strong>Claude Code</strong><span data-connection-state="claude"></span></div>
          <button type="button" data-session-action="claude" disabled>연결</button>
        </div>
        <p class="connection-note">요청 일부는 이 Mac에서만 표시됩니다.</p>
      </div>
      <p class="page-feedback" data-session-feedback role="status" aria-live="polite"></p>
      <p class="session-empty" data-sessions-empty>수신한 세션이 없습니다.</p>
      <div class="release-history" data-agent-sessions></div>
    </div>
  `;
  const feedback = query<HTMLElement>(page, "[data-session-feedback]");
  const empty = query<HTMLElement>(page, "[data-sessions-empty]");
  const list = query<HTMLElement>(page, "[data-agent-sessions]");
  const buttons = Array.from(page.querySelectorAll<HTMLButtonElement>("[data-session-action]"));
  let connections: Record<AgentProvider, boolean> | undefined;
  let busy = false;

  function renderConnections(): void {
    for (const button of buttons) {
      const provider = agentProviderSchema.parse(button.getAttribute("data-session-action"));
      const connected = connections?.[provider];
      const label = connected ? "연결 해제" : "연결";
      query<HTMLElement>(page, `[data-connection-state="${provider}"]`).textContent =
        connected === undefined ? "" : connected ? "연결됨" : "미연결";
      button.disabled = busy || connected === undefined;
      button.textContent = label;
      button.setAttribute("aria-label", `${agentProviderLabels[provider]} ${label}`);
    }
  }

  async function loadConnections(): Promise<void> {
    connections = await api.getAgentConnections();
    renderConnections();
  }

  for (const button of buttons) {
    button.addEventListener("click", async () => {
      if (busy || !connections) return;
      const provider = agentProviderSchema.parse(button.getAttribute("data-session-action"));
      const enabled = !connections[provider];
      busy = true;
      renderConnections();
      feedback.textContent = "";
      try {
        await api.configureAgentHooks(provider, enabled);
        connections = { ...connections, [provider]: enabled };
        feedback.textContent = enabled
          ? provider === "codex"
            ? "Codex 새 세션의 /hooks에서 Codex Pet 훅을 신뢰하세요."
            : "Claude Code 새 세션에서 작업을 시작하세요."
          : "";
      } catch (error) {
        await loadConnections().catch(() => undefined);
        feedback.textContent =
          error instanceof Error ? error.message : "연결 상태를 변경하지 못했습니다.";
      } finally {
        busy = false;
        renderConnections();
      }
    });
  }
  void loadConnections().catch(() => {
    feedback.textContent = "연결 상태를 불러오지 못했습니다.";
  });

  function render(sessions: readonly AgentSession[]): void {
    empty.hidden = sessions.length > 0;
    list.replaceChildren(
      ...sessions.map((session) => {
        const card = document.createElement("article");
        card.className = "release-card session-card";
        const title = document.createElement("h3");
        title.textContent = `${agentProviderLabels[session.provider]}${session.project ? ` · ${session.project}` : ""} · ${agentStatusLabels[session.status]}`;
        const task = document.createElement("p");
        task.textContent = session.task || "수신한 프롬프트 없음";
        const detail = document.createElement("p");
        detail.className = "release-meta";
        detail.textContent = `세션 ${session.sessionId} · ${new Date(session.updatedAt).toLocaleTimeString("ko-KR")}${session.tool ? ` · ${session.tool}` : ""}`;
        card.append(title, task, detail);
        return card;
      }),
    );
  }

  let hasEvent = false;
  const stop = api.onAgentSessions((sessions) => {
    hasEvent = true;
    render(sessions);
  });
  window.addEventListener("pagehide", stop, { once: true });
  void api
    .getAgentSessions()
    .then((sessions) => {
      if (!hasEvent) render(sessions);
    })
    .catch(() => {
      feedback.textContent = "작업 세션을 불러오지 못했습니다.";
    });
  return page;
}
