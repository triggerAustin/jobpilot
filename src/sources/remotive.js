import { JobSource } from "./base.js"; import { fetchJson } from "../util.js";

export class RemotiveSource extends JobSource {
  id = "remotive";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const url = new URL("https://remotive.com/api/remote-jobs");
    if (this.options.category) url.searchParams.set("category", this.options.category);
    if (this.options.search) url.searchParams.set("search", this.options.search);

    const data = await fetchJson(url);
    return (data.jobs ?? []).map((j) => ({
      source: this.id,
      externalId: String(j.id),
      title: j.title,
      company: j.company_name,
      url: j.url,
      description: j.description,
      location: j.candidate_required_location ?? "",
      remoteWorldwide: /worldwide|anywhere/i.test(j.candidate_required_location ?? ""),
      postedAt: j.publication_date ?? null
      // Remotive's salary field is free text, so it is not parsed here.
    }));
  }
}
