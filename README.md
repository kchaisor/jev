# jev — TypeSafe Jev via Vercel AI Gateway

Portable Cursor / Grok Bot **Agent Plugin** that exposes TypeSafe Jev as MCP **evaluate** tools (decision model). Not a chat model.

Crew bots call `systemone`, `evaluate`, and `list_models` to score state against typed questions. Answers come back as probabilities / choices / scores — no free-form text to parse.

## Tools

| Tool | Endpoint | Purpose |
|------|----------|---------|
| `systemone` | `POST /typesafe/v1/systemone` | TypeSafe shape (`noul` / `choice` / `score`) |
| `evaluate` | `POST /v1/evaluate` | Gateway eval shape (`boolean` / `choice` / `score`) |
| `list_models` | `GET /typesafe/v1/models` | List available evaluation models |

Default model: `typesafe-ai/jev` (overridable per call).

Base URL: `https://ai-gateway.vercel.sh`

## Auth (never put the key in code, logs, or chat)

Secret name: **`VERCEL_AI_GATEWAY_API_KEY`**

Alias accepted at runtime: `AI_GATEWAY_API_KEY`

### Plugin setup (Cursor / Agent Plugins)

1. Install / enable this plugin (path or Marketplace — this package is path-installable; Marketplace publish is out of scope).
2. Open **Plugins → Configure** (or the plugin setup UI) and set the variable:
   - Name: `VERCEL_AI_GATEWAY_API_KEY`
   - Value: your Vercel AI Gateway API key
3. `mcp.json` passes it through as:
   ```json
   "env": {
     "VERCEL_AI_GATEWAY_API_KEY": "${VERCEL_AI_GATEWAY_API_KEY}"
   }
   ```
   The `${VERCEL_AI_GATEWAY_API_KEY}` placeholder is filled by the host from plugin variables / secret card — the plugin never stores the value.

### Grok Bot / box secret card

Store the key on the box secret card as `card.VERCEL_AI_GATEWAY_API_KEY`. For local prove only, load into the shell env **without printing**:

```bash
export VERCEL_AI_GATEWAY_API_KEY="$(python3 -c 'import json;print(json.load(open("/home/box/sand-data/box-secrets.json"))["card"]["VERCEL_AI_GATEWAY_API_KEY"])')"
node scripts/prove-systemone.mjs
```

Create a Gateway key in the Vercel dashboard (AI Gateway → API keys) if you do not have one. Never paste the key into chat or commit it.

## Install (Grok Bot / Cursor)

Path install from this tree:

```
/workspace/jev
```

Layout:

```
jev/
  plugin.json
  mcp.json          # stdio node ${CURSOR_PLUGIN_ROOT}/server/index.mjs
  README.md
  STATUS.md
  skills/jev/SKILL.md
  server/index.mjs  # zero-dep stdio MCP
  server/client.mjs
  scripts/prove-systemone.mjs
```

- **Cursor**: add/enable the plugin so `mcp.json` is loaded; configure `VERCEL_AI_GATEWAY_API_KEY` in plugin setup.
- **Grok Bot crew**: enable the plugin against this path; ensure the secret card (or process env) provides `VERCEL_AI_GATEWAY_API_KEY` before tool calls.

Zero npm dependencies — Node 18+ with global `fetch` is enough.

## Example: systemone (noul)

```json
{
  "state": "I was charged twice. I want my money back.",
  "questions": {
    "refund": {
      "type": "noul",
      "instructions": "Is the customer asking for money back?"
    }
  }
}
```

Response includes `answers` (e.g. `{ "refund": { "type": "noul", "noul": 0.99 } }`), `usage`, and cost from `provider_metadata` when present. Answers are not redacted.

## Example: evaluate (boolean | choice | score)

```json
{
  "state": "The agent fixed the checkout bug and all tests pass.",
  "questions": {
    "continueWorking": {
      "type": "boolean",
      "instructions": "Should the agent take another step?"
    }
  }
}
```

- **boolean** → `probability` 0–1  
- **choice** → `choice` + `probabilities` (criteria: option→description map)  
- **score** → `score` + `probabilities` (criteria: ordered label array)

If `/v1/evaluate` fails, the tool returns an honest error (`ok: false`, status, message) — no invented answers.

## Security

- Key only from env / plugin variable `${VERCEL_AI_GATEWAY_API_KEY}`
- Server never logs the Bearer token or key value
- Tool results omit authorization fields; answer payloads are returned in full
