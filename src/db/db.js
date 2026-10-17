import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_url TEXT NOT NULL UNIQUE,
  external_id TEXT,
  source TEXT,
  description TEXT,
  location TEXT,
  remote_worldwide INTEGER DEFAULT 0,
  posted_at TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT,
  salary_period TEXT,
  match_score INTEGER,
  matched_skills TEXT,
  missing_skills TEXT,
  eligibility_flags TEXT DEFAULT '[]',
  status TEXT DEFAULT 'discovered',
  cv_path TEXT,
  cover_letter_path TEXT,
  discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  status TEXT NOT NULL,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  question_key TEXT NOT NULL,
  answer TEXT NOT NULL,
  approved INTEGER DEFAULT 0
);
`;

export function openDb(path = process.env.JOBPILOT_DB ?? "data/jobpilot.db") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function insertJob(db, job) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO applications
      (company, job_title, job_url, external_id, source, description, location,
       remote_worldwide, posted_at, salary_min, salary_max, salary_currency, salary_period)
    VALUES
      (@company, @title, @url, @externalId, @source, @description, @location,
       @remoteWorldwide, @postedAt, @salaryMin, @salaryMax, @salaryCurrency, @salaryPeriod)
  `);
  const history = db.prepare(
    "INSERT INTO status_history (application_id, status) VALUES (?, 'discovered')"
  );
  const sameContent = db.prepare(
    "SELECT id FROM applications WHERE company = ? AND job_title = ? LIMIT 1"
  );

  const run = db.transaction((j) => {
    // Same company and title under a different URL (e.g. one posting per location)
    if (sameContent.get(j.company, j.title)) return { inserted: false };

    const info = insert.run({ ...j, remoteWorldwide: j.remoteWorldwide ? 1 : 0 });
    if (info.changes === 0) return { inserted: false };
    history.run(info.lastInsertRowid);
    return { inserted: true, id: Number(info.lastInsertRowid) };
  });

  return run(job);
}

export function listApplications(db, limit = 50) {
  return db
    .prepare(
      `SELECT id, company, job_title, source, remote_worldwide AS remote,
              match_score AS score, status, discovered_at
       FROM applications
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit);
}
