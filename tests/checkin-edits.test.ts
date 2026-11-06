import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/data/route";
import { getData } from "../lib/db";
import { dailyTrends } from "../lib/trends";

test("first check-in, later moods, drink totals, and edits share a day without overwriting each other", async () => {
  delete process.env.APP_PASSWORD;
  delete process.env.VERCEL;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.DATABASE_URL = "file::memory:";
  const date = "2026-11-04";
  const save = (body: unknown) => POST(new Request("http://localhost/api/data", {
    method: "POST", headers: { Origin: "http://localhost" }, body: JSON.stringify(body)
  }));
  const mood = (value: number, hour: number) => ({ kind: "mood", date, mood: value, occurredAt: `${date}T${hour}:00:00Z` });
  const sleep = { kind: "checkin", date, sleep: 8, bedAt: `${date}T04:00:00Z`, wakeAt: `${date}T12:00:00Z` };
  const weight = { kind: "weight", date, weight: 180 };
  assert.equal((await save({ action: "start-day", entries: [mood(2, 13), sleep, weight] })).status, 200);
  assert.equal(dailyTrends((await getData()).entries, date, 1)[0].drinks, null);
  assert.equal((await save(mood(4, 20))).status, 200);
  assert.equal((await save({ kind: "checkin", date, drinks: 0 })).status, 200);
  const before = (await getData()).entries;
  const day = dailyTrends(before, date, 1)[0];
  assert.equal(day.mood, 3);
  assert.equal(day.sleep, 8);
  assert.equal(day.drinks, 0);
  assert.equal(before.filter(e => e.kind === "mood").length, 2);
  assert.equal(before.find(e => e.kind === "checkin")?.bedAt, sleep.bedAt);

  const originalCheckin = before.find(e => e.kind === "checkin")!;
  const correctedSleep = { ...sleep, sleep: 7, wakeAt: `${date}T11:00:00Z` };
  assert.equal((await save({ action: "start-day", entries: [correctedSleep] })).status, 200);
  const corrected = (await getData()).entries;
  const checkin = corrected.find(e => e.kind === "checkin")!;
  assert.equal(checkin.id, originalCheckin.id);
  assert.equal(checkin.drinks, 0);
  assert.equal(checkin.sleep, 7);
  assert.equal(checkin.wakeAt, correctedSleep.wakeAt);
  assert.equal(dailyTrends(corrected, date, 1)[0].sleep, 7);
  assert.equal(corrected.filter(e => e.kind === "checkin").length, 1);
  assert.equal(corrected.filter(e => e.kind === "mood").length, 2);

  // Switching to a duration clears old clock times while retaining other daily details.
  assert.equal((await save({ action: "start-day", entries: [{ kind: "checkin", date, sleep: 6.5 }] })).status, 200);
  const durationOnly = (await getData()).entries.find(e => e.kind === "checkin")!;
  assert.equal(durationOnly.bedAt, undefined);
  assert.equal(durationOnly.wakeAt, undefined);
  assert.equal(durationOnly.sleep, 6.5);
  assert.equal(durationOnly.drinks, 0);

  const weightId = before.find(e => e.kind === "weight")!.id;
  const food = { kind: "food", date, name: "Lunch", calories: 500, protein: 30, carbs: 45, fat: 20 };
  assert.equal((await save(food)).status, 200);
  const original = (await getData()).entries.find(e => e.kind === "food")!;
  assert.equal((await save({ action: "update", id: original.id, entry: { ...food, protein: 35, source: "away", costCents: 850 } })).status, 200);
  assert.equal((await save({ action: "update", id: weightId, entry: { ...weight, weight: 181 } })).status, 200);
  assert.equal((await save({ action: "update", id: weightId, entry: food })).status, 404);
  const after = (await getData()).entries;
  assert.deepEqual(after.filter(e => e.kind === "food"), [{ ...food, protein: 35, source: "away", costCents: 850, id: original.id, createdAt: original.createdAt }]);
  assert.equal(after.find(e => e.kind === "weight")?.weight, 181);
});
