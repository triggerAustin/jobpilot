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
    // options.category may be one name or a list of names.
    const wanted = [].concat(this.options.category ?? []).map((c) => c.toLowerCase());
    const all = Array.isArray(data) ? data : [];

    const rows = all.filter(
      (j) =>
        j.url &&
        j.title &&
        !j.expired &&
        (wanted.length === 0 || wanted.includes((j.category_name ?? "").toLowerCase()))
    );
    log(this.id, `${rows.length} listings after category/expiry filter`);
    if (rows.length === 0 && wanted.length > 0) {
      const seen = [...new Set(all.map((j) => j.category_name).filter(Boolean))];
      log(this.id, `no category matched; categories in the feed: ${seen.join(", ")}`);
    }
    return rows.map((j) => mapJob(j, this.id));
  }
}
