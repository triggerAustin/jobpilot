# JobPilot

A local, review-first tool for finding, scoring and preparing applications for remote JavaScript roles. It is not a mass-application bot: it automates the repetitive work and leaves screening answers and submission to you.

## Principles

1. **Automate the repetitive, gate the consequential.** Discovery, deduplication, scoring and drafting are automated. Screening answers and submitting are not.
2. **Verified facts live in configuration.** Work authorization, salary and notice period are written once in `config/profile.json` and reused verbatim. No model invents them.
3. **Eligibility is separate from fit.** A job can match your skills and still be flagged as a poor fit for your situation.
4. **Everything is recorded** in SQLite with timestamps.

## Pipeline

```
discover -> rank -> prep -> approve -> (you apply) -> applied
```

| Command | What it does |
|---|---|
| `npm run discover` | Pulls listings from every enabled source in `config/sources.json`, cleans and deduplicates them |
| `npm run rank [n]` | Flags eligibility, scores skill match, shows the top n |
| `npm run show <id>` | Prints URL, flags, missing skills and file paths for one job |
| `npm run prep [n]` | Generates CV, cover letter and draft answers for the top n eligible jobs |
| `npm run prep -- --id <id>` | Same, for one specific job |
| `npm run approve <id>` | Shows the screening answers without saving |
| `npm run approve <id> -- --yes` | Approves them and writes `answers.json` |
| `npm run applied <id>` | Records that you applied (approved jobs only) |
| `npm run list [n]` | Lists stored applications |
| `npm test` | Runs the unit tests |

See `INSTRUCTIONS.md` for the day-to-day workflow.

## Requirements

- Node.js 22 or later
- Build tools for `better-sqlite3` (on Fedora: `sudo dnf install gcc-c++ make python3`)

## Setup

```bash
git clone <your-repo-url> jobpilot
cd jobpilot
npm install
cp config/profile.example.json config/profile.json
```

Edit `config/profile.json` with your real details. It is listed in `.gitignore` because it holds contact details and screening answers.

## Configuration

| File | Purpose |
|---|---|
| `config/profile.json` | Your details, skills, projects, experience and verified screening answers (not committed) |
| `config/sources.json` | Which sources are enabled, plus title and stack keyword filters |
| `config/scoring.json` | Skill aliases (for example `node.js` also matches `node` and `nodejs`) |

## Data and output

- `data/jobpilot.db`: the SQLite database (not committed)
- `data/output/<company>-<role>-<date>/`: `cv.html`, `cover-letter.txt`, `notes.json` and, after approval, `answers.json` (not committed)

Open `cv.html` in a browser and use Print, then Save as PDF.

## Project layout

```
src/
  cli.js               command entry point
  config.js            JSON config loader
  util.js              fetch helper with retry on 429
  db/db.js             schema, inserts, listing
  sources/             one adapter per source, plus normalization
  pipeline/
    discover.js        fetch, normalize, filter, insert
    eligibility.js     hard and soft flags
    score.js           skill matching with word boundaries and aliases
    rank.js            score and sort
    templates.js       CV and cover letter rendering
    prepare.js         prep, approve, show, applied
tests/                 node:test unit tests
```

## Eligibility flags

| Flag | Meaning |
|---|---|
| `requires_us_authorization` | Posting asks for US work authorization |
| `relocation_required` | On-site or relocation required and not remote-worldwide |
| `location_restricted` | Candidate location (Remotive) excludes your region |
| `location_check` | Soft flag: RemoteOK office city, read the posting |
| `seniority_mismatch` | Stated experience or title level is above your profile |
| `salary_below_minimum` | Stated maximum salary is below your minimum |

Flags are surfaced, not used to delete jobs. Soft flags do not push a job down the ranking.

## Sources and terms

Enabled sources are listed in `config/sources.json`. Set `"enabled": false` to turn one off.

| Source | Type | Notes |
|---|---|---|
| Remotive, RemoteOK, Jobicy | public JSON API | original sources |
| Himalayas | public JSON API | structured location restrictions and salary; `maxPages` limits paging |
| Working Nomads | public JSON feed | `category` option, for example `Development` |
| We Work Remotely | RSS | `feeds` option lists category slugs |
| Arbeitnow | public JSON API | mostly European employers; disabled by default |
| Hacker News | Algolia API | latest "Who is hiring?" thread; `months` option; remote posts only |
| Greenhouse, Ashby, Lever | official company-board APIs | add companies under `options.boards` as `{ "id": "<slug>", "name": "<Company>" }`; a wrong slug is logged and skipped |

Check each site's terms for attribution requirements and request limits, and avoid running `discover` more than a few times a day. HTML career-page scraping is not implemented; the company-board adapters use the platforms' official public APIs.

Location text from Hacker News and the company boards is free text, so it raises the soft `location_check` flag instead of the hard `location_restricted` flag.

Each adapter prints progress lines such as `[himalayas] page 2/5` while `discover` runs.

## More than one person

Each person gets a folder under `config/profiles/<name>/` with their own `profile.json`, `sources.json` and `scoring.json`, and their own database and output under `data/<name>/`. Select one with `--profile <name>` or the `JOBPILOT_PROFILE` environment variable:

```bash
npm run discover -- --profile peter
npm run rank -- --profile peter
```

`profile.json` never falls back to another person's file. Profile folders are gitignored for `profile.json` because they hold contact details.

Useful optional profile fields: `sectionOrder`, `sectionTitles`, `hobbies`, `referees`, `localTerms` (places the candidate can commute to), `juniorBoost` (points added to entry-level postings) and `letterHighlight`.

ReliefWeb (NGO and programme jobs, filtered by country and experience) needs an app name: put it in `options.appname` or set `RELIEFWEB_APPNAME`, then set `"enabled": true`.

## Status

- Done: discovery, eligibility, scoring, document preparation, approval gate, status tracking
- Planned: Playwright form-filling that pauses for review and never submits, read-only React dashboard
