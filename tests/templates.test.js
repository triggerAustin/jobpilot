import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCvHtml, renderCoverLetter } from "../src/pipeline/templates.js";

const profile = {
  person: { name: "A B", email: "a@b.c", phone: "1", location: "KE", github: "https://github.com/x" },
  headline: "Dev",
  summary: "First sentence. Second <script>alert(1)</script> sentence.",
  availability: "Available remotely.",
  skillGroups: [{ label: "Frontend", items: ["Vue", "React"] }],
  projects: [
    { name: "Alpha", subtitle: "", stack: ["Vue"], bullets: ["Built alpha."], link: "" },
    { name: "Beta", subtitle: "", stack: ["React"], bullets: ["Built beta."], link: "" }
  ],
  experience: [],
  education: [],
  certifications: []
};

test("CV lists matched skills first", () => {
  const html = renderCvHtml(profile, { matchedSkills: ["React"] });
  assert.ok(html.indexOf("React") < html.indexOf("Vue"));
});

test("CV puts the project matching the job first", () => {
  const html = renderCvHtml(profile, { matchedSkills: ["React"] });
  assert.ok(html.indexOf("Beta") < html.indexOf("Alpha"));
});

test("CV escapes HTML in profile text", () => {
  const html = renderCvHtml(profile);
  assert.ok(!html.includes("<script>"));
});

test("cover letter names the company, role and best project only", () => {
  const text = renderCoverLetter(profile, { company: "Acme", title: "Frontend Dev" }, { matchedSkills: ["React"] });
  assert.ok(text.includes("Acme") && text.includes("Frontend Dev"));
  assert.ok(text.includes("Beta") && !text.includes("Alpha"));
  assert.ok(text.includes("where I built beta."));
});

test("cover letter omits the skills sentence when nothing matched", () => {
  const text = renderCoverLetter(profile, { company: "Acme", title: "Dev" }, { matchedSkills: [] });
  assert.ok(!text.includes("The posting mentions"));
});

test("cover letter skips the project detail when the bullet is not an action statement", () => {
  const p = {
    ...profile,
    projects: [{ name: "Gamma", subtitle: "", stack: ["React"], bullets: ["Personal project exploring tools."], link: "" }]
  };
  const text = renderCoverLetter(p, { company: "Acme", title: "Dev" }, { matchedSkills: ["React"] });
  assert.ok(text.includes("A relevant example is Gamma (React)."));
  assert.ok(!text.includes("where I"));
});
