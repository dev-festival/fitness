import { dailyTotals, recentDates, type Entry } from "./model";
import { spendingSummary } from "./money";

export const mean = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100 : null;
export function summarizeEntries(entries: Entry[]) {
  const checkins = entries.filter(e => e.kind === "checkin");
  const food = entries.filter(e => e.kind === "food");
  const lifts = entries.filter(e => e.kind === "lift");
  const weights = entries.filter(e => e.kind === "weight").sort((a,b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const journals = entries.filter(e => e.kind === "journal");
  const scores = journals.flatMap(e => e.kind === "journal" && e.sentiment ? [e.sentiment.score] : []);
  const foodDays = new Set(food.map(e => e.date)).size;
  const sums = food.reduce((a,e) => e.kind === "food" ? { calories:a.calories+e.calories, protein:a.protein+e.protein, carbs:a.carbs+e.carbs, fat:a.fat+e.fat } : a, {calories:0,protein:0,carbs:0,fat:0});
  return {
    entries: entries.length, daysWithAnyLog: new Set(entries.map(e => e.date)).size,spending:spendingSummary(entries),
    checkins: checkins.length, alcoholFreeDays: checkins.filter(e => e.kind === "checkin" && e.drinks === 0).length,
    drinks: checkins.reduce((n,e) => n+(e.kind === "checkin" ? e.drinks : 0),0),
    averageSleep: mean(checkins.flatMap(e => e.kind === "checkin" ? [e.sleep] : [])),
    averageMood: mean(checkins.flatMap(e => e.kind === "checkin" ? [e.mood] : [])),
    foodDays, foodTotals: sums,
    trainingDays: new Set(lifts.map(e => e.date)).size,
    sets: lifts.reduce((n,e) => n+(e.kind === "lift" ? e.sets : 0),0),
    trainingVolume: lifts.reduce((n,e) => n+(e.kind === "lift" ? e.sets*e.reps*e.weight : 0),0),
    weightReadings: weights.length,
    firstWeight: weights[0]?.kind === "weight" ? { date:weights[0].date, value:weights[0].weight } : null,
    lastWeight: weights.at(-1)?.kind === "weight" ? { date:weights.at(-1)!.date, value:(weights.at(-1) as Extract<Entry,{kind:"weight"}>).weight } : null,
    urges: entries.filter(e => e.kind === "urge").length,
    averageUrge: mean(entries.flatMap(e => e.kind === "urge" ? [e.intensity] : [])),
    journalEntries: journals.length, sentimentScored: scores.length, sentimentSum: scores.reduce((a,b)=>a+b,0), averageSentiment: mean(scores)
  };
}
export function dailyTrends(entries: Entry[], endDate: string, days: number) {
  const grouped = new Map<string,Entry[]>();
  for (const e of entries) grouped.set(e.date,[...(grouped.get(e.date)||[]),e]);
  return recentDates(endDate,days).map(date => {
    const day = grouped.get(date)||[];
    const checkin = day.find(e => e.kind === "checkin");
    const summary = summarizeEntries(day);
    const clock = (stamp: string | undefined, night=false) => {
      if (!stamp) return null;
      const d = new Date(stamp); let n = d.getHours()*60+d.getMinutes();
      if (n<(night?12:18)*60) n+=1440;
      return n;
    };
    const latestWeight = day.filter(e => e.kind === "weight").sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
    return { date, drinks:checkin?.kind === "checkin" ? checkin.drinks:null, sleep:checkin?.kind === "checkin" ? checkin.sleep:null,
      mood:checkin?.kind === "checkin" ? checkin.mood:null,
      bedtime:checkin?.kind === "checkin" ? clock(checkin.bedAt,true):null, wakeTime:checkin?.kind === "checkin" ? clock(checkin.wakeAt):null,
      weight:latestWeight?.kind === "weight" ? latestWeight.weight:null,
      calories:summary.foodDays ? dailyTotals(day,date).calories:null, protein:summary.foodDays ? summary.foodTotals.protein:null,
      carbs:summary.foodDays ? summary.foodTotals.carbs:null, fat:summary.foodDays ? summary.foodTotals.fat:null,
      trainingSets:summary.trainingDays ? summary.sets:null, trainingVolume:summary.trainingDays ? summary.trainingVolume:null,
      urge:summary.averageUrge, sentiment:summary.averageSentiment, journalEntries:summary.journalEntries || null,
      foodSpend:summary.spending.pricedAwayMeals?summary.spending.foodSpendCents/100:null,
      alcoholSpend:summary.spending.alcoholPurchases?summary.spending.alcoholSpendCents/100:null };
  });
}
export type TrendDay = ReturnType<typeof dailyTrends>[number];
export type MetricKey = Exclude<keyof TrendDay,"date">;
