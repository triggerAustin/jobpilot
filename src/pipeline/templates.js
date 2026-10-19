import { skillRegex } from "./score.js";

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function makeHit(matchedSkills, aliases) {
  const regexes = matchedSkills.map((s) => skillRegex(s, aliases));
  return (text) => regexes.some((r) => r.test(text));
}

function orderedProjects(profile, matchedSkills, aliases) {
  const regexes = matchedSkills.map((s) => skillRegex(s, aliases));
  const overlap = (p) => regexes.filter((r) => r.test((p.stack ?? []).join(" "))).length;
  return [...(profile.projects ?? [])]
    .map((p, i) => ({ p, i, n: overlap(p) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.p);
}

const joinList = (items) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

// Optional profile fields that adapt the CV to different people:
//   sectionOrder   which sections appear, and in what order
//   sectionTitles  custom headings, for example { skills: "Key Skills" }
//   hobbies        array of strings
//   referees       string or array of strings
//   education[]    degree, school, location?, graduated? | period?, details?
const DEFAULT_ORDER = ["summary", "skills", "projects", "experience", "education", "hobbies", "referees"];
const DEFAULT_TITLES = {
  summary: "Professional Summary",
  skills: "Technical Skills",
  projects: "Selected Projects",
  experience: "Experience",
  education: "Education &amp; Certifications",
  certifications: "Certifications",
  hobbies: "Hobbies and Interests",
  referees: "Referees"
};

export function renderCvHtml(profile, { matchedSkills = [], aliases = {} } = {}) {
  const p = profile.person;
  const hit = makeHit(matchedSkills, aliases);
  const contact = [p.location, p.email, p.phone, p.github].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ");
  const order = profile.sectionOrder ?? DEFAULT_ORDER;
  const title = (key) =>
    profile.sectionTitles?.[key] != null ? esc(profile.sectionTitles[key]) : DEFAULT_TITLES[key];
  const heading = (key) => `<h2>${title(key)}</h2>`;

  const sections = {
    summary: () => (profile.summary ? `${heading("summary")}\n<p>${esc(profile.summary)}</p>` : ""),

    skills: () => {
      if (!profile.skillGroups?.length) return "";
      const rows = profile.skillGroups
        .map((g) => {
          const items = [...g.items].sort((a, b) => Number(hit(b)) - Number(hit(a)));
          return `<p><strong>${esc(g.label)}:</strong> ${items.map(esc).join(", ")}</p>`;
        })
        .join("\n");
      return `${heading("skills")}\n${rows}`;
    },

    projects: () => {
      const list = orderedProjects(profile, matchedSkills, aliases);
      if (!list.length) return "";
      const rows = list
        .map(
          (pr) => `
<div class="item">
  <h3>${esc(pr.name)}${pr.subtitle ? ` &mdash; ${esc(pr.subtitle)}` : ""}${pr.stack?.length ? ` <span class="stack">| ${pr.stack.map(esc).join(", ")}</span>` : ""}</h3>
  <ul>${pr.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
  ${pr.link ? `<p class="link">${esc(pr.link)}</p>` : ""}
</div>`
        )
        .join("\n");
      return `${heading("projects")}\n${rows}`;
    },

    experience: () => {
      if (!profile.experience?.length) return "";
      const rows = profile.experience
        .map((e) => {
          const when = [e.start, e.end].filter(Boolean).map(esc).join(" &ndash; ");
          const meta = [e.location ? esc(e.location) : "", when].filter(Boolean).join(" | ");
          return `
<div class="item">
  <h3>${esc(e.org)} | ${esc(e.title)}${meta ? ` <span class="stack">| ${meta}</span>` : ""}</h3>
  <ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
</div>`;
        })
        .join("\n");
      return `${heading("experience")}\n${rows}`;
    },

    education: () => {
      const edu = (profile.education ?? [])
        .map((e) => {
          const place = [e.school, e.location].filter(Boolean).map(esc).join(", ");
          const when = e.graduated
            ? ` | Graduated ${esc(e.graduated)}`
            : e.period
              ? ` | ${esc(e.period)}`
              : "";
          const details = e.details ? `\n<p>${esc(e.details)}</p>` : "";
          return `<p><strong>${esc(e.degree)}</strong>, ${place}${when}</p>${details}`;
        })
        .join("\n");
      // Certifications share this block unless "certifications" has its own section.
      const certs = order.includes("certifications")
        ? ""
        : (profile.certifications ?? []).map((c) => `<p>${esc(c)}</p>`).join("\n");
      const body = [edu, certs].filter(Boolean).join("\n");
      return body ? `${heading("education")}\n${body}` : "";
    },

    certifications: () => {
      const list = profile.certifications ?? [];
      return list.length
        ? `${heading("certifications")}\n<ul>${list.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`
        : "";
    },

    hobbies: () =>
      profile.hobbies?.length
        ? `${heading("hobbies")}\n<ul>${profile.hobbies.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`
        : "",

    referees: () => {
      const r = profile.referees;
      const lines = Array.isArray(r) ? r : r ? [r] : [];
      return lines.length ? `${heading("referees")}\n${lines.map((l) => `<p>${esc(l)}</p>`).join("\n")}` : "";
    }
  };

  const body = order
    .map((key) => sections[key]?.() ?? "")
    .filter(Boolean)
    .join("\n");

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
${body}
</body>
</html>
`;
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const PAST_VERB =
  /^(Built|Developed|Implemented|Worked|Organised|Designed|Deployed|Contributed|Practised|Explored|Created|Wrote)\b/;

// Optional profile fields for the letter:
//   letterUseProject  set to false to skip the "relevant example" project sentence
//   letterHighlight   one sentence about experience, written by the candidate
//   signatureFields   which person fields close the letter (default name, email, github)
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
  if (profile.letterHighlight) middle.push(profile.letterHighlight);
  if (best && profile.letterUseProject !== false) {
    const first = best.bullets[0] ?? "";
    const detail = PAST_VERB.test(first) ? `, where I ${lowerFirst(first).replace(/\.$/, "")}.` : ".";
    const stack = best.stack?.length ? ` (${best.stack.join(", ")})` : "";
    middle.push(`A relevant example is ${best.name}${stack}${detail}`);
  }
  if (middle.length) paragraphs.push(middle.join(" "));

  paragraphs.push(profile.availability);
  paragraphs.push("Thank you for your time and consideration.");
  const signature = (profile.signatureFields ?? ["name", "email", "github"])
    .map((f) => p[f])
    .filter(Boolean);
  paragraphs.push(`Kind regards,\n${signature.join("\n")}`);

  return paragraphs.join("\n\n") + "\n";
}
