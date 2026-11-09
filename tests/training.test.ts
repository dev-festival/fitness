import assert from "node:assert/strict";
import { test } from "node:test";
import { GET, POST } from "../app/api/data/route";
import { buildCompanionContext } from "../lib/companion";
import type { Entry, Settings, Workout } from "../lib/model";
import { liftSets } from "../lib/training";
import { summarizeEntries } from "../lib/trends";

test("workouts persist independently of dates, and mixed sets and legacy lifts remain editable", async () => {
  delete process.env.APP_PASSWORD;
  delete process.env.VERCEL;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.DATABASE_URL = "file::memory:";

  const date = "2026-11-09";
  const url = `http://localhost/api/data?date=${date}`;
  const save = async (body: unknown) => (await POST(new Request(url, {
    method: "POST", headers: { Origin: "http://localhost" }, body: JSON.stringify(body)
  }))).status;
  const read = async (): Promise<{ entries: Entry[]; settings: Settings; workouts: Workout[] }> => {
    const response = await GET(new Request(url));
    assert.equal(response.status, 200);
    return response.json();
  };

  assert.equal(await save({ action: "settings", settings: { ...(await read()).settings, unit: "kg" } }), 200);
  const legacy = { kind: "lift", date, name: "Bench press", sets: 3, reps: 8, weight: 50 };
  assert.equal(await save(legacy), 200);
  const workoutId = crypto.randomUUID();
  const otherWorkoutId = crypto.randomUUID();
  assert.equal(await save({ action: "start-workout", id: workoutId, date }), 200);
  assert.equal(await save({ action: "start-workout", id: otherWorkoutId, date }), 200);
  const started = (await read()).workouts;
  assert.equal(started.length, 1);
  assert.equal(started[0].id, workoutId);
  assert.equal(started[0].finishedAt, null);

  const id = crypto.randomUUID();
  const entry = { kind: "lift", date, name: "Squat", workoutId, setRows: [{ reps: 10, weight: 40.5 }, { reps: 5, weight: 60 }, { reps: 8, weight: 0 }] };
  assert.equal(await save({ action: "add-lift", id, entry: { ...entry, setRows: [] } }), 400);
  assert.equal(await save({ action: "add-lift", id, entry: { ...entry, date: "2026-11-08" } }), 409);
  assert.equal(await save({ action: "add-lift", id, entry }), 200);
  assert.equal(await save({ action: "finish-workout", id: workoutId }), 200);
  assert.equal(await save({ action: "add-lift", id, entry }), 200);
  assert.equal(await save({ action: "add-lift", id: crypto.randomUUID(), entry }), 409);
  assert.equal(await save({ action: "start-workout", id: otherWorkoutId, date }), 200);
  assert.equal(await save({ action: "finish-workout", id: workoutId }), 200);

  const data = await read();
  assert.equal(data.settings.unit, "kg");
  assert.equal(data.workouts.length, 2);
  assert.ok(data.workouts.find(workout => workout.id === workoutId)?.finishedAt);
  assert.equal(data.workouts.find(workout => workout.id === otherWorkoutId)?.finishedAt, null);
  assert.equal(data.entries.length, 2);
  const original = data.entries.find(e => e.kind === "lift" && e.name === legacy.name);
  assert.ok(original?.kind === "lift");
  assert.deepEqual(liftSets(original), Array(3).fill({ reps: 8, weight: 50 }));
  assert.equal(summarizeEntries(data.entries).trainingDays, 1);
  assert.equal(summarizeEntries(data.entries).sets, 6);
  assert.equal(summarizeEntries(data.entries).trainingVolume, 1905);
  const context = buildCompanionContext(data.entries, data.settings, date);
  assert.deepEqual(context.recentExercises.find(e => e.name === entry.name)?.setRows, entry.setRows);

  const edited = { ...entry, setRows: [{ reps: 6, weight: 70 }] };
  assert.equal(await save({ action: "update", id, entry: { ...edited, workoutId: otherWorkoutId } }), 404);
  assert.equal(await save({ action: "update", id, entry: edited }), 200);
  const legacyEdit = { kind: "lift", date, name: legacy.name, setRows: [{ reps: 8, weight: 50 }, { reps: 6, weight: 55 }] };
  assert.equal(await save({ action: "update", id: original.id, entry: legacyEdit }), 200);
  const after = (await read()).entries;
  assert.equal(summarizeEntries(after).sets, 3);
  assert.equal(summarizeEntries(after).trainingVolume, 1150);
});
