import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyTotals, dateSchema, entrySchema, recentDates, type Entry } from "../lib/model";
import { issueSession, validSession, sameOrigin } from "../lib/auth";

test("invalid calendar dates and invalid log values are rejected", () => {
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  assert.equal(dateSchema.safeParse("2024-02-29").success, true);
  assert.equal(entrySchema.safeParse({ kind: "food", date: "2026-10-29", name: "Lunch", calories: -1, protein: 5, carbs: 1, fat: 1 }).success, false);
  assert.equal(entrySchema.safeParse({ kind: "checkin", date: "2026-10-29", mood: 6, drinks: 0, sleep: 8, note: "" }).success, false);
  assert.equal(entrySchema.safeParse({ kind: "lift", date: "2026-10-29", name: "Squat", sets: 3.5, reps: 8, weight: 100 }).success, false);
});
test("nutrition totals include only food on the selected date", () => {
  const entries: Entry[] = [
    { id: "1", createdAt: "", kind: "food", date: "2026-10-29", name: "Lunch", calories: 500, protein: 30, carbs: 50, fat: 20 },
    { id: "2", createdAt: "", kind: "food", date: "2026-10-28", name: "Dinner", calories: 900, protein: 60, carbs: 90, fat: 35 },
    { id: "3", createdAt: "", kind: "weight", date: "2026-10-29", weight: 180 }
  ];
  assert.deepEqual(dailyTotals(entries, "2026-10-29"), { calories: 500, protein: 30, carbs: 50, fat: 20 });
  assert.deepEqual(dailyTotals([], "2026-10-29"), { calories: 0, protein: 0, carbs: 0, fat: 0 });
});
test("seven-day ranges cross month and year boundaries correctly", () => {
  const days = recentDates("2026-01-03", 7);
  assert.equal(days.length, 7);
  assert.equal(days[0], "2025-12-28");
  assert.equal(days.at(-1), "2026-01-03");
});
test("signed sessions reject expired and tampered cookies", () => {
  const now = 1000000;
  const token = issueSession(now);
  assert.equal(validSession(token, now + 1), true);
  assert.equal(validSession(token, now + 8 * 86400000), false);
  assert.equal(validSession(token + "x", now), false);
  assert.equal(validSession("broken", now), false);
  assert.equal(validSession(token + ".extra", now), false);
  assert.equal(validSession("9999999999999." + "é".repeat(64), now), false);
  const [expiry, signature] = token.split(".");
  assert.equal(validSession(`${Number(expiry) + 1}.${signature}`, now), false);
});
test("cross-origin mutations are rejected", () => {
  assert.equal(sameOrigin(new Request("https://steady.example/api/data", { headers: { origin: "https://evil.example" } })), false);
  assert.equal(sameOrigin(new Request("https://steady.example/api/data", { headers: { origin: "https://steady.example" } })), true);
  assert.equal(sameOrigin(new Request("http://localhost:3000/api/data", { headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" } })), true);
  assert.equal(sameOrigin(new Request("http://localhost:3000/api/data", { headers: { origin: "http://untrusted.example", host: "127.0.0.1:3000" } })), false);
});
