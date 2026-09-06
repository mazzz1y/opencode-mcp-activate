import { format, resolve } from "./prompts.js"

function unwrap(result) {
  if (result && typeof result === "object" && "error" in result && result.error) {
    const error = result.error
    const message = typeof error === "string" ? error : error?.data?.message || error?.message
    throw new Error(message || JSON.stringify(error))
  }
  return result && typeof result === "object" && "data" in result ? result.data : result
}

function statusOf(payload, name) {
  const entry = payload?.[name]
  return typeof entry?.status === "string" ? entry.status : "unknown"
}

// connect only responds once the transport attempt and tool listing have
// finished, but reports success even when they failed — the status map holds
// the real outcome, so it has to be read back.
function assertConnected(payload, name) {
  const status = statusOf(payload, name)
  if (status === "connected") return
  const error = payload?.[name]?.error
  throw new Error(error ? `${status}: ${error}` : status)
}

const server = async ({ client }, options) => {
  const prompts = resolve(options)

  return {
    tool: {
      mcp_activate: {
        description: prompts.description,
        // Plain JSON Schema rather than Zod keeps this plugin dependency-free;
        // opencode accepts it and marks every declared property as required.
        args: {
          action: {
            type: "string",
            enum: ["connect", "disconnect"],
            description: prompts.actionDescription,
          },
          server: {
            type: "string",
            description: prompts.serverDescription,
          },
        },
        async execute({ action, server: name }) {
          if (action !== "connect" && action !== "disconnect") {
            return format(prompts.unknownAction, { action })
          }

          try {
            // Every server opencode knows about, connected or not: it registers
            // disconnected ones in this map without starting a transport. Read
            // lazily because the server is not reachable during plugin init.
            const before = unwrap(await client.mcp.status({}))
            if (!(name in before)) {
              return format(prompts.unknownServer, { server: name, servers: Object.keys(before).join(", ") })
            }

            if (action === "disconnect") {
              const status = statusOf(before, name)
              if (status !== "connected") {
                return format(prompts.alreadyDisconnected, { server: name, status })
              }
              unwrap(await client.mcp.disconnect({ path: { name } }))
              return format(prompts.disconnected, { server: name })
            }

            if (statusOf(before, name) === "connected") {
              return format(prompts.alreadyConnected, { server: name })
            }

            unwrap(await client.mcp.connect({ path: { name } }))
            assertConnected(unwrap(await client.mcp.status({})), name)
            return format(prompts.connected, { server: name })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            return format(prompts.failed, { action, server: name, message })
          }
        },
      },
    },
  }
}

export default { id: "opencode-mcp-activate", server }
