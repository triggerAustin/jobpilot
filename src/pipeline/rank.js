import { openDb } from "../db/db.js";
import { checkEligibility, SOFT_FLAGS } from "./eligibility.js";
import { scoreJob } from "./score.js";
import { loadJson } from "../config.js";

export function rankAll({
  db = openDb(),
  limit = 25,
  offset = 0,
  profile = loadJson("profile.json"),
  scoring = loadJson("scoring.json")
} = {}) {
  const rows = db
    .prepare("SELECT * FROM applications WHERE status IN ('discovered', 'ranked')")
    .all();

  const update = db.prepare(`
    UPDATE applications
    SET match_score = ?, matched_skills = ?, missing_skills = ?,
        eligibility_flags = ?, status = 'ranked'
    WHERE id = ?
  `);
  const history = db.prepare(
    "INSERT INTO status_history (application_id, status) VALUES (?, 'ranked')"
  );

  const run = db.transaction(() => {
    for (const row of rows) {
      const job = {
        title: row.job_title,
        source: row.source,
        description: row.description ?? "",
        location: row.location ?? "",
        remoteWorldwide: Boolean(row.remote_worldwide),
        salaryMax: row.salary_max,
        salaryCurrency: row.salary_currency,
        salaryPeriod: row.salary_period
      };
      const { flags } = checkEligibility(job, profile);
      const s = scoreJob(job, profile, scoring.aliases);

      update.run(
        s.score,
        JSON.stringify(s.matchedSkills),
        JSON.stringify(s.missingSkills),
        JSON.stringify(flags),
        row.id
      );
      if (row.status === "discovered") history.run(row.id);
    }
  });
  run();

  const top = db
    .prepare(
      `SELECT id, company, job_title AS title, location, match_score AS score,
              remote_worldwide AS remote, eligibility_flags AS flags
       FROM applications
       WHERE status = 'ranked'`
    )
    .all()
    .map((r) => {
      const flagList = JSON.parse(r.flags);
      return { ...r, flagList, hard: flagList.filter((f) => !SOFT_FLAGS.has(f)).length };
    })
    .sort((a, b) => a.hard - b.hard || b.score - a.score || b.remote - a.remote)
    .slice(offset, offset + limit)
    .map((r, i) => ({
      rank: offset + i + 1,
      id: r.id,
      company: r.company,
      title: r.title,
      location: (r.location ?? "").slice(0, 40),
      score: r.score,
      remote: r.remote,
      flags: r.flagList.join(", ")
    }));

  console.log(`Ranked ${rows.length} jobs. Showing ${offset + 1}-${offset + top.length}.`);
  console.table(top);
  return top;
}
