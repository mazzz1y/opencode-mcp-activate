import { test } from "node:test"
import assert from "node:assert/strict"
import plugin from "../index.js"
import { DEFAULTS, format, resolve } from "../prompts.js"

function fakeClient(statuses) {
  const calls = []
  const client = {
    mcp: {
      status: async () => ({ data: statuses }),
      connect: async ({ path }) => {
        calls.push(["connect", path.name])
        statuses[path.name] = { status: "connected" }
        return { data: {} }
      },
      disconnect: async ({ path }) => {
        calls.push(["disconnect", path.name])
        statuses[path.name] = { status: "pending" }
        return { data: {} }
      },
    },
  }
  return { client, calls }
}

async function tool(options, statuses = { github: { status: "pending" }, playwright: { status: "connected" } }) {
  const { client, calls } = fakeClient(statuses)
  const hooks = await plugin.server({ client }, options)
  return { run: hooks.tool.mcp_activate.execute, def: hooks.tool.mcp_activate, calls }
}

test("exports a v1 plugin module", () => {
  assert.equal(plugin.id, "opencode-mcp-activate")
  assert.equal(typeof plugin.server, "function")
})

test("uses defaults when no options are passed", async () => {
  const { def, run } = await tool(undefined)
  assert.equal(def.description, DEFAULTS.description)
  assert.equal(def.args.action.description, DEFAULTS.actionDescription)
  assert.equal(
    await run({ action: "connect", server: "nope" }),
    "Error: unknown MCP server nope. Configured: github, playwright.",
  )
})

test("connect and disconnect flow", async () => {
  const { run, calls } = await tool()
  assert.equal(
    await run({ action: "connect", server: "github" }),
    "Connected MCP github. Its tools appear on your next step — continue the task there.",
  )
  assert.equal(await run({ action: "connect", server: "github" }), "MCP github is already connected; use its tools directly.")
  assert.equal(
    await run({ action: "disconnect", server: "github" }),
    "Disconnected MCP github; its tools are gone from your next step.",
  )
  assert.equal(
    await run({ action: "disconnect", server: "github" }),
    "MCP github is already not connected (status: pending).",
  )
  assert.deepEqual(calls, [
    ["connect", "github"],
    ["disconnect", "github"],
  ])
})

test("rejects unknown actions without touching the client", async () => {
  const { run, calls } = await tool()
  assert.equal(await run({ action: "explode", server: "github" }), "Error: unknown action explode.")
  assert.deepEqual(calls, [])
})

test("surfaces a failed connect from the status map", async () => {
  const { client } = fakeClient({ github: { status: "pending" } })
  client.mcp.connect = async () => ({ data: {} })
  client.mcp.status = async () => ({ data: { github: { status: "failed", error: "boom" } } })
  const hooks = await plugin.server({ client })
  assert.equal(
    await hooks.tool.mcp_activate.execute({ action: "connect", server: "github" }),
    "Error: MCP connect failed for github: failed: boom",
  )
})

test("applies prompt overrides per key", async () => {
  const { def, run } = await tool({
    prompts: {
      description: ["LINE ONE", "LINE TWO"],
      connected: ">>> {server} is UP <<<",
      unknownServer: "no such {server}; have: {servers}",
    },
  })
  assert.equal(def.description, "LINE ONE\nLINE TWO")
  assert.equal(await run({ action: "connect", server: "nope" }), "no such nope; have: github, playwright")
  assert.equal(await run({ action: "connect", server: "github" }), ">>> github is UP <<<")
  assert.equal(
    await run({ action: "disconnect", server: "github" }),
    "Disconnected MCP github; its tools are gone from your next step.",
  )
})

test("resolve ignores malformed overrides", () => {
  const inputs = [
    null,
    42,
    { prompts: null },
    { prompts: "str" },
    { prompts: [] },
    { prompts: { description: 7, connected: ["a", 3] } },
    { prompts: { __proto__: { connected: "inherited" } } },
  ]
  for (const input of inputs) assert.deepEqual(resolve(input), DEFAULTS)
})

test("resolve never returns the shared defaults object", () => {
  assert.notEqual(resolve(undefined), DEFAULTS)
})

test("format substitutes safely", () => {
  assert.equal(format("{a} {b}", { a: "$& $1 $`", b: "{a}" }), "$& $1 $` {a}")
  assert.equal(format("a {nope} b", {}), "a {nope} b")
  assert.equal(format("x {constructor} y", { a: 1 }), "x {constructor} y")
})
