import { test } from "node:test";
import assert from "node:assert/strict";
import { mapJob as himalayas } from "../src/sources/himalayas.js";
import { mapJob as workingNomads } from "../src/sources/workingnomads.js";
import { mapJob as arbeitnow } from "../src/sources/arbeitnow.js";
import { parseRss, mapItem } from "../src/sources/weworkremotely.js";
import { parsePost } from "../src/sources/hackernews.js";
import { mapGreenhouseJob, mapLeverJob, mapAshbyJob } from "../src/sources/boards.js";
import { toIsoDate } from "../src/util.js";
import { buildAdapters } from "../src/sources/index.js";
import { checkEligibility } from "../src/pipeline/eligibility.js";
import { loadJson } from "../src/config.js";

test("toIsoDate handles seconds, milliseconds, ISO strings and junk", () => {
  assert.equal(toIsoDate(1760000000), new Date(1760000000 * 1000).toISOString());
  assert.equal(toIsoDate(1760000000000), new Date(1760000000000).toISOString());
  assert.equal(toIsoDate("2026-10-01T00:00:00Z"), "2026-10-01T00:00:00.000Z");
  assert.equal(toIsoDate("nonsense"), null);
  assert.equal(toIsoDate(null), null);
});

test("Himalayas: no restrictions means worldwide, salary is yearly", () => {
  const job = himalayas({
    guid: "g1", title: "Dev", companyName: "Acme", applicationLink: "https://x/y",
    locationRestrictions: [], minSalary: 40000, maxSalary: 60000, currency: "USD", pubDate: 1760000000
  });
  assert.equal(job.remoteWorldwide, true);
  assert.equal(job.salaryPeriod, "year");
  assert.equal(job.url, "https://x/y");
});

test("Himalayas: restrictions are kept as location and not worldwide", () => {
  const job = himalayas({
    guid: "g2", title: "Dev", companyName: "Acme", locationRestrictions: ["United States", "Canada"]
  });
  assert.equal(job.remoteWorldwide, false);
  assert.equal(job.location, "United States, Canada");
  assert.equal(job.salaryMin, null);
});

test("Working Nomads: uses URL as id and detects anywhere", () => {
  const job = workingNomads({
    url: "https://www.workingnomads.com/jobs/x", title: "Dev", company_name: "Acme",
    location: "Anywhere", pub_date: "2026-10-01T00:00:00-04:00"
  });
  assert.equal(job.externalId, "https://www.workingnomads.com/jobs/x");
  assert.equal(job.remoteWorldwide, true);
});

test("Arbeitnow: maps slug and unix timestamp, never worldwide", () => {
  const job = arbeitnow({
    slug: "dev-acme-1", title: "Dev", company_name: "Acme", url: "u",
    location: "Berlin", created_at: 1760000000, remote: true
  });
  assert.equal(job.externalId, "dev-acme-1");
  assert.equal(job.remoteWorldwide, false);
  assert.ok(job.postedAt.startsWith("20"));
});

test("WWR: parses CDATA items and splits 'Company: Role'", () => {
  const xml = `<rss><channel>
    <item>
      <title><![CDATA[Acme: Senior React Developer]]></title>
      <region><![CDATA[Anywhere in the World]]></region>
      <description><![CDATA[<p>Build &amp; ship React apps</p>]]></description>
      <pubDate>Mon, 13 Oct 2026 10:00:00 +0000</pubDate>
      <link>https://weworkremotely.com/remote-jobs/acme-react</link>
      <guid>https://weworkremotely.com/remote-jobs/acme-react</guid>
    </item>
    <item><title>Plain: Node Engineer</title><link>https://w/2</link><guid>https://w/2</guid></item>
  </channel></rss>`;
  const items = parseRss(xml);
  assert.equal(items.length, 2);
  const job = mapItem(items[0]);
  assert.equal(job.company, "Acme");
  assert.equal(job.title, "Senior React Developer");
  assert.equal(job.remoteWorldwide, true);
  assert.equal(mapItem(items[1]).company, "Plain");
});

test("HN: parses a remote posting header", () => {
  const job = parsePost({
    id: 123, created_at: "2026-10-01T00:00:00.000Z",
    text: "Acme | Full-Stack Engineer | REMOTE (Worldwide) | $90k<p>We use React and Node."
  });
  assert.equal(job.company, "Acme");
  assert.equal(job.title, "Full-Stack Engineer");
  assert.equal(job.remoteWorldwide, true);
  assert.equal(job.url, "https://news.ycombinator.com/item?id=123");
});

test("HN: skips non-remote posts, replies and deleted comments", () => {
  assert.equal(parsePost({ id: 1, text: "Acme | Engineer | NYC | ONSITE<p>x" }), null);
  assert.equal(parsePost({ id: 2, text: "Thanks, applied!" }), null);
  assert.equal(parsePost({ id: 3, text: null }), null);
});

test("Greenhouse: decodes escaped HTML content", () => {
  const job = mapGreenhouseJob(
    { id: 9, title: "Dev", absolute_url: "u", location: { name: "Remote - Africa" },
      content: "&lt;p&gt;React&lt;/p&gt;", updated_at: "2026-10-01T00:00:00Z" },
    { id: "acme", name: "Acme" }
  );
  assert.equal(job.company, "Acme");
  assert.equal(job.description, "<p>React</p>");
  assert.equal(job.externalId, "acme:9");
});

test("Lever and Ashby map company, url and location", () => {
  const lever = mapLeverJob(
    { id: "a", text: "Dev", hostedUrl: "u", categories: { location: "Remote - Worldwide" },
      description: "<p>x</p>", lists: [{ text: "Requirements", content: "<li>React</li>" }], createdAt: 1760000000000 },
    { id: "acme" }
  );
  assert.equal(lever.company, "acme");
  assert.equal(lever.remoteWorldwide, true);
  assert.ok(lever.description.includes("React"));

  const ashby = mapAshbyJob(
    { id: "b", title: "Dev", jobUrl: "u", isRemote: true, descriptionHtml: "<p>x</p>" },
    { id: "zapier", name: "Zapier" }
  );
  assert.equal(ashby.location, "Remote");
  assert.equal(ashby.company, "Zapier");
});

test("every source in sources.json is registered", () => {
  const config = loadJson("sources.json");
  const all = { ...config, sources: config.sources.map((s) => ({ ...s, enabled: true })) };
  assert.equal(buildAdapters(all).length, config.sources.length);
});

test("location text from board and HN sources is a soft flag, not a hard one", () => {
  // Inline profile: the real one is personal, gitignored and differs per person.
  const profile = {
    experienceYears: 1,
    workAuthorization: { canWorkIn: ["KE"] },
    salary: { minimum: 2000 },
    locationTerms: ["kenya", "africa", "emea", "worldwide", "anywhere"]
  };
  for (const source of ["hackernews", "greenhouse", "lever", "ashby"]) {
    const res = checkEligibility(
      { source, title: "Developer", description: "", location: "Remote", remoteWorldwide: false },
      profile
    );
    assert.deepEqual(res.flags, ["location_check"]);
    assert.equal(res.eligible, true);
  }
  const hard = checkEligibility(
    { source: "himalayas", title: "Developer", description: "", location: "United States", remoteWorldwide: false },
    profile
  );
  assert.deepEqual(hard.flags, ["location_restricted"]);
});
