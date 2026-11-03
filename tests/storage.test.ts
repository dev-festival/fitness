import assert from "node:assert/strict";
import { test } from "node:test";
import { addEntry,deleteEntry,getData,syncHistorySnapshots } from "../lib/db";
test("SQLite appends timed journals and snapshots refresh after deleting their source record",async()=>{
  process.env.DATABASE_URL="file::memory:";delete process.env.DATABASE_AUTH_TOKEN;delete process.env.VERCEL;
  await addEntry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T09:00:00Z",note:"Morning thought",sentiment:{score:-0.4,summary:"Frustration"}});
  await addEntry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T15:00:00Z",note:"Afternoon thought",sentiment:{score:0.6,summary:"Hope"}});
  await addEntry({kind:"checkin",date:"2026-10-01",drinks:1,mood:3,sleep:7,note:"Older reflection"});
  let data=await getData();assert.equal(data.entries.filter(e=>e.kind==="journal").length,2);
  let snapshots=await syncHistorySnapshots(data.entries,"2026-11-03");assert.equal(snapshots.length,1);assert.equal(snapshots[0].summary.drinks,1);
  await addEntry({kind:"checkin",date:"2026-10-01",drinks:0,mood:4,sleep:8,note:"Corrected older reflection"});
  data=await getData();snapshots=await syncHistorySnapshots(data.entries,"2026-11-03");assert.equal(snapshots[0].summary.drinks,0);assert.equal(snapshots[0].summary.averageSleep,8);
  await deleteEntry(data.entries.find(e=>e.kind==="checkin")!.id);
  data=await getData();assert.deepEqual(await syncHistorySnapshots(data.entries,"2026-11-03"),[]);
  assert.equal(data.entries.length,2);
});
