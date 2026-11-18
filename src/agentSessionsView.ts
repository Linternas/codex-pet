import { type AgentSession, agentProviderSchema } from "../electron/shared/agentSessions.js";
import { query } from "./managerView.js";

const providers = { codex: "Codex", claude: "Claude Code" } as const;
const statuses: Record<AgentSession["status"], string> = {
  idle: "대기",
  working: "작업 중",
  waiting: "입력·승인 대기",
  completed: "응답 완료",
  failed: "오류",
  ended: "세션 종료",
};

export function mountAgentSessionsPage(api: NonNullable<Window["codexPet"]>): HTMLElement {
  const page = document.createElement("section");
  page.id = "page-sessions";
  page.className = "manager-page";
  page.setAttribute("aria-labelledby", "sessions-heading");
  page.innerHTML = `
    <div class="page-content">
      <h2 id="sessions-heading" tabindex="-1">작업 세션</h2>
      <p class="page-intro">연결한 Codex·Claude Code의 최근 프롬프트 일부와 상태를 앱이 열린 동안 이 Mac에서 표시합니다.</p>
      <div class="page-actions">
        <button type="button" data-connect="codex">Codex 연결</button>
        <button type="button" data-disconnect="codex">Codex 연결 해제</button>
        <button type="button" data-connect="claude">Claude Code 연결</button>
        <button type="button" data-disconnect="claude">Claude Code 연결 해제</button>
      </div>
      <p class="page-feedback" data-session-feedback role="status" aria-live="polite"></p>
      <p data-sessions-empty>수신한 세션이 없습니다. 연결한 도구에서 세션을 열고 프롬프트를 보내세요.</p>
      <div class="release-history" data-agent-sessions></div>
    </div>
  `;
  const feedback = query<HTMLElement>(page, "[data-session-feedback]");
  const empty = query<HTMLElement>(page, "[data-sessions-empty]");
  const list = query<HTMLElement>(page, "[data-agent-sessions]");
  const buttons = Array.from(page.querySelectorAll<HTMLButtonElement>(".page-actions button"));
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      const provider = agentProviderSchema.parse(
        button.getAttribute("data-connect") ?? button.getAttribute("data-disconnect"),
      );
      const enabled = button.hasAttribute("data-connect");
      for (const action of buttons) action.disabled = true;
      feedback.textContent = "";
      try {
        await api.configureAgentHooks(provider, enabled);
        feedback.textContent = enabled
          ? provider === "codex"
            ? "Codex의 새 세션에서 /hooks로 추가된 훅을 신뢰한 뒤 사용하세요."
            : "Claude Code의 새 세션에서 훅이 적용됩니다."
          : `${providers[provider]} 연결을 해제했습니다. 열려 있는 세션을 다시 시작하면 훅 설정이 갱신됩니다.`;
      } catch (error) {
        feedback.textContent =
          error instanceof Error ? error.message : "훅 설정을 변경하지 못했습니다.";
      } finally {
        for (const action of buttons) action.disabled = false;
      }
    });
  }

  function render(sessions: readonly AgentSession[]): void {
    empty.hidden = sessions.length > 0;
    list.replaceChildren(
      ...sessions.map((session) => {
        const card = document.createElement("article");
        card.className = "release-card session-card";
        const title = document.createElement("h3");
        title.textContent = `${providers[session.provider]}${session.project ? ` · ${session.project}` : ""} · ${statuses[session.status]}`;
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
