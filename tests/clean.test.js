import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, fixMojibake, normalizeJob } from "../src/sources/base.js";
import { buildKeywordFilter } from "../src/pipeline/discover.js";

test("decodeEntities handles named and numeric entities", () => {
  assert.equal(decodeEntities("H&amp;M &#39;x&#39; &#x41;"), "H&M 'x' A");
});

test("fixMojibake repairs double-encoded UTF-8", () => {
  assert.equal(fixMojibake("PerÃº"), "Perú");
  assert.equal(fixMojibake("Desenvolvedor Front end JÃºnior"), "Desenvolvedor Front end Júnior");
});

test("fixMojibake leaves clean text alone", () => {
  assert.equal(fixMojibake("Perú and plain text"), "Perú and plain text");
});

test("normalizeJob cleans title and collapses newlines", () => {
  const job = normalizeJob({
    source: "t",
    title: "Software development\nFrontend Developer",
    company: "H&amp;M",
    url: "https://x.com/1"
  });
  assert.equal(job.title, "Software development Frontend Developer");
  assert.equal(job.company, "H&M");
});

test("keyword filter matches whole words only", () => {
  const keep = buildKeywordFilter(["react", "node.js"]);
  assert.equal(keep({ title: "React Developer", description: "" }), true);
  assert.equal(keep({ title: "Cook", description: "Uses Node.js daily" }), true);
  assert.equal(keep({ title: "Housekeeping", description: "reactive staff" }), false);
});

test("fixMojibake repairs Polish and Arabic text", () => {
  const polish = Buffer.from("Poznań", "utf8").toString("latin1");
  assert.equal(fixMojibake(polish), "Poznań");
  const arabic = Buffer.from("الرياض", "utf8").toString("latin1");
  assert.equal(fixMojibake(arabic), "الرياض");
});
