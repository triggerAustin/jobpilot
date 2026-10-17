import { skillRegex } from "./score.js";

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function makeHit(matchedSkills, aliases) {
  const regexes = matchedSkills.map((s) => skillRegex(s, aliases));
  return (text) => regexes.some((r) => r.test(text));
}

function orderedProjects(profile, matchedSkills, aliases) {
  const regexes = matchedSkills.map((s) => skillRegex(s, aliases));
  const overlap = (p) => regexes.filter((r) => r.test(p.stack.join(" "))).length;
  return [...profile.projects]
    .map((p, i) => ({ p, i, n: overlap(p) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.p);
}

const joinList = (items) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export function renderCvHtml(profile, { matchedSkills = [], aliases = {} } = {}) {
  const p = profile.person;
  const hit = makeHit(matchedSkills, aliases);
  const contact = [p.location, p.email, p.phone, p.github].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ");

  const skills = profile.skillGroups
    .map((g) => {
      const items = [...g.items].sort((a, b) => Number(hit(b)) - Number(hit(a)));
      return `<p><strong>${esc(g.label)}:</strong> ${items.map(esc).join(", ")}</p>`;
    })
    .join("\n");

  const projects = orderedProjects(profile, matchedSkills, aliases)
    .map(
      (pr) => `
<div class="item">
  <h3>${esc(pr.name)}${pr.subtitle ? ` &mdash; ${esc(pr.subtitle)}` : ""} <span class="stack">| ${pr.stack.map(esc).join(", ")}</span></h3>
  <ul>${pr.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
  ${pr.link ? `<p class="link">${esc(pr.link)}</p>` : ""}
</div>`
    )
    .join("\n");

  const experience = profile.experience
    .map(
      (e) => `
<div class="item">
  <h3>${esc(e.org)} | ${esc(e.title)} <span class="stack">| ${esc(e.location)} | ${esc(e.start)} &ndash; ${esc(e.end)}</span></h3>
  <ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
</div>`
    )
    .join("\n");

  const education = profile.education
    .map((e) => `<p><strong>${esc(e.degree)}</strong>, ${esc(e.school)} | Graduated ${esc(e.graduated)}</p>`)
    .join("\n");
  const certs = profile.certifications.map((c) => `<p>${esc(c)}</p>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(p.name)} - CV</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.4; color: #111; max-width: 780px; margin: 24px auto; padding: 0 16px; }
  h1 { font-size: 20pt; margin: 0; }
  h2 { font-size: 11pt; border-bottom: 1px solid #333; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
  h3 { font-size: 10.5pt; margin: 10px 0 2px; }
  .headline { font-size: 11pt; margin: 2px 0 4px; }
  .stack { font-weight: normal; font-style: italic; }
  .link { margin: 2px 0; font-size: 9.5pt; color: #333; word-break: break-all; }
  p { margin: 3px 0; }
  ul { margin: 3px 0 3px 18px; padding: 0; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
<h1>${esc(p.name)}</h1>
<p class="headline">${esc(profile.headline)}</p>
<p>${contact}</p>
<h2>Professional Summary</h2>
<p>${esc(profile.summary)}</p>
<h2>Technical Skills</h2>
${skills}
<h2>Selected Projects</h2>
${projects}
<h2>Experience</h2>
${experience}
<h2>Education &amp; Certifications</h2>
${education}
${certs}
</body>
</html>
`;
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const PAST_VERB =
  /^(Built|Developed|Implemented|Worked|Organised|Designed|Deployed|Contributed|Practised|Explored|Created|Wrote)\b/;

export function renderCoverLetter(profile, job, { matchedSkills = [], aliases = {} } = {}) {
  const p = profile.person;
  const intro = profile.letterIntro ?? profile.summary.split(/(?<=\.)\s/)[0];
  const best = orderedProjects(profile, matchedSkills, aliases)[0];

  const paragraphs = [
    `Dear Hiring Team at ${job.company},`,
    `I am applying for the ${job.title} role. ${intro}`
  ];

  const middle = [];
  if (matchedSkills.length) {
    middle.push(
      `The posting mentions ${joinList(matchedSkills.slice(0, 5))}, which match my listed skills.`
    );
  }
  if (best) {
    const first = best.bullets[0] ?? "";
    const detail = PAST_VERB.test(first) ? `, where I ${lowerFirst(first).replace(/\.$/, "")}.` : ".";
    middle.push(`A relevant example is ${best.name} (${best.stack.join(", ")})${detail}`);
  }
  if (middle.length) paragraphs.push(middle.join(" "));

  paragraphs.push(profile.availability);
  paragraphs.push("Thank you for your time and consideration.");
  paragraphs.push(`Kind regards,\n${p.name}\n${p.email}\n${p.github}`);

  return paragraphs.join("\n\n") + "\n";
}
