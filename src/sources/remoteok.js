import { JobSource } from "./base.js";
import { fetchJson } from "../util.js";

export class RemoteOkSource extends JobSource {
  id = "remoteok";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const url = new URL("https://remoteok.com/api");
    if (this.options.tag) url.searchParams.set("tag", this.options.tag);

    const data = await fetchJson(url);
    // The first array element is a legal notice, not a job.
    return data
      .filter((j) => j.id && j.position)
      .map((j) => {
        const location = j.location ?? "";
        const hasSalary = Boolean(j.salary_min || j.salary_max);
        return {
          source: this.id,
          externalId: String(j.id),
          title: j.position,
          company: j.company,
          url: j.url,
          description: j.description ?? "",
          location,
          // RemoteOK lists only remote jobs; blank location is treated as worldwide.
          remoteWorldwide: location.trim() === "" || /worldwide|anywhere/i.test(location),
          salaryMin: j.salary_min || null,
          salaryMax: j.salary_max || null,
          salaryCurrency: hasSalary ? "USD" : null,
          salaryPeriod: hasSalary ? "year" : null,
          postedAt: j.date ?? null
        };
      });
  }
}
