# opencode-mcp-activate

An [opencode](https://opencode.ai) plugin that lets the model start and stop configured MCP servers at runtime, through a single `mcp_activate` tool.

## Why

Every connected MCP server injects its tool schemas into every request. A handful of heavy servers can cost tens of thousands of tokens of context before the model has done anything.

Register servers with `"enabled": false` and they cost nothing. When a capability is actually needed, the model calls `mcp_activate` to start that one server, and disconnects it when it's done.

## Install

opencode installs plugins itself from any npm specifier, so point it straight at this repo:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:mazzz1y/opencode-mcp-activate#v1.0.0"],
  "mcp": {
    "github": {
      "type": "local",
      "command": ["github-mcp-server", "stdio"],
      "enabled": false
    }
  }
}
```

### Nix

This repo is a flake exposing `packages.<system>.default` and `overlays.default`. Add it as an input, apply the overlay, and point the `plugin` entry at the store path — e.g. in a home-manager module:

```nix
{ inputs, pkgs, ... }:
{
  nixpkgs.overlays = [ inputs.opencode-mcp-activate.overlays.default ];
  programs.opencode.settings.plugin = [ "${pkgs.opencode-mcp-activate}" ];
}
```

Or try it without adding an input:

```bash
nix build github:mazzz1y/opencode-mcp-activate
```

`result` is a directory containing `index.js` and `prompts.js` — use it as the plugin entry.

## Usage

```
mcp_activate(action: "connect" | "disconnect", server: string)
```

- `connect` — starts a configured but disconnected server. Its tools become available on the model's **next** step, not the current one.
- `disconnect` — stops a running server and frees its context. The config entry is untouched.

Passing an unknown server name returns the list of every configured server, so the model can discover what's available without a separate `list` action.

## Customising prompts

Every string the tool emits — its description, argument descriptions, and result messages — lives in [`prompts.js`](prompts.js) and can be overridden by passing options as a `[name, options]` tuple:

```json
{
  "plugin": [
    ["github:mazzz1y/opencode-mcp-activate#v1.0.0", {
      "prompts": {
        "description": ["Start or stop an MCP server.", "", "Do it yourself; don't ask."],
        "connected": "{server} is up — its tools land on your next step."
      }
    }]
  ]
}
```

Only the keys you set are replaced; the rest keep their defaults. A string array is joined with newlines, which keeps multi-line prompts readable in JSON.

Available keys and their placeholders:

| Key | Placeholders |
| --- | --- |
| `description` | — |
| `actionDescription` | — |
| `serverDescription` | — |
| `unknownAction` | `{action}` |
| `unknownServer` | `{server}`, `{servers}` |
| `alreadyDisconnected` | `{server}`, `{status}` |
| `disconnected` | `{server}` |
| `alreadyConnected` | `{server}` |
| `connected` | `{server}` |
| `failed` | `{action}`, `{server}`, `{message}` |

## Notes

- `client.mcp.status()` returns every server in the merged config regardless of its enabled flag, so servers are discovered rather than hardcoded. Adding one to your opencode config makes it activatable with no change here.
- `client.mcp.connect()` resolves only after the transport attempt and tool listing finish, but reports success even when they failed. The plugin reads the status map back and surfaces the real outcome (`needs_auth`, `failed`, …) instead of falsely claiming success.

## Known issue

* The TUI caches MCP state at startup, so a server started through `mcp_activate` keeps showing as disabled in the `/mcp` list even though its tools are live and the model is using them. This is a display problem only.
* The plugin is currently incompatible with OpenCode v2

## License

MIT
