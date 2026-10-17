import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { openDb } from "../db/db.js";
import { SOFT_FLAGS } from "./eligibility.js";
import { renderCvHtml, renderCoverLetter } from "./templates.js";
import { loadJson } from "../config.js";

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export function prepare({
  db = openDb(),
  limit = 5,
  id = null,
  profile = loadJson("profile.json"),
  scoring = loadJson("scoring.json")
} = {}) {
  let rows;
  if (id) {
    rows = db.prepare("SELECT * FROM applications WHERE id = ?").all(id);
  } else {
    rows = db
      .prepare("SELECT * FROM applications WHERE status = 'ranked'")
      .all()
      .filter((r) => JSON.parse(r.eligibility_flags || "[]").every((f) => SOFT_FLAGS.has(f)))
      .sort((a, b) => b.match_score - a.match_score || b.remote_worldwide - a.remote_worldwide)
      .slice(0, limit);
  }
  if (rows.length === 0) {
    console.log("Nothing to prepare. Run `npm run rank` first, or check the id.");
    return [];
  }

  const date = new Date().toISOString().slice(0, 10);
  const clearDrafts = db.prepare("DELETE FROM drafts WHERE application_id = ?");
  const addDraft = db.prepare(
    "INSERT INTO drafts (application_id, question_key, answer, approved) VALUES (?, ?, ?, 0)"
  );
  const update = db.prepare(
    "UPDATE applications SET cv_path = ?, cover_letter_path = ?, status = 'prepared' WHERE id = ?"
  );
  const history = db.prepare(
    "INSERT INTO status_history (application_id, status) VALUES (?, 'prepared')"
  );

  const out = [];
  for (const row of rows) {
    const matched = JSON.parse(row.matched_skills || "[]");
    const missing = JSON.parse(row.missing_skills || "[]");
    const job = { company: row.company, title: row.job_title };
    const opts = { matchedSkills: matched, aliases: scoring.aliases };

    const dir = join("data", "output", `${slug(row.company)}-${slug(row.job_title)}-${date}`);
    mkdirSync(dir, { recursive: true });

    const cvPath = join(dir, "cv.html");
    const letterPath = join(dir, "cover-letter.txt");
    writeFileSync(cvPath, renderCvHtml(profile, opts));
    writeFileSync(letterPath, renderCoverLetter(profile, job, opts));
    writeFileSync(
      join(dir, "notes.json"),
      JSON.stringify(
        { id: row.id, company: row.company, title: row.job_title, url: row.job_url, score: row.match_score, matchedSkills: matched, missingSkills: missing },
        null,
        2
      )
    );

    db.transaction(() => {
      clearDrafts.run(row.id);
      for (const [key, answer] of Object.entries(profile.screeningAnswers)) addDraft.run(row.id, key, answer);
      update.run(cvPath, letterPath, row.id);
      history.run(row.id);
    })();

    out.push({ id: row.id, company: row.company, title: row.job_title, dir });
  }

  console.table(out);
  console.log("Review the files, then: npm run approve <id>");
  return out;
}

export function approve({ db = openDb(), id, confirm = false }) {
  const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
  if (!app) throw new Error(`No application with id ${id}`);
  if (!["prepared", "approved"].includes(app.status)) {
    throw new Error(`Application ${id} is '${app.status}'. Run prepare first.`);
  }

  const drafts = db
    .prepare("SELECT question_key, answer FROM drafts WHERE application_id = ?")
    .all(id);
  console.log(`\n${app.company} - ${app.job_title}\nCV: ${app.cv_path}\nLetter: ${app.cover_letter_path}\n`);
  for (const d of drafts) console.log(`[${d.question_key}]\n  ${d.answer}\n`);

  if (!confirm) {
    console.log("Nothing approved yet. Re-run with --yes to approve these answers.");
    return false;
  }

  db.transaction(() => {
    db.prepare("UPDATE drafts SET approved = 1 WHERE application_id = ?").run(id);
    db.prepare("UPDATE applications SET status = 'approved' WHERE id = ?").run(id);
    db.prepare("INSERT INTO status_history (application_id, status) VALUES (?, 'approved')").run(id);
  })();

  const answers = Object.fromEntries(drafts.map((d) => [d.question_key, d.answer]));
  writeFileSync(join(dirname(app.cv_path), "answers.json"), JSON.stringify(answers, null, 2));
  console.log("Approved. answers.json written next to the CV.");
  return true;
}

export function show({ db = openDb(), id }) {
  const a = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
  if (!a) throw new Error(`No application with id ${id}`);
  console.log(
    [
      `${a.company} - ${a.job_title}`,
      `Status: ${a.status}   Score: ${a.match_score}`,
      `URL: ${a.job_url}`,
      `Flags: ${a.eligibility_flags}`,
      `Missing skills: ${a.missing_skills}`,
      `CV: ${a.cv_path ?? "-"}`,
      `Letter: ${a.cover_letter_path ?? "-"}`
    ].join("\n")
  );
}

export function markApplied({ db = openDb(), id }) {
  const app = db.prepare("SELECT status FROM applications WHERE id = ?").get(id);
  if (!app) throw new Error(`No application with id ${id}`);
  if (app.status !== "approved") {
    throw new Error(`Application ${id} is '${app.status}'. Only approved applications can be marked applied.`);
  }
  db.transaction(() => {
    db.prepare("UPDATE applications SET status = 'applied', applied_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    db.prepare("INSERT INTO status_history (application_id, status) VALUES (?, 'applied')").run(id);
  })();
  console.log(`Marked ${id} as applied.`);
}
