import { readFileSync } from "node:fs";

export const loadJson = (name) =>
  JSON.parse(readFileSync(new URL(`../config/${name}`, import.meta.url), "utf8"));
