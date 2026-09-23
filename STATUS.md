# jev plugin — STATUS

**Version:** 1.0.0  
**Path:** `/workspace/jev`  
**Date:** 2026-09-23 (Australia/Sydney)

## Implemented

- [x] Agent Plugin layout (`plugin.json`, `mcp.json`, skill, server, prove script)
- [x] Zero-dep stdio MCP: `systemone`, `evaluate`, `list_models`
- [x] Auth via `VERCEL_AI_GATEWAY_API_KEY` (alias `AI_GATEWAY_API_KEY`); mcp.env `${VERCEL_AI_GATEWAY_API_KEY}`
- [x] Client: `POST /typesafe/v1/systemone`, `POST /v1/evaluate`, `GET /typesafe/v1/models`
- [x] Default model `typesafe-ai/jev`
- [x] Returns answers + usage + cost metadata when present; never returns API key
- [x] `scripts/prove-systemone.mjs` smoke for refund noul

## Smoke results (2026-09-23 AEST)

**systemone** (`POST /typesafe/v1/systemone`) — HTTP 200

- `answers.refund.noul`: **0.99**
- `usage`: `{ "input_tokens": 288, "output_tokens": 20 }`
- `cost`: `"0"` (promo / free window)

**evaluate** (`POST /v1/evaluate`) — HTTP 200

- `answers.refund.probability`: **0.99**
- `usage`: `{ "inputTokens": 288, "outputTokens": 20 }`

**list_models** — HTTP 200; returns `{ models: [...] }` including `jev`.

## Auth note

Crew installs with secret name **`VERCEL_AI_GATEWAY_API_KEY`** (plugin setup / secret card). No key samples in repo.

## evaluate endpoint

Shape confirmed from Vercel docs (changelog + evaluation modality, Sep 2026): `POST https://ai-gateway.vercel.sh/v1/evaluate` with `model`, `state`, `questions` of types `boolean` | `choice` | `score`. Implemented and smoke-verified; no endpoint issues.

## Out of scope

- Marketplace publish
- Kelvin messaging
