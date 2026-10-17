import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeJob, stripTracking, stripHtml } from "../src/sources/base.js";

test("stripTracking removes utm params and hash", () => {
  assert.equal(
    stripTracking("https://x.com/job/1?utm_source=a&id=5#apply"),
    "https://x.com/job/1?id=5"
  );
});

test("stripHtml removes tags and collapses whitespace", () => {
  assert.equal(stripHtml("<p>Hello&nbsp;<b>world</b></p>"), "Hello world");
});

test("normalizeJob returns null when required fields are missing", () => {
  assert.equal(normalizeJob({ title: "Dev", company: "Acme" }), null);
});

test("normalizeJob fills defaults", () => {
  const job = normalizeJob({ source: "t", title: "Dev", company: "Acme", url: "https://x.com/1" });
  assert.equal(job.remoteWorldwide, false);
  assert.equal(job.salaryMin, null);
  assert.equal(job.description, "");
});
