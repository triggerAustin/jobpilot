import { test } from "node:test";
import assert from "node:assert/strict";
import { mapJob } from "../src/sources/jobicy.js";

test("maps Jobicy fields and salary period", () => {
  const job = mapJob({
    id: 1, url: "https://jobicy.com/jobs/x", jobTitle: "Dev", companyName: "Acme",
    jobGeo: "Anywhere", jobDescription: "<p>React</p>", pubDate: "2026-10-01T00:00:00+00:00",
    salaryMin: 50000, salaryMax: 70000, salaryCurrency: "USD", salaryPeriod: "yearly"
  });
  assert.equal(job.externalId, "1");
  assert.equal(job.remoteWorldwide, true);
  assert.equal(job.salaryPeriod, "year");
});

test("regional jobs are not worldwide and missing salary stays null", () => {
  const job = mapJob({ id: 2, url: "u", jobTitle: "Dev", companyName: "Acme", jobGeo: "USA" });
  assert.equal(job.remoteWorldwide, false);
  assert.equal(job.salaryMin, null);
  assert.equal(job.salaryPeriod, null);
});
