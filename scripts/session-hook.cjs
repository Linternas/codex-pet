const { readFileSync } = require("node:fs");
const { createConnection } = require("node:net");
const { basename } = require("node:path");

try {
  const [, , provider, endpoint] = process.argv;
  const hook = JSON.parse(readFileSync(0, "utf8"));
  const clean = (value, max) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
  const message = {
    provider,
    sessionId: clean(hook.session_id, 128),
    project: clean(basename(typeof hook.cwd === "string" ? hook.cwd : ""), 120),
    event: hook.hook_event_name,
    task: hook.hook_event_name === "UserPromptSubmit" ? clean(hook.prompt, 180) : undefined,
    tool: clean(hook.tool_name, 80),
  };
  const socket = createConnection(endpoint, () => socket.end(JSON.stringify(message)));
  socket.on("error", () => socket.destroy());
  socket.setTimeout(500, () => socket.destroy());
} catch {
  // A closed pet app or malformed input must never interrupt an agent turn.
}
process.stdout.write("{}\n");
