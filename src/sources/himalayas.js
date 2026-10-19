import { JobSource } from "./base.js";
import { fetchJson, sleep, log, toIsoDate } from "../util.js";

const PAGE_SIZE = 20;

export function mapJob(j, sourceId = "himalayas") {
  const restrictions = [].concat(j.locationRestrictions ?? []).filter(Boolean);
  const hasSalary = Boolean(j.minSalary || j.maxSalary);
  const link = j.applicationLink ?? j.guid ?? "";
  return {
    source: sourceId,
    externalId: String(j.guid ?? link),
    title: j.title,
    company: j.companyName,
    url: link,
    description: j.description || j.excerpt || "",
    location: restrictions.join(", "),
    // Himalayas lists only remote jobs; no restrictions means open to anyone.
    remoteWorldwide:
      restrictions.length === 0 || restrictions.some((r) => /worldwide|anywhere/i.test(r)),
    salaryMin: j.minSalary || null,
    salaryMax: j.maxSalary || null,
    salaryCurrency: hasSalary ? (j.currency ?? "USD") : null,
    salaryPeriod: hasSalary ? "year" : null,
    postedAt: toIsoDate(j.pubDate)
  };
}

export class HimalayasSource extends JobSource {
  id = "himalayas";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const maxPages = this.options.maxPages ?? 5;
    const search = this.options.search;
    const out = [];

    for (let page = 0; page < maxPages; page++) {
      if (page > 0) await sleep(1000);

      const url = new URL(
        search ? "https://himalayas.app/jobs/api/search" : "https://himalayas.app/jobs/api"
      );
      if (search) {
        url.searchParams.set("q", search);
        url.searchParams.set("page", String(page + 1));
      } else {
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("offset", String(page * PAGE_SIZE));
      }

      log(this.id, `page ${page + 1}/${maxPages}`);
      const data = await fetchJson(url);
      const jobs = (data.jobs ?? []).filter((j) => j.title && j.companyName);
      out.push(...jobs.map((j) => mapJob(j, this.id)));
      if ((data.jobs ?? []).length < PAGE_SIZE) break;
    }

    log(this.id, `fetched ${out.length} listings`);
    return out;
  }
}
