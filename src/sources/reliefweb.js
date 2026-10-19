// ReliefWeb (reliefweb.int): humanitarian, NGO and development jobs, filterable by
// country and by required experience. Good for project and programme roles in Kenya.
//
// Options (config/sources.json):
//   appname     your ReliefWeb app name (or set the RELIEFWEB_APPNAME environment variable)
//   country     default "Kenya"
//   experience  for example ["0-2 years"] to keep entry-level postings
//   type        for example ["Internship", "Job"]
//   limit       default 100
import { JobSource } from "./base.js";
import { postJson, log, toIsoDate } from "../util.js";

const FIELDS = ["title", "url", "body-html", "source", "country", "city", "date"];

const names = (list) =>
  [].concat(list ?? [])
    .map((x) => x?.name)
    .filter(Boolean);

export function mapJob(item, sourceId = "reliefweb") {
  const f = item.fields ?? {};
  return {
    source: sourceId,
    externalId: String(item.id),
    title: f.title,
    company: names(f.source)[0] ?? "",
    url: f.url,
    description: f["body-html"] ?? "",
    location: [...names(f.city), ...names(f.country)].join(", "),
    remoteWorldwide: false,
    postedAt: toIsoDate(f.date?.created)
  };
}

export class ReliefWebSource extends JobSource {
  id = "reliefweb";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const appname = this.options.appname || process.env.RELIEFWEB_APPNAME;
    if (!appname) {
      throw new Error(
        "ReliefWeb needs an app name: set options.appname in sources.json or RELIEFWEB_APPNAME"
      );
    }

    const country = this.options.country ?? "Kenya";
    const conditions = [{ field: "country.name", value: country }];
    if (this.options.experience?.length) {
      conditions.push({ field: "experience.name", value: this.options.experience, operator: "OR" });
    }
    if (this.options.type?.length) {
      conditions.push({ field: "type.name", value: this.options.type, operator: "OR" });
    }

    const body = {
      filter: { operator: "AND", conditions },
      fields: { include: FIELDS },
      sort: ["date.created:desc"],
      limit: this.options.limit ?? 100
    };

    log(this.id, `requesting up to ${body.limit} jobs in ${country}`);
    const data = await postJson(
      `https://api.reliefweb.int/v2/jobs?appname=${encodeURIComponent(appname)}`,
      body
    );
    const items = (data.data ?? []).filter((i) => i.fields?.title);
    log(this.id, `fetched ${items.length} listings`);
    return items.map((i) => mapJob(i, this.id));
  }
}
