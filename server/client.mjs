/**
 * Vercel AI Gateway HTTP helpers for TypeSafe Jev.
 * Auth from env only — never log or return the key.
 */

const BASE = "https://ai-gateway.vercel.sh";
const DEFAULT_MODEL = "typesafe-ai/jev";

export { BASE, DEFAULT_MODEL };

/**
 * Resolve API key from env. Prefers VERCEL_AI_GATEWAY_API_KEY, accepts AI_GATEWAY_API_KEY.
 * @returns {string}
 */
export function getApiKey() {
  const key =
    process.env.VERCEL_AI_GATEWAY_API_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    "";
  if (!key || typeof key !== "string" || !key.trim()) {
    throw new Error(
      "Missing API key. Set VERCEL_AI_GATEWAY_API_KEY (or alias AI_GATEWAY_API_KEY) via plugin setup / secret card. Do not put the key in code."
    );
  }
  return key.trim();
}

/**
 * Strip any accidental key material from objects before returning to clients.
 * Does not redact answer content.
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeForReturn(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    // Never return something that looks like we embedded the key
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForReturn);
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const lower = k.toLowerCase();
      if (
        lower.includes("api_key") ||
        lower.includes("apikey") ||
        lower === "authorization" ||
        lower === "bearer"
      ) {
        continue;
      }
      out[k] = sanitizeForReturn(v);
    }
    return out;
  }
  return value;
}

/**
 * @param {string} method
 * @param {string} path - absolute path under BASE, e.g. /typesafe/v1/systemone
 * @param {object} [body]
 * @returns {Promise<{ ok: boolean, status: number, data: any, error?: string }>}
 */
export async function gatewayFetch(method, path, body) {
  const key = getApiKey();
  const url = `${BASE}${path}`;
  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  /** @type {RequestInit} */
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: `Network error calling ${method} ${path}: ${err?.message || String(err)}`,
    };
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 2000) };
    }
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.error_type)) ||
      `HTTP ${res.status}`;
    return {
      ok: false,
      status: res.status,
      data: sanitizeForReturn(data),
      error: typeof msg === "string" ? msg : JSON.stringify(msg),
    };
  }

  return {
    ok: true,
    status: res.status,
    data: sanitizeForReturn(data),
  };
}

/**
 * Build a success payload with answers + usage + optional cost metadata.
 * @param {any} data
 */
export function shapeResult(data) {
  if (!data || typeof data !== "object") {
    return { answers: data, usage: null };
  }
  const out = {
    model: data.model,
    answers: data.answers,
    usage: data.usage ?? null,
  };
  // TypeSafe path uses provider_metadata; evaluate HTTP may use providerMetadata
  const meta = data.provider_metadata ?? data.providerMetadata;
  if (meta != null) {
    if (data.provider_metadata != null) out.provider_metadata = meta;
    if (data.providerMetadata != null) out.providerMetadata = meta;
    const cost =
      meta?.gateway?.cost ??
      meta?.gateway?.gatewayCost ??
      meta?.cost;
    if (cost != null) out.cost = cost;
  }
  return out;
}

/**
 * POST /typesafe/v1/systemone
 */
export async function systemOne({ state, questions, model }) {
  const body = {
    model: model || DEFAULT_MODEL,
    state,
    questions,
  };
  const res = await gatewayFetch("POST", "/typesafe/v1/systemone", body);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: res.error,
      detail: res.data,
    };
  }
  return { ok: true, status: res.status, ...shapeResult(res.data) };
}

/**
 * POST /v1/evaluate — boolean | choice | score
 */
export async function evaluate({ state, questions, model, providerOptions }) {
  const body = {
    model: model || DEFAULT_MODEL,
    state,
    questions,
  };
  if (providerOptions != null) body.providerOptions = providerOptions;
  const res = await gatewayFetch("POST", "/v1/evaluate", body);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: res.error,
      detail: res.data,
    };
  }
  return { ok: true, status: res.status, ...shapeResult(res.data) };
}

/**
 * GET /typesafe/v1/models
 */
export async function listModels() {
  const res = await gatewayFetch("GET", "/typesafe/v1/models");
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: res.error,
      detail: res.data,
    };
  }
  return { ok: true, status: res.status, models: res.data };
}
