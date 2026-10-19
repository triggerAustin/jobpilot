import { JobSource } from "./base.js";
import { fetchJson } from "../util.js";

const PERIODS = { hourly: "hour", monthly: "month", yearly: "year" };

export function mapJob(j, sourceId = "jobicy") {
  const geo = [].concat(j.jobGeo ?? []).join(", ");
  const hasSalary = Boolean(j.salaryMin || j.salaryMax);
  return {
    source: sourceId,
    externalId: String(j.id),
    title: j.jobTitle,
    company: j.companyName,
    url: j.url,
    description: j.jobDescription || j.jobExcerpt || "",
    location: geo,
    remoteWorldwide: /anywhere|worldwide/i.test(geo),
    salaryMin: j.salaryMin || null,
    salaryMax: j.salaryMax || null,
    salaryCurrency: hasSalary ? (j.salaryCurrency ?? null) : null,
    salaryPeriod: hasSalary ? (PERIODS[j.salaryPeriod] ?? null) : null,
    postedAt: j.pubDate ?? null
  };
}

export class JobicySource extends JobSource {
  id = "jobicy";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const url = new URL("https://jobicy.com/api/v2/remote-jobs");
    url.searchParams.set("count", String(this.options.count ?? 100));
    for (const key of ["tag", "geo", "industry"]) {
      if (this.options[key]) url.searchParams.set(key, this.options[key]);
    }
    const data = await fetchJson(url);
    return (data.jobs ?? []).filter((j) => j.id && j.jobTitle).map((j) => mapJob(j, this.id));
  }
}
