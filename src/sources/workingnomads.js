import { JobSource } from "./base.js";
import { fetchJson, log, toIsoDate } from "../util.js";

export function mapJob(j, sourceId = "workingnomads") {
  const location = j.location ?? "";
  return {
    source: sourceId,
    // The feed has no numeric id; the URL is stable and unique.
    externalId: String(j.url),
    title: j.title,
    company: j.company_name,
    url: j.url,
    description: j.description ?? "",
    location,
    remoteWorldwide: location.trim() === "" || /anywhere|worldwide/i.test(location),
    postedAt: toIsoDate(j.pub_date)
  };
}

export class WorkingNomadsSource extends JobSource {
  id = "workingnomads";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    log(this.id, "fetching feed");
    const data = await fetchJson("https://www.workingnomads.com/api/exposed_jobs/");
    const wanted = this.options.category?.toLowerCase();

    const rows = (Array.isArray(data) ? data : []).filter(
      (j) =>
        j.url &&
        j.title &&
        !j.expired &&
        (!wanted || (j.category_name ?? "").toLowerCase() === wanted)
    );
    log(this.id, `${rows.length} listings after category/expiry filter`);
    return rows.map((j) => mapJob(j, this.id));
  }
}
