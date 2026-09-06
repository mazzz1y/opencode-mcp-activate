export const DEFAULTS = {
  description: [
    "Start or stop a configured MCP server on demand.",
    "",
    "Servers are configured but mostly left disconnected so their tools do not consume context until",
    "needed. Start one yourself the moment its capability would help, rather than asking for it to be",
    "enabled or working around its absence.",
    "",
    "Call this with an unknown server name to get the list of configured servers.",
    "",
    "After a successful connect, the server's tools are NOT available in this same reply — finish this",
    "step, then call them on your next step. Leave a server connected for the rest of the task;",
    "disconnect only when you no longer need it and context is tight.",
  ].join("\n"),

  actionDescription: "connect to start the server, disconnect to stop it and free its context",
  serverDescription: "Name of the MCP server to act on",

  unknownAction: "Error: unknown action {action}.",
  unknownServer: "Error: unknown MCP server {server}. Configured: {servers}.",
  alreadyDisconnected: "MCP {server} is already not connected (status: {status}).",
  disconnected: "Disconnected MCP {server}; its tools are gone from your next step.",
  alreadyConnected: "MCP {server} is already connected; use its tools directly.",
  connected: "Connected MCP {server}. Its tools appear on your next step — continue the task there.",
  failed: "Error: MCP {action} failed for {server}: {message}",
}

export function resolve(options) {
  const resolved = { ...DEFAULTS }
  const overrides = options?.prompts
  if (!overrides || typeof overrides !== "object") return resolved

  for (const key of Object.keys(DEFAULTS)) {
    if (!Object.hasOwn(overrides, key)) continue
    const value = overrides[key]
    if (typeof value === "string") resolved[key] = value
    else if (Array.isArray(value) && value.every((line) => typeof line === "string")) {
      resolved[key] = value.join("\n")
    }
  }
  return resolved
}

export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  )
}
