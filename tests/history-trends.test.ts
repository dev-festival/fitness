import assert from "node:assert/strict";
import { test } from "node:test";
import { entrySchema,defaults,type Entry,type EntryInput } from "../lib/model";
import { dailyTrends,summarizeEntries } from "../lib/trends";
import { buildHistorySnapshots } from "../lib/history";
import { buildCompanionContext } from "../lib/companion";
import { sleepFromTimes } from "../lib/sleep";

const entry=(value:EntryInput,id="one"):Entry=>({...value,id,createdAt:"2026-11-03T15:00:00Z"});
test("old logs remain valid and new sleep intervals validate their actual duration",()=>{
  const old={kind:"checkin",date:"2026-11-03",drinks:0,mood:4,sleep:8,note:"A good start"};
  assert.equal(entrySchema.safeParse(old).success,true);
  const interval=sleepFromTimes("2026-11-03","23:30","07:15");
  assert.equal(interval.sleep,7.75);
  assert.equal(entrySchema.safeParse({...old,...interval}).success,true);
  assert.equal(entrySchema.safeParse({...old,...interval,sleep:1}).success,false);
  assert.equal(entrySchema.safeParse({...old,bedAt:interval.bedAt}).success,false);
});
test("daily sleep and sentiment trends use observations and preserve missing days",()=>{
  const input=[entry({kind:"checkin",date:"2026-11-03",drinks:0,mood:4,note:"",...sleepFromTimes("2026-11-03","23:30","07:00")}),
    entry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T10:00:00Z",note:"Hard morning",sentiment:{score:-0.8,summary:"Frustration"}},"j1"),
    entry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T14:00:00Z",note:"A better afternoon",sentiment:{score:0.4,summary:"Hopeful"}},"j2"),
    entry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T15:00:00Z",note:"Unscored thought"},"j3")];
  const days=dailyTrends(input,"2026-11-03",2);
  assert.equal(days[0].sleep,null);assert.equal(days[0].drinks,null);assert.equal(days[0].sentiment,null);
  assert.equal(days[1].sleep,7.5);assert.equal(days[1].drinks,0);assert.equal(days[1].sentiment,-0.2);
  assert.equal(days[1].bedtime,23*60+30);assert.equal(days[1].wakeTime,31*60);
  assert.equal(days[1].journalEntries,3);
  const summary=summarizeEntries(input);assert.equal(summary.sentimentScored,2);assert.equal(summary.averageSentiment,-0.2);
});
test("older snapshots have stable periods, no overlap, and reflect corrections and deletions",()=>{
  const older=entry({kind:"checkin",date:"2026-10-01",drinks:2,mood:3,sleep:6,note:"Old note"});
  const current=entry({kind:"checkin",date:"2026-11-03",drinks:0,mood:4,sleep:8,note:"Today"},"two");
  const snapshots=buildHistorySnapshots([older,current],"2026-11-03");
  assert.equal(snapshots.length,1);assert.equal(snapshots[0].summary.drinks,2);
  assert.equal(buildHistorySnapshots([older,current],"2026-11-04")[0].from,snapshots[0].from);
  assert.equal(buildHistorySnapshots([{...older,drinks:0} as Entry,current],"2026-11-03")[0].summary.drinks,0);
  assert.deepEqual(buildHistorySnapshots([current],"2026-11-03"),[]);
  const context=buildCompanionContext([older,current],defaults,"2026-11-03");
  assert.equal(context.summary.daysLogged,1);assert.equal(context.history.earlierTotals.checkins,1);
  assert.ok(context.history.snapshots.every(s=>s.through<context.window.from));
});
test("journal timestamps and tone scores are validated without requiring a score",()=>{
  const note={kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T08:30:00-06:00",note:"A thought"};
  assert.equal(entrySchema.safeParse(note).success,true);
  assert.equal(entrySchema.safeParse({...note,occurredAt:"not a timestamp"}).success,false);
  assert.equal(entrySchema.safeParse({...note,sentiment:{score:2,summary:"Invalid"}}).success,false);
});
