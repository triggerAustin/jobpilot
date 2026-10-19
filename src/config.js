import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// A profile lets one copy of JobPilot serve more than one person. Select it with
// `--profile <name>` or the JOBPILOT_PROFILE environment variable. With no profile
// selected, everything works exactly as before (config/ and data/).
export function activeProfile() {
  const name = (process.env.JOBPILOT_PROFILE ?? "").trim();
  if (!name) return "";
  if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error(`Invalid profile name: "${name}"`);
  return name;
}

// config/profiles/<name>/<file> when a profile is active, else config/<file>.
// sources.json and scoring.json fall back to the shared copy when the profile has none.
// profile.json never falls back, so one person's details can't end up in another's CV.
export function configUrl(file) {
  const name = activeProfile();
  if (name) {
    const own = new URL(`../config/profiles/${name}/${file}`, import.meta.url);
    if (existsSync(own)) return own;
    if (file === "profile.json") {
      throw new Error(`Missing config/profiles/${name}/profile.json for profile "${name}".`);
    }
  }
  return new URL(`../config/${file}`, import.meta.url);
}

export const loadJson = (file) => JSON.parse(readFileSync(configUrl(file), "utf8"));

// Each profile keeps its own database and generated files under data/<name>/.
export const dataDir = () => (activeProfile() ? join("data", activeProfile()) : "data");
