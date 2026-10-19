#!/usr/bin/env node
import { discover } from "./pipeline/discover.js";
import { rankAll } from "./pipeline/rank.js";
import { prepare, approve, show, markApplied } from "./pipeline/prepare.js";
import { openDb, listApplications } from "./db/db.js";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const [cmd, ...args] = process.argv.slice(2);

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
  case "rank":
    rankAll({ limit: Number(args[0]) || 25 });
    break;
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
    console.log("Usage: jobpilot <discover|rank|show|prep|approve|applied|list>");
}
