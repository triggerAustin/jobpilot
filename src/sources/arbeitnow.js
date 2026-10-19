import { JobSource } from "./base.js";
import { fetchJson, sleep, log, toIsoDate } from "../util.js";

export function mapJob(j, sourceId = "arbeitnow") {
  return {
    source: sourceId,
    externalId: String(j.slug),
    title: j.title,
    company: j.company_name,
    url: j.url,
    description: j.description ?? "",
    location: j.location ?? "",
    // Mostly European employers: a remote flag rarely means "open to anyone".
    remoteWorldwide: false,
    postedAt: toIsoDate(j.created_at)
  };
}

export class ArbeitnowSource extends JobSource {
  id = "arbeitnow";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const maxPages = this.options.maxPages ?? 3;
    const remoteOnly = this.options.remoteOnly ?? true;
    const out = [];

    for (let page = 1; page <= maxPages; page++) {
      if (page > 1) await sleep(1000);
      const url = new URL("https://www.arbeitnow.com/api/job-board-api");
      url.searchParams.set("page", String(page));

      log(this.id, `page ${page}/${maxPages}`);
      const data = await fetchJson(url);
      const rows = data.data ?? [];
      if (rows.length === 0) break;

      out.push(
        ...rows
          .filter((j) => j.slug && j.title && (!remoteOnly || j.remote))
          .map((j) => mapJob(j, this.id))
      );
      if (!data.links?.next) break;
    }

    log(this.id, `fetched ${out.length} listings`);
    return out;
  }
}
