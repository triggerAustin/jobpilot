export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJson(url, { retries = 1 } = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "jobpilot/0.1 (personal job search tool)",
      Accept: "application/json"
    }
  });

  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get("retry-after")) || 5;
    await sleep(wait * 1000);
    return fetchJson(url, { retries: retries - 1 });
  }
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}
