import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, insertJob } from "../src/db/db.js";
import { normalizeJob } from "../src/sources/base.js";

const make = (url, title = "Dev", company = "Acme") =>
  normalizeJob({ source: "t", title, company, url });

const count = (db) => db.prepare("SELECT COUNT(*) AS n FROM applications").get().n;

test("same URL twice yields one row", () => {
  const db = openDb(":memory:");
  assert.equal(insertJob(db, make("https://x.com/1")).inserted, true);
  assert.equal(insertJob(db, make("https://x.com/1")).inserted, false);
  assert.equal(count(db), 1);
});

test("tracking-parameter variants dedupe", () => {
  const db = openDb(":memory:");
  insertJob(db, make("https://x.com/1"));
  assert.equal(insertJob(db, make("https://x.com/1?utm_source=feed")).inserted, false);
});

test("same company and title under different URLs dedupe", () => {
  const db = openDb(":memory:");
  insertJob(db, make("https://x.com/1"));
  assert.equal(insertJob(db, make("https://x.com/2")).inserted, false);
  assert.equal(count(db), 1);
});

test("different titles yield separate rows", () => {
  const db = openDb(":memory:");
  insertJob(db, make("https://x.com/1", "Frontend Dev"));
  insertJob(db, make("https://x.com/2", "Backend Dev"));
  assert.equal(count(db), 2);
});

test("different companies with the same title yield separate rows", () => {
  const db = openDb(":memory:");
  insertJob(db, make("https://x.com/1", "Dev", "Acme"));
  insertJob(db, make("https://y.com/1", "Dev", "Globex"));
  assert.equal(count(db), 2);
});

test("insert writes a status_history row", () => {
  const db = openDb(":memory:");
  insertJob(db, make("https://x.com/1"));
  assert.equal(db.prepare("SELECT status FROM status_history").get().status, "discovered");
});
