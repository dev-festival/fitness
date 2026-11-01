// Integration smoke test against a local running app. Creates disposable records,
// checks persistence and check-in replacement, then removes only those records.
import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3000";
const headers = { "Content-Type": "application/json", Origin: origin };
if (process.env.TEST_SESSION) headers.Cookie = `steady-session=${process.env.TEST_SESSION}`;
async function read() {
  const response = await fetch(origin + "/api/data", { headers });
  assert.equal(response.status, 200, "Data endpoint must be accessible");
  return response.json();
}
async function post(body, status = 200) {
  const response = await fetch(origin + "/api/data", { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal(response.status, status, await response.text());
}
const before = await read();
const originalIds = new Set(before.entries.map(e => e.id));
const date = Array.from({ length: 28 }, (_, i) => `1900-01-${String(i + 1).padStart(2, "0")}`).find(d => !before.entries.some(e => e.date === d));
assert.ok(date, "A spare test date is required");
try {
  const cases = [
    { kind: "food", date, name: "Disposable smoke-test food", calories: 400, protein: 30, carbs: 40, fat: 10 },
    { kind: "lift", date, name: "Disposable smoke-test exercise", sets: 3, reps: 8, weight: 45 },
    { kind: "weight", date, weight: 180 },
    { kind: "checkin", date, mood: 3, drinks: 2, sleep: 7.5, note: "Disposable smoke-test reflection" },
    { kind: "urge", date, intensity: 3, note: "Disposable smoke-test urge" }
  ];
  for (const entry of cases) await post(entry);
  const after = await read();
  const added = after.entries.filter(e => !originalIds.has(e.id));
  assert.equal(added.length, 5, "All five entry types persist");
  for (const entry of cases) assert.ok(added.some(e => e.kind === entry.kind && e.date === date));
  await post({ ...cases[3], drinks: 0, mood: 4 });
  const updated = (await read()).entries.filter(e => e.date === date && e.kind === "checkin");
  assert.equal(updated.length, 1, "A check-in updates rather than duplicates");
  assert.equal(updated[0].drinks, 0);
  assert.equal(updated[0].id, added.find(e => e.kind === "checkin").id);
  await post({ ...cases[0], calories: -1 }, 400);
  await post({ ...cases[2], date: "2026-02-30" }, 400);
  await post({ action: "settings", settings: { ...before.settings, unit: before.settings.unit === "lb" ? "kg" : "lb" } }, 400);
  const crossOrigin = await fetch(origin + "/api/data", { method: "POST", headers: { ...headers, Origin: "https://untrusted.example" }, body: JSON.stringify(cases[0]) });
  assert.equal(crossOrigin.status, 401);
  const coach = await fetch(origin + "/api/coach", { method: "POST", headers, body: JSON.stringify({ message: "" }) });
  assert.ok([400, 503].includes(coach.status), "Disabled or invalid AI request fails cleanly without a provider call");
  console.log("PASS: SQLite persistence for all entry types, check-in replacement, validation, unit safety, origin protection, and AI error handling.");
} finally {
  const current = await read();
  for (const entry of current.entries.filter(e => !originalIds.has(e.id) && e.date === date)) await post({ action: "delete", id: entry.id });
  const restored = await read();
  assert.equal(restored.entries.filter(e => e.date === date).length, 0, "Disposable test data is removed");
  assert.equal(restored.entries.length, before.entries.length, "Original records remain untouched");
  console.log("PASS: Delete persisted and disposable test records were cleaned up.");
}
