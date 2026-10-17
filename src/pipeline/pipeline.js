import { readFileSync } from "node:fs";
import { openDb } from "../db/db.js";
import { checkEligibility } from "./eligibility.js";
import { scoreJob } from "./score.js";

const loadJson = (name) =>
  JSON.parse(readFileSync(new URL(`../../config/${name}`, import.meta.url), "utf8"));

export function rankAll({
  db = openDb(),
  limit = 25,
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
      `SELECT id, company, job_title AS title, match_score AS score,
              remote_worldwide AS remote, eligibility_flags AS flags
       FROM applications
       WHERE status = 'ranked'
       ORDER BY (eligibility_flags = '[]') DESC, match_score DESC, remote_worldwide DESC
       LIMIT ?`
    )
    .all(limit)
    .map((r) => ({ ...r, flags: JSON.parse(r.flags).join(", ") }));

  console.log(`Ranked ${rows.length} jobs. Showing top ${top.length}.`);
  console.table(top);
  return top;
}
