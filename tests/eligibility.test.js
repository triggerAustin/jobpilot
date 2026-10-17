import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEligibility, toMonthlyUsd } from "../src/pipeline/eligibility.js";

const profile = {
  experienceYears: 2,
  workAuthorization: { canWorkIn: ["KE"] },
  salary: { minimum: 2000 },
  locationTerms: ["kenya", "africa", "worldwide"]
};
const job = (over) => ({ description: "", location: "", remoteWorldwide: false, ...over });

test("flags US-only roles", () => {
  const r = checkEligibility(job({ description: "US citizens only." }), profile);
  assert.ok(r.flags.includes("requires_us_authorization"));
});

test("does not flag ordinary text", () => {
  assert.deepEqual(checkEligibility(job({ description: "Build React apps." }), profile).flags, []);
});

test("flags on-site only when not worldwide remote", () => {
  assert.ok(checkEligibility(job({ description: "On-site only" }), profile).flags.includes("relocation_required"));
  assert.equal(
    checkEligibility(job({ description: "On-site only", remoteWorldwide: true }), profile).flags.length,
    0
  );
});

test("flags restricted locations", () => {
  assert.ok(checkEligibility(job({ location: "USA Only" }), profile).flags.includes("location_restricted"));
  assert.equal(checkEligibility(job({ location: "Worldwide" }), profile).flags.length, 0);
});

test("seniority uses the smallest stated requirement and ignores company age", () => {
  const senior = job({ description: "5+ years of experience required" });
  assert.ok(checkEligibility(senior, profile).flags.includes("seniority_mismatch"));
  const founded = job({ description: "Founded 10 years ago. 1 year of experience." });
  assert.equal(checkEligibility(founded, profile).flags.length, 0);
});

test("salary check normalizes period and ignores unknown currency", () => {
  assert.equal(toMonthlyUsd(24000, "USD", "year"), 2000);
  assert.equal(toMonthlyUsd(24000, "EUR", "year"), null);
  const low = job({ salaryMax: 12000, salaryCurrency: "USD", salaryPeriod: "year" });
  assert.ok(checkEligibility(low, profile).flags.includes("salary_below_minimum"));
});

test("flags senior titles for a junior profile", () => {
  assert.ok(checkEligibility(job({ title: "Senior React Developer" }), profile).flags.includes("seniority_mismatch"));
  assert.ok(checkEligibility(job({ title: "Sr. Engineer" }), profile).flags.includes("seniority_mismatch"));
  assert.equal(checkEligibility(job({ title: "Frontend Developer" }), profile).flags.length, 0);
});

test("seniority is flagged once, not twice", () => {
  const r = checkEligibility(
    job({ title: "Senior Dev", description: "8 years of experience" }),
    profile
  );
  assert.equal(r.flags.filter((f) => f === "seniority_mismatch").length, 1);
});

test("RemoteOK city locations get a soft flag and stay eligible", () => {
  const r = checkEligibility(job({ source: "remoteok", location: "Toronto, Canada" }), profile);
  assert.deepEqual(r.flags, ["location_check"]);
  assert.equal(r.eligible, true);
});

test("Remotive region locations are a hard flag", () => {
  const r = checkEligibility(job({ source: "remotive", location: "Europe, USA" }), profile);
  assert.deepEqual(r.flags, ["location_restricted"]);
  assert.equal(r.eligible, false);
});
