#!/usr/bin/env node
/**
 * Smoke: systemone refund noul against charged-twice state.
 * Expect HTTP 200 and answers.refund.noul near 0.99.
 * Prints answers + usage only — never the API key.
 *
 * Load key first (shell), do not echo it:
 *   export VERCEL_AI_GATEWAY_API_KEY="$(python3 -c 'import json;print(json.load(open("/home/box/sand-data/box-secrets.json"))["card"]["VERCEL_AI_GATEWAY_API_KEY"])')"
 *   node scripts/prove-systemone.mjs
 */

import { systemOne } from "../server/client.mjs";

const state =
  "I was charged twice for my subscription. I want my money back.";
const questions = {
  refund: {
    type: "noul",
    instructions: "Is the customer asking for money back?",
  },
};

const result = await systemOne({ state, questions });

if (!result.ok) {
  console.error("FAIL", {
    status: result.status,
    error: result.error,
  });
  process.exit(1);
}

const noul = result.answers?.refund?.noul;
console.log(
  JSON.stringify(
    {
      ok: true,
      status: result.status,
      answers: result.answers,
      usage: result.usage,
      cost: result.cost ?? null,
      refund_noul: noul,
    },
    null,
    2
  )
);

if (typeof noul !== "number" || noul < 0.9) {
  console.error(
    `Unexpected answers.refund.noul=${noul} (expected near 0.99 / >= 0.9)`
  );
  process.exit(2);
}

process.exit(0);
