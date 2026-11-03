import type { Entry } from "./model";

export function parseDollars(value:string) {
  const text=value.trim();
  if(!/^(?:\d{1,5}(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) throw new Error("Enter a dollar amount with up to two decimal places.");
  const cents=Math.round(Number(text)*100);
  if(cents>1000000)throw new Error("Enter an amount up to $10,000.");
  return cents;
}
export const formatMoney=(cents:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
export function entryInstant(entry:Entry) {
  const stamp="occurredAt" in entry&&entry.occurredAt?entry.occurredAt:entry.createdAt;
  const instant=Date.parse(stamp);return Number.isFinite(instant)?instant:0;
}
export function spendingSummary(entries:Entry[]) {
  const food=entries.filter(e=>e.kind === "food");
  const away=food.filter(e=>e.kind === "food" && e.source === "away");
  const priced=away.filter(e=>e.kind === "food" && e.costCents !== undefined);
  const purchases=entries.filter(e=>e.kind === "alcohol_purchase");
  return {
    homeMeals:food.filter(e=>e.kind === "food" && e.source === "home").length,
    awayMeals:away.length,untaggedMeals:food.filter(e=>e.kind === "food" && !e.source).length,
    pricedAwayMeals:priced.length,awayMealsWithoutPrice:away.length-priced.length,
    foodSpendCents:priced.reduce((sum,e)=>sum+(e.kind === "food" ? e.costCents??0:0),0),
    alcoholPurchases:purchases.length,alcoholSpendCents:purchases.reduce((sum,e)=>sum+(e.kind === "alcohol_purchase" ? e.costCents:0),0)
  };
}
export function localInputTime(date:string,now=new Date()) {
  return `${date}T${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
}
export function eventTimeLabel(entry:{occurredAt?:string;timeZone?:string},zone?:string) {
  if(!entry.occurredAt)return null;
  return new Date(entry.occurredAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit",...(zone||entry.timeZone?{timeZone:zone||entry.timeZone}:{})});
}
