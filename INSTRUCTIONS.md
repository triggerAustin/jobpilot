# How to apply with JobPilot

## One-time setup

1. `npm install`
2. Copy `config/profile.example.json` to `config/profile.json` and fill in real, accurate details.
3. Check the answers under `screeningAnswers`. They go onto real forms, so only put things you are willing to state.
4. `npm test` should pass.

## The loop

1. **Refresh jobs** every few days:
```bash
   npm run discover
   npm run rank 20
```
2. **Pick jobs** from the ranked table. Prefer rows with no flags or only `location_check`. Read the posting before applying to anything flagged `seniority_mismatch` or `location_restricted`.
3. **Read the posting.** Scores count keywords only. Check the role, the location rules and the requirements yourself.
```bash
   npm run show <id>
```
4. **Generate documents:**
```bash
   npm run prep -- --id <id>
```
5. **Review the output** in `data/output/<company>-<role>-<date>/`:
   - `cover-letter.txt`: read it against the posting, edit if needed
   - `cv.html`: open in a browser, Print, Save as PDF
   - `notes.json`: matched and missing skills
6. **Approve the screening answers** after reading them:
```bash
   npm run approve <id>
   npm run approve <id> -- --yes
```
7. **Fill in the form yourself.** Use the PDF, the letter and `answers.json`. Answer anything not covered in `answers.json` yourself, especially legal, salary and work-authorization questions.
8. **Record it:**
```bash
   npm run applied <id>
```

## Status lifecycle

`discovered -> ranked -> prepared -> approved -> applied`

Each change is stored in `status_history`. Re-running `prep` on a job clears its approval on purpose, so changed documents are reviewed again.

## Changing things

- **Different skills or experience:** edit `config/profile.json`, then run `npm run rank`. Rank re-scores all jobs.
- **More or fewer jobs:** edit `titleKeywords` and `keywords` in `config/sources.json`.
- **Skill name variants:** add them to `config/scoring.json`.
- **Cover letter wording:** edit `renderCoverLetter` in `src/pipeline/templates.js`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `better-sqlite3` fails to install | `sudo dnf install gcc-c++ make python3`, then `npm install` again |
| `discover` returns few jobs | Normal: the two sources list few JavaScript roles at any time. Run it again in a few days |
| A source shows an error in the `discover` table | Check the message in the `error` column; it is usually a temporary HTTP error |
| `approve` says the job is `ranked` | Run `npm run prep -- --id <id>` first |
| Weird characters in titles | Delete `data/jobpilot.db*` and run `discover` again |

## Rules the tool follows

- It never submits applications.
- It never invents screening answers. Everything comes from your profile.
- It does not bypass CAPTCHAs or logins.
