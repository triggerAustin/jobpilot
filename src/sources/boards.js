// Company job boards on Greenhouse, Lever and Ashby. Each has an official public
// JSON API, so no scraping is involved. Boards are listed in config/sources.json:
//   "options": { "remoteOnly": true, "boards": [{ "id": "<slug>", "name": "<Company>" }] }
import { JobSource, decodeEntities } from "./base.js";
import { fetchJson, sleep, log, toIsoDate } from "../util.js";

const REMOTEISH = /remote|anywhere|worldwide|distributed/i;
const WORLDWIDE = /anywhere|worldwide/i;

async function collect(adapter, fetchBoard) {
  const boards = adapter.options.boards ?? [];
  const jobs = [];
  let failed = 0;

  for (const [i, board] of boards.entries()) {
    if (i > 0) await sleep(500);
    try {
      log(adapter.id, `board ${i + 1}/${boards.length}: ${board.id}`);
      const rows = await fetchBoard(board);
      log(adapter.id, `${board.id}: ${rows.length} postings`);
      jobs.push(...rows);
    } catch (err) {
      failed++;
      log(adapter.id, `${board.id}: skipped (${err.message})`);
    }
  }

  if (boards.length > 0 && failed === boards.length) throw new Error("all boards failed");
  return jobs;
}

// ---------- Greenhouse ----------

export function mapGreenhouseJob(j, board, sourceId = "greenhouse") {
  const location = j.location?.name ?? "";
  return {
    source: sourceId,
    externalId: `${board.id}:${j.id}`,
    title: j.title,
    company: board.name ?? board.id,
    url: j.absolute_url,
    // Greenhouse returns the description HTML-escaped.
    description: decodeEntities(j.content ?? ""),
    location,
    remoteWorldwide: WORLDWIDE.test(location),
    postedAt: toIsoDate(j.updated_at)
  };
}

export class GreenhouseSource extends JobSource {
  id = "greenhouse";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const remoteOnly = this.options.remoteOnly ?? true;
    return collect(this, async (board) => {
      const data = await fetchJson(
        `https://boards-api.greenhouse.io/v1/boards/${board.id}/jobs?content=true`
      );
      return (data.jobs ?? [])
        .filter((j) => j.id && j.title && j.absolute_url)
        .filter((j) => !remoteOnly || REMOTEISH.test(j.location?.name ?? ""))
        .map((j) => mapGreenhouseJob(j, board, this.id));
    });
  }
}

// ---------- Lever ----------

export function mapLeverJob(j, board, sourceId = "lever") {
  const location = j.categories?.location ?? "";
  const lists = (j.lists ?? []).map((l) => `${l.text} ${l.content}`);
  return {
    source: sourceId,
    externalId: `${board.id}:${j.id}`,
    title: j.text,
    company: board.name ?? board.id,
    url: j.hostedUrl,
    description: [j.description ?? j.descriptionPlain ?? "", ...lists, j.additional ?? ""].join(" "),
    location,
    remoteWorldwide: WORLDWIDE.test(location),
    postedAt: toIsoDate(j.createdAt)
  };
}

export class LeverSource extends JobSource {
  id = "lever";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const remoteOnly = this.options.remoteOnly ?? true;
    return collect(this, async (board) => {
      const data = await fetchJson(`https://api.lever.co/v0/postings/${board.id}?mode=json`);
      return (Array.isArray(data) ? data : [])
        .filter((j) => j.id && j.text && j.hostedUrl)
        .filter(
          (j) =>
            !remoteOnly ||
            j.workplaceType === "remote" ||
            REMOTEISH.test(j.categories?.location ?? "")
        )
        .map((j) => mapLeverJob(j, board, this.id));
    });
  }
}

// ---------- Ashby ----------

export function mapAshbyJob(j, board, sourceId = "ashby") {
  const location = j.location || (j.isRemote ? "Remote" : "");
  return {
    source: sourceId,
    externalId: `${board.id}:${j.id}`,
    title: j.title,
    company: board.name ?? board.id,
    url: j.jobUrl,
    description: j.descriptionHtml ?? j.descriptionPlain ?? "",
    location,
    remoteWorldwide: WORLDWIDE.test(location),
    postedAt: toIsoDate(j.publishedAt)
  };
}

export class AshbySource extends JobSource {
  id = "ashby";

  constructor(options = {}) {
    super();
    this.options = options;
  }

  async fetchJobs() {
    const remoteOnly = this.options.remoteOnly ?? true;
    return collect(this, async (board) => {
      const data = await fetchJson(
        `https://api.ashbyhq.com/posting-api/job-board/${board.id}`
      );
      return (data.jobs ?? [])
        .filter((j) => j.id && j.title && j.jobUrl && j.isListed !== false)
        .filter((j) => !remoteOnly || j.isRemote || REMOTEISH.test(j.location ?? ""))
        .map((j) => mapAshbyJob(j, board, this.id));
    });
  }
}
