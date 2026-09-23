---
name: jev
description: Use TypeSafe Jev (via Vercel AI Gateway MCP tools) as a decision/evaluation model. Call systemone or evaluate — never treat Jev as a chat model. Auth is VERCEL_AI_GATEWAY_API_KEY from plugin setup / secret card only.
---

# jev — decision evaluations

## When to use

Use these MCP tools when a crew bot needs a **typed decision** over shared state: refund intent, route ticket, continue-working, rubric score, etc.

Do **not** use Jev as a chat / completion model. Do **not** put the API key in prompts, code, or logs.

## Auth

- Env / plugin variable: `VERCEL_AI_GATEWAY_API_KEY` (runtime alias `AI_GATEWAY_API_KEY`)
- Configured via plugin setup field `${VERCEL_AI_GATEWAY_API_KEY}` or box secret card
- If tools fail with missing key, ask the operator to set the secret — never invent or request the key value in chat

## Tools

### systemone

TypeSafe API. Prefer when you need **noul** (0–1 probability).

Args:

- `state` (string, required)
- `questions` (object map, required): each value `{ type: "noul"|"choice"|"score", instructions, criteria? }`
- `model` (optional, default `typesafe-ai/jev`)

Return: `answers`, `usage`, optional cost from `provider_metadata`. Trust answer fields as-is.

### evaluate

Gateway HTTP evaluation API. Prefer for new code with **boolean** / **choice** / **score**.

Args:

- `state` (string | object | array)
- `questions`: `{ type: "boolean"|"choice"|"score", instructions, criteria? }`
- `model` (optional)
- `providerOptions` (optional)

Return: `answers` (e.g. boolean → `probability`), `usage`, optional `providerMetadata` / cost. On HTTP failure: `ok: false` with status and error — do not invent results.

### list_models

No args. Lists evaluation models from `GET /typesafe/v1/models`.

## Patterns

1. Put the full relevant state in `state` (transcript, tool result summary, ticket text).
2. Ask one or more named questions in one call.
3. Threshold on probabilities (e.g. `noul >= 0.8` or `probability >= 0.8`) in your policy — Jev does not execute side effects.
4. Prefer `systemone` + `noul` when matching existing TypeSafe clients; prefer `evaluate` + `boolean` for new Gateway-native code.

## Smoke (operators only)

Load key silently from secret card, then:

```bash
node /workspace/jev/scripts/prove-systemone.mjs
```

Expect `answers.refund.noul` near 0.99. Print answers/usage only.
