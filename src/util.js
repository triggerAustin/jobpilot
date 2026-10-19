export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Progress log used by adapters and the pipeline: "[scope] message".
export const log = (scope, msg) => console.log(`[${scope}] ${msg}`);

// Hide secrets that travel in a URL (API keys, app names) from logs and errors.
const redact = (url) =>
  String(url).replace(/(jooble\.org\/api\/)[^/?]+/, "$1***").replace(/appname=[^&]+/, "appname=***");

async function request(url, init, retries) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    // Network-level failure (DNS, timeout, reset). Retry a few times.
    const reason = err.cause?.code ?? err.cause?.message ?? err.message;
    if (retries > 0) {
      log("net", `${redact(url)} failed (${reason}), retrying`);
      await sleep(2000);
      return request(url, init, retries - 1);
    }
    throw new Error(`${redact(url)} -> ${reason}`);
  }

  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get("retry-after")) || 5;
    await sleep(wait * 1000);
    return request(url, init, retries - 1);
  }
  if (!res.ok) throw new Error(`${redact(url)} -> HTTP ${res.status}`);
  return res;
}

const HEADERS = { "User-Agent": "jobpilot/0.1 (personal job search tool)" };

export async function fetchJson(url, { retries = 3 } = {}) {
  const res = await request(url, { headers: { ...HEADERS, Accept: "application/json" } }, retries);
  return res.json();
}

export async function postJson(url, body, { retries = 3 } = {}) {
  const init = {
    method: "POST",
    headers: { ...HEADERS, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
  const res = await request(url, init, retries);
  return res.json();
}

export async function fetchText(url, { retries = 3 } = {}) {
  const res = await request(
    url,
    { headers: { ...HEADERS, Accept: "application/rss+xml, application/xml, text/xml, */*" } },
    retries
  );
  return res.text();
}

// Accepts ISO strings, epoch seconds or epoch milliseconds. Returns an ISO string or null.
export function toIsoDate(value) {
  if (value == null || value === "") return null;
  let d;
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const n = Number(value);
    d = new Date(n < 1e12 ? n * 1000 : n);
  } else {
    d = new Date(value);
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
