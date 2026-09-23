#!/usr/bin/env node
/**
 * Zero-dep stdio MCP server for TypeSafe Jev via Vercel AI Gateway.
 * Tools: systemone, evaluate, list_models — decision/eval only, not chat.
 * Never logs or returns the API key.
 */

import { createInterface } from "node:readline";
import {
  systemOne,
  evaluate,
  listModels,
  DEFAULT_MODEL,
} from "./client.mjs";

const SERVER_INFO = {
  name: "jev",
  version: "1.0.0",
};

const QUESTION_DESC =
  "Map of question name → { type, instructions, criteria? }. " +
  "systemone types: noul | choice | score. " +
  "evaluate types: boolean | choice | score.";

const TOOLS = [
  {
    name: "systemone",
    description:
      "TypeSafe systemOne evaluation via AI Gateway POST /typesafe/v1/systemone. " +
      "Pass state + typed questions (typically noul). Returns answers (e.g. noul probability), usage, and cost metadata when present. " +
      "Default model typesafe-ai/jev. This is a decision model — not a chat completion.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description:
            "Shared state / context to evaluate (string; structured state should be JSON-stringified if needed).",
        },
        questions: {
          type: "object",
          description: QUESTION_DESC,
          additionalProperties: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "noul | choice | score",
              },
              instructions: { type: "string" },
              criteria: {
                description:
                  "For choice: map of option→description. For score: ordered labels array. Optional for noul.",
              },
            },
            required: ["type", "instructions"],
          },
        },
        model: {
          type: "string",
          description: `Evaluation model id (default ${DEFAULT_MODEL})`,
        },
      },
      required: ["state", "questions"],
    },
  },
  {
    name: "evaluate",
    description:
      "Gateway evaluation API POST /v1/evaluate. Question types: boolean (→ probability), choice (→ choice + probabilities), score (→ score + probabilities). " +
      "Returns answers, usage, providerMetadata/cost when present. Default model typesafe-ai/jev. Honest error if the endpoint fails.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          description:
            "Shared state: string, object, or array (passed through to the API).",
        },
        questions: {
          type: "object",
          description: QUESTION_DESC,
          additionalProperties: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "boolean | choice | score",
              },
              instructions: { type: "string" },
              criteria: {
                description:
                  "boolean: { true, false }; choice: option→description map; score: ordered label array (min 2).",
              },
            },
            required: ["type", "instructions"],
          },
        },
        model: {
          type: "string",
          description: `Evaluation model id (default ${DEFAULT_MODEL})`,
        },
        providerOptions: {
          type: "object",
          description:
            "Optional AI Gateway providerOptions (e.g. gateway.zeroDataRetention, gateway.only).",
        },
      },
      required: ["state", "questions"],
    },
  },
  {
    name: "list_models",
    description:
      "List evaluation models available via GET /typesafe/v1/models on AI Gateway.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

async function callTool(name, args = {}) {
  switch (name) {
    case "systemone": {
      if (typeof args.state !== "string" || !args.state) {
        return { ok: false, error: "state must be a non-empty string" };
      }
      if (!args.questions || typeof args.questions !== "object") {
        return { ok: false, error: "questions must be an object map" };
      }
      return systemOne({
        state: args.state,
        questions: args.questions,
        model: args.model,
      });
    }
    case "evaluate": {
      if (args.state === undefined || args.state === null || args.state === "") {
        return { ok: false, error: "state is required" };
      }
      if (!args.questions || typeof args.questions !== "object") {
        return { ok: false, error: "questions must be an object map" };
      }
      return evaluate({
        state: args.state,
        questions: args.questions,
        model: args.model,
        providerOptions: args.providerOptions,
      });
    }
    case "list_models":
      return listModels();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function okResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function errResult(id, code, message, data) {
  send({
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  });
}

async function handle(msg) {
  if (!msg || typeof msg !== "object") return;
  const { id, method, params } = msg;

  if (id === undefined || id === null) {
    if (method === "notifications/initialized") return;
    return;
  }

  try {
    if (method === "initialize") {
      okResult(id, {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    }

    if (method === "ping") {
      okResult(id, {});
      return;
    }

    if (method === "tools/list") {
      okResult(id, { tools: TOOLS });
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};
      if (!toolName) {
        errResult(id, -32602, "Missing tool name");
        return;
      }
      const payload = await callTool(toolName, args);
      const isError = payload && payload.ok === false;
      okResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
        isError: Boolean(isError),
      });
      return;
    }

    errResult(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    // Never include env/key in error surfaces
    const message = err?.message || String(err);
    errResult(id, -32603, message);
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  Promise.resolve(handle(msg)).catch((err) => {
    if (msg?.id != null) {
      errResult(msg.id, -32603, err?.message || String(err));
    }
  });
});

rl.on("close", () => process.exit(0));
