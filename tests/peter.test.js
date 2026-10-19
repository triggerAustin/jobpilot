import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkEligibility } from "../src/pipeline/eligibility.js";
import { scoreJob } from "../src/pipeline/score.js";
import { renderCvHtml, renderCoverLetter } from "../src/pipeline/templates.js";
import { mapJob, ReliefWebSource } from "../src/sources/reliefweb.js";
import { buildAdapters } from "../src/sources/index.js";

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../config/profiles/peter/${name}`, import.meta.url), "utf8"));
const profile = load("profile.json");
const scoring = load("scoring.json");
const sources = load("sources.json");

const job = (o) => ({ source: "test", title: "", description: "", location: "", remoteWorldwide: false, ...o });

test("Peter's CV shows his details and none of another profile's", () => {
  const html = renderCvHtml(profile, { matchedSkills: ["Project planning"], aliases: scoring.aliases });
  assert.ok(html.includes("Peter Gitau"));
  assert.ok(html.includes("Fresha Dairies Corporate Society"));
  assert.ok(html.includes("Taekwondo training"));
  assert.ok(html.includes("Available upon request."));
  assert.ok(!/Austin|React|Next\.js/.test(html));
});

test("cover letter signs with name, email and phone and skips the project sentence", () => {
  const letter = renderCoverLetter(profile, { company: "Acme NGO", title: "Project Intern" }, {
    matchedSkills: ["Project planning"],
    aliases: scoring.aliases
  });
  assert.ok(letter.includes("Acme NGO"));
  assert.ok(letter.includes("0117165097"));
  assert.ok(!letter.includes("A relevant example"));
  assert.ok(!letter.includes("undefined"));
});

test("managers are a seniority mismatch, interns and assistants are not", () => {
  const has = (title) => checkEligibility(job({ title }), profile).flags.includes("seniority_mismatch");
  assert.equal(has("Project Manager"), true);
  assert.equal(has("Senior Developer"), true);
  assert.equal(has("Project Management Intern"), false);
  assert.equal(has("Assistant Project Manager"), false);
  assert.equal(has("Graduate Trainee, Programmes"), false);
});

test("on-site wording does not exclude jobs near the candidate", () => {
  const near = checkEligibility(
    job({ title: "Project Officer", description: "On-site required.", location: "Nairobi, Kenya" }),
    profile
  );
  assert.deepEqual(near.flags, []);
  const far = checkEligibility(
    job({ title: "Project Officer", description: "On-site required.", location: "Lagos, Nigeria" }),
    profile
  );
  assert.ok(far.flags.includes("relocation_required"));
  assert.ok(far.flags.includes("location_restricted"));
});

test("entry-level postings get the junior boost and others do not", () => {
  const withBoost = scoreJob(job({ title: "Intern", description: "budgeting" }), profile, scoring.aliases);
  const without = scoreJob(job({ title: "Clerk", description: "budgeting" }), profile, scoring.aliases);
  assert.equal(withBoost.score - without.score, profile.juniorBoost);
});

test("project and M&E wording matches Peter's skills through aliases", () => {
  const r = scoreJob(
    job({ title: "Project Coordinator", description: "Support M&E, MS Excel and progress reports." }),
    profile,
    scoring.aliases
  );
  for (const s of ["Project management", "Monitoring and evaluation", "Microsoft Excel", "Report writing"]) {
    assert.ok(r.matchedSkills.includes(s), `expected ${s}`);
  }
});

test("ReliefWeb items map to jobs", () => {
  const j = mapJob({
    id: 42,
    fields: {
      title: "Project Assistant",
      url: "https://reliefweb.int/job/42/project-assistant",
      "body-html": "<p>Support M&amp;E</p>",
      source: [{ name: "Acme Relief" }],
      country: [{ name: "Kenya" }],
      city: [{ name: "Nairobi" }],
      date: { created: "2026-10-01T00:00:00+00:00" }
    }
  });
  assert.equal(j.company, "Acme Relief");
  assert.equal(j.location, "Nairobi, Kenya");
  assert.equal(j.externalId, "42");
  assert.equal(j.remoteWorldwide, false);
});

test("ReliefWeb without an app name fails with a clear message", async () => {
  delete process.env.RELIEFWEB_APPNAME;
  await assert.rejects(() => new ReliefWebSource({}).fetchJobs(), /app name/);
});

test("every source in Peter's sources.json is registered", () => {
  const all = { ...sources, sources: sources.sources.map((s) => ({ ...s, enabled: true })) };
  assert.equal(buildAdapters(all).length, sources.sources.length);
});
