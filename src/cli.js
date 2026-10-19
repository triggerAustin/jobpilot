#!/usr/bin/env node
import dns from "node:dns";
import { discover } from "./pipeline/discover.js";
import { rankAll } from "./pipeline/rank.js";
import { prepare, approve, show, markApplied } from "./pipeline/prepare.js";
import { openDb, listApplications } from "./db/db.js";
import { activeProfile } from "./config.js";

// Prefer IPv4 first: some networks time out on IPv6 before Node falls back.
dns.setDefaultResultOrder("ipv4first");

// `--profile <name>` selects a profile (same as JOBPILOT_PROFILE=<name>).
const argv = process.argv.slice(2);
const pi = argv.indexOf("--profile");
if (pi >= 0) {
  const name = argv[pi + 1];
  if (!name || name.startsWith("--")) {
    console.error("--profile needs a name, for example: --profile peter");
    process.exit(1);
  }
  process.env.JOBPILOT_PROFILE = name;
  argv.splice(pi, 2);
}
const [cmd, ...args] = argv;
if (activeProfile()) console.log(`[jobpilot] profile: ${activeProfile()}`);

function run(fn) {
  try {
    fn();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

switch (cmd) {
  case "discover":
    await discover();
    break;
  case "rank": {
    // `rank 20` shows the top 20; `rank 21-40` shows ranks 21 to 40.
    const m = /^(\d+)-(\d+)$/.exec(args[0] ?? "");
    if (m) {
      const from = Math.max(Number(m[1]), 1);
      const to = Math.max(Number(m[2]), from);
      rankAll({ offset: from - 1, limit: to - from + 1 });
    } else {
      rankAll({ limit: Number(args[0]) || 25 });
    }
    break;
  }
  case "show":
    run(() => show({ id: Number(args[0]) }));
    break;
  case "prep": {
    const i = args.indexOf("--id");
    run(() => prepare(i >= 0 ? { id: Number(args[i + 1]) } : { limit: Number(args[0]) || 5 }));
    break;
  }
  case "approve":
    run(() => approve({ id: Number(args[0]), confirm: args.includes("--yes") }));
    break;
  case "applied":
    run(() => markApplied({ id: Number(args[0]) }));
    break;
  case "list":
    console.table(listApplications(openDb(), Number(args[0]) || 50));
    break;
  default:
    console.log("Usage: jobpilot [--profile <name>] <discover|rank|show|prep|approve|applied|list>");
}
