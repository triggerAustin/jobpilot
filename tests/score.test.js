import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreJob, skillRegex } from "../src/pipeline/score.js";

const profile = { skills: ["javascript", "react", "node.js", "go"] };
const aliases = { "node.js": ["node"], javascript: ["js"] };

test("word boundaries prevent partial matches", () => {
  assert.equal(skillRegex("go").test("a good team"), false);
  assert.equal(skillRegex("go").test("written in Go and Rust"), true);
  assert.equal(skillRegex("java").test("JavaScript"), false);
});

test("aliases match", () => {
  assert.equal(skillRegex("node.js", aliases).test("We use Node daily"), true);
});

test("score reflects the share of matched skills", () => {
  const r = scoreJob(
    { title: "Dev", description: "React and Node, some JS", remoteWorldwide: true },
    profile,
    aliases
  );
  assert.equal(r.score, 75);
  assert.deepEqual(r.missingSkills, ["go"]);
  assert.equal(r.signals.remoteWorldwide, true);
});
