export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Progress log used by adapters and the pipeline: "[scope] message".
export const log = (scope, msg) => console.log(`[${scope}] ${msg}`);

async function request(url, accept, retries) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "jobpilot/0.1 (personal job search tool)", Accept: accept }
    });
  } catch (err) {
    // Network-level failure (DNS, timeout, reset). Retry a couple of times.
    const reason = err.cause?.code ?? err.cause?.message ?? err.message;
    if (retries > 0) {
      console.log(`[net] ${url} failed (${reason}), retrying`);
      await sleep(2000);
      return request(url, accept, retries - 1);
    }
    throw new Error(`${url} -> ${reason}`);
  }

  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get("retry-after")) || 5;
    await sleep(wait * 1000);
    return request(url, accept, retries - 1);
  }
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res;
}

export async function fetchJson(url, { retries = 3 } = {}) {
  const res = await request(url, "application/json", retries);
  return res.json();
}

export async function fetchText(url, { retries = 1 } = {}) {
  const res = await request(url, "application/rss+xml, application/xml, text/xml, */*", retries);
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
