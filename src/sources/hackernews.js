import { JobSource, stripHtml } from "./base.js";
import { fetchJson, sleep, log, toIsoDate } from "../util.js";

const ROLE = /\b(developer|engineer|programmer|full[- ]?stack|front[- ]?end|back[- ]?end|software|web)\b/i;

// Turns one top-level "Who is hiring?" comment into a job, or null if it is not
// a remote posting in the usual "Company | Role | Location | REMOTE" format.
export function parsePost(comment, sourceId = "hackernews") {
  if (!comment?.text || !comment.id) return null;

  const header = stripHtml(comment.text.split(/<p>|\n/)[0]);
  const parts = header.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  if (!/remote/i.test(header)) return null;

  const company = parts[0];
  if (company.length > 80) return null;

  const title = parts.find((p, i) => i > 0 && ROLE.test(p)) ?? parts[1];
  const location =
    parts.find(
      (p, i) =>
        i > 0 && p !== title && /remote|onsite|hybrid|,|usa|\bus\b|\beu\b|uk|europe|worldwide/i.test(p)
    ) ?? "";

  return {
    source: sourceId,
    externalId: String(comment.id),
    title,
    company,
    url: `https://news.ycombinator.com/item?id=${comment.id}`,
    description: comment.text,
    location,
    remoteWorldwide: /worldwide|anywhere|global|international/i.test(header),
    postedAt: toIsoDate(comment.created_at)
  };
}

export class HackerNewsSource extends JobSource {
  id = "hackernews";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const months = this.options.months ?? 1;

    log(this.id, "looking up recent 'Who is hiring?' threads");
    const search = await fetchJson(
      "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=12"
    );
    const threads = (search.hits ?? [])
      .filter((h) => /who is hiring/i.test(h.title ?? ""))
      .slice(0, months);
    if (threads.length === 0) throw new Error("no 'Who is hiring?' thread found");

    const out = [];
    for (const [i, thread] of threads.entries()) {
      if (i > 0) await sleep(1000);
      log(this.id, `loading thread ${i + 1}/${threads.length}: ${thread.title}`);
      const item = await fetchJson(`https://hn.algolia.com/api/v1/items/${thread.objectID}`);
      const comments = item.children ?? [];
      const jobs = comments.map((c) => parsePost(c, this.id)).filter(Boolean);
      log(this.id, `${comments.length} comments, ${jobs.length} remote postings`);
      out.push(...jobs);
    }
    return out;
  }
}
