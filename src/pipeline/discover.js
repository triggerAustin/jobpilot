import { readFileSync } from "node:fs";
import { buildAdapters } from "../sources/index.js";
import { normalizeJob } from "../sources/base.js";
import { openDb, insertJob } from "../db/db.js";
import { sleep, log } from "../util.js";

function loadConfig() {
  const path = new URL("../../config/sources.json", import.meta.url);
  return JSON.parse(readFileSync(path, "utf8"));
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildKeywordFilter(keywords = [], titleKeywords = []) {
  const toRegexes = (list) =>
    list.map((k) => new RegExp(`(?<![\\w])${escapeRegex(k)}(?![\\w])`, "i"));
  const stack = toRegexes(keywords);
  const roles = toRegexes(titleKeywords);

  return (job) => {
    if (roles.length && !roles.some((p) => p.test(job.title))) return false;
    if (stack.length === 0) return true;
    const text = `${job.title} ${job.description}`;
    return stack.some((p) => p.test(text));
  };
}

export async function discover({ db = openDb(), config = loadConfig() } = {}) {
  const adapters = buildAdapters(config);
  const isRelevant = buildKeywordFilter(config.filter?.keywords, config.filter?.titleKeywords);
  const summary = [];

  for (const [i, adapter] of adapters.entries()) {
    if (i > 0) await sleep(1500);

    const stat = {
      source: adapter.id,
      returned: 0,
      invalid: 0,
      filtered: 0,
      duplicates: 0,
      inserted: 0,
      error: ""
    };

    try {
      log("discover", `(${i + 1}/${adapters.length}) ${adapter.id}: fetching`);
      const raws = await adapter.fetchJobs();
      stat.returned = raws.length;
      for (const raw of raws) {
        const job = normalizeJob(raw);
        if (!job) {
          stat.invalid++;
          continue;
        }
        if (!isRelevant(job)) {
          stat.filtered++;
          continue;
        }
        const { inserted } = insertJob(db, job);
        if (inserted) stat.inserted++;
        else stat.duplicates++;
      }
      log(
        "discover",
        `${adapter.id}: ${stat.inserted} new, ${stat.duplicates} duplicates, ${stat.filtered} filtered out, ${stat.invalid} invalid`
      );
    } catch (err) {
      stat.error = err.message;
      log("discover", `${adapter.id}: failed (${err.message})`);
    }
    summary.push(stat);
  }

  console.table(summary);
  return summary;
}
