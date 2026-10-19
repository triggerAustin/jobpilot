import { JobSource, decodeEntities } from "./base.js";
import { fetchText, sleep, log, toIsoDate } from "../util.js";

const DEFAULT_FEEDS = [
  "remote-programming-jobs",
  "remote-full-stack-programming-jobs",
  "remote-front-end-programming-jobs"
];

function tag(block, name) {
  const re = new RegExp(
    `<${name}[^>]*>(?:\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*|([\\s\\S]*?))</${name}>`,
    "i"
  );
  const m = block.match(re);
  if (!m) return "";
  return m[1] !== undefined ? m[1].trim() : decodeEntities(m[2]).trim();
}

// Minimal RSS reader: returns one plain object per <item>.
export function parseRss(xml = "") {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => ({
    title: tag(m[1], "title"),
    link: tag(m[1], "link"),
    guid: tag(m[1], "guid"),
    region: tag(m[1], "region"),
    country: tag(m[1], "country"),
    description: tag(m[1], "description"),
    pubDate: tag(m[1], "pubDate")
  }));
}

// WWR titles look like "Company: Role".
export function mapItem(item, sourceId = "weworkremotely") {
  const idx = item.title.indexOf(": ");
  const company = idx > 0 ? item.title.slice(0, idx) : "";
  const title = idx > 0 ? item.title.slice(idx + 2) : item.title;
  const location = item.region || item.country || "";
  return {
    source: sourceId,
    externalId: item.guid || item.link,
    title,
    company,
    url: item.link || item.guid,
    description: item.description,
    location,
    remoteWorldwide: /anywhere/i.test(location),
    postedAt: toIsoDate(item.pubDate)
  };
}

export class WeWorkRemotelySource extends JobSource {
  id = "weworkremotely";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const feeds = this.options.feeds ?? DEFAULT_FEEDS;
    const seen = new Set();
    const out = [];
    let failed = 0;

    for (const [i, feed] of feeds.entries()) {
      if (i > 0) await sleep(1000);
      try {
        log(this.id, `feed ${i + 1}/${feeds.length}: ${feed}`);
        const xml = await fetchText(`https://weworkremotely.com/categories/${feed}.rss`);
        const items = parseRss(xml);
        let added = 0;
        for (const item of items) {
          const key = item.guid || item.link;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          out.push(mapItem(item, this.id));
          added++;
        }
        log(this.id, `${feed}: ${items.length} items, ${added} new`);
      } catch (err) {
        failed++;
        log(this.id, `${feed}: skipped (${err.message})`);
      }
    }

    if (feeds.length > 0 && failed === feeds.length) throw new Error("all feeds failed");
    return out;
  }
}
