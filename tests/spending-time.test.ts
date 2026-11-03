import assert from "node:assert/strict";
import { test } from "node:test";
import { defaults,entrySchema,type Entry,type EntryInput } from "../lib/model";
import { parseDollars,spendingSummary,entryInstant } from "../lib/money";
import { mealThoughtLinks } from "../lib/observations";
import { dailyTrends,summarizeEntries } from "../lib/trends";
import { buildCompanionContext } from "../lib/companion";

const entry=(input:EntryInput,id:string):Entry=>({...input,id,createdAt:"2026-11-03T20:00:00Z"});
const meal={kind:"food" as const,date:"2026-11-03",name:"Lunch",calories:500,protein:30,carbs:40,fat:20};
test("backfilled food is ordered by eating time, while legacy meals retain their recorded order",()=>{
  const breakfast=entry({...meal,occurredAt:"2026-11-03T14:00:00Z"},"breakfast");
  const lunch=entry({...meal,occurredAt:"2026-11-03T18:00:00Z"},"lunch");
  assert.ok(entryInstant(lunch)>entryInstant(breakfast));
  assert.equal(entryInstant(entry(meal,"legacy")),Date.parse("2026-11-03T20:00:00Z"));
});
test("prices use integer cents and old meals remain valid without invented tags or times",()=>{
  assert.equal(parseDollars("8.50"),850);assert.equal(parseDollars("0"),0);assert.equal(parseDollars(".50"),50);assert.equal(parseDollars("19.99"),1999);
  assert.throws(()=>parseDollars("-1"));assert.throws(()=>parseDollars("1.234"));assert.throws(()=>parseDollars("10001"));
  assert.equal(entrySchema.safeParse(meal).success,true);
  assert.equal(entrySchema.safeParse({...meal,source:"home",costCents:850}).success,false);
  assert.equal(entrySchema.safeParse({...meal,costCents:850}).success,false);
  assert.equal(entrySchema.safeParse({...meal,source:"away",costCents:8.5}).success,false);
  assert.equal(entrySchema.safeParse({...meal,source:"away",costCents:850,occurredAt:"2026-11-03T18:00:00Z",timeZone:"America/Chicago"}).success,true);
});
test("spend coverage separates unknown prices and home meals, and purchases never become drinks",()=>{
  const records=[entry(meal,"old"),entry({...meal,source:"home"},"home"),entry({...meal,source:"away"},"unknown"),
    entry({...meal,source:"away",costCents:0},"free"),entry({...meal,source:"away",costCents:850},"priced"),
    entry({kind:"alcohol_purchase",date:"2026-11-03",occurredAt:"2026-11-03T19:00:00Z",name:"Six-pack",costCents:1599},"beer"),
    entry({kind:"checkin",date:"2026-11-03",drinks:0,mood:4,sleep:8,note:""},"checkin")];
  const spend=spendingSummary(records);
  assert.equal(spend.homeMeals,1);assert.equal(spend.untaggedMeals,1);assert.equal(spend.awayMeals,3);assert.equal(spend.pricedAwayMeals,2);assert.equal(spend.awayMealsWithoutPrice,1);
  assert.equal(spend.foodSpendCents,850);assert.equal(spend.alcoholSpendCents,1599);
  const days=dailyTrends(records,"2026-11-03",2);
  assert.equal(days[0].foodSpend,null);assert.equal(days[0].alcoholSpend,null);
  assert.equal(days[1].foodSpend,8.5);assert.equal(days[1].alcoholSpend,15.99);assert.equal(days[1].drinks,0);
  assert.equal(summarizeEntries(records).spending.alcoholSpendCents,1599);
});
test("thoughts link only to the nearest explicitly timed meal in the preceding four hours",()=>{
  const records=[entry({...meal,occurredAt:"2026-11-03T16:00:00Z"},"earlier"),entry({...meal,occurredAt:"2026-11-03T17:00:00Z",source:"away",costCents:850},"nearest"),entry(meal,"untimed"),
    entry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T18:30:00Z",note:"I felt rushed.",sentiment:{score:-0.4,summary:"Rushed"}},"thought"),
    entry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T15:00:00Z",note:"Before any timed meal"},"before"),
    entry({kind:"journal",date:"2026-11-03",occurredAt:"2026-11-03T23:00:00Z",note:"Too far after"},"later")];
  const links=mealThoughtLinks(records,"America/Chicago");
  assert.equal(links.length,1);assert.equal(links[0].mealId,"nearest");assert.equal(links[0].thoughtId,"thought");assert.equal(links[0].minutesAfterMeal,90);assert.equal(links[0].costCents,850);
  assert.match(links[0].mealTime!,/11:00/);assert.match(links[0].thoughtTime!,/12:30/);
  const context=buildCompanionContext(records,defaults,"2026-11-03","America/Chicago");
  assert.equal(context.mealThoughtLinks.length,1);assert.equal(context.summary.spending.foodSpendCents,850);
  assert.equal(context.recentMeals.find(e=>e.name==="Lunch"&&e.occurredAt===null)?.localTime,null);
});
