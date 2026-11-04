import { localDate,recentDates,type Entry,type Settings } from "./model";
import { dailyMoods, mean } from "./trends";
import { eventTimeLabel,spendingSummary } from "./money";
import { dateOffset } from "./history";

// Event timestamps, not the time a record was saved, determine pairings.
export function mealThoughtLinks(entries:Entry[],timeZone="UTC") {
  const food=entries.filter(e=>e.kind === "food" && e.occurredAt);
  return entries.filter(e=>e.kind === "journal").sort((a,b)=>{
    const at=a.kind === "journal"?a.occurredAt:a.createdAt;
    const bt=b.kind === "journal"?b.occurredAt:b.createdAt;return bt.localeCompare(at);
  }).flatMap(thought=>{
    if(thought.kind!=="journal")return [];
    const thoughtAt=Date.parse(thought.occurredAt);
    const preceding=food.filter(e=>e.kind === "food" && Date.parse(e.occurredAt!)<=thoughtAt && thoughtAt-Date.parse(e.occurredAt!)<=4*3600000)
      .sort((a,b)=>Date.parse(b.kind === "food"?b.occurredAt!:b.createdAt)-Date.parse(a.kind === "food"?a.occurredAt!:a.createdAt))[0];
    if(preceding?.kind!=="food")return [];
    return [{mealId:preceding.id,thoughtId:thought.id,mealDate:preceding.date,thoughtDate:thought.date,mealTime:eventTimeLabel(preceding,timeZone),thoughtTime:eventTimeLabel(thought,timeZone),
      minutesAfterMeal:Math.round((thoughtAt-Date.parse(preceding.occurredAt!))/60000),meal:preceding.name,source:preceding.source??null,costCents:preceding.costCents??null,
      thought:thought.note.slice(0,240),tone:thought.sentiment?.score??null}];
  }).slice(0,40);
}

export function combinedObservations(entries:Entry[]) {
  const checkins=entries.filter(e=>e.kind === "checkin");
  const morningAfterFree:number[]=[];const morningAfterDrinks:number[]=[];
  for(const next of checkins){
    if(next.sleep === undefined)continue;
    const before=checkins.find(e=>e.date===dateOffset(next.date,-1));
    if(before?.drinks === undefined)continue;
    (before.drinks===0?morningAfterFree:morningAfterDrinks).push(next.sleep);
  }
  const trainingDates=new Set(entries.filter(e=>e.kind==="lift").map(e=>e.date));
  const moods = [...dailyMoods(entries)];
  const trainingMood=moods.flatMap(([date, mood])=>trainingDates.has(date)?[mood]:[]);
  const otherMood=moods.flatMap(([date, mood])=>!trainingDates.has(date)?[mood]:[]);
  return {
    sleepAfterAlcoholFree:{days:morningAfterFree.length,averageHours:mean(morningAfterFree)},sleepAfterDrinks:{days:morningAfterDrinks.length,averageHours:mean(morningAfterDrinks)},
    moodWithTraining:{days:trainingMood.length,average:mean(trainingMood)},moodWithoutTrainingLog:{days:otherMood.length,average:mean(otherMood)},
    interpretation:"Morning sleep is matched to the previous day's drinks, not the same day. A day without a training log is not necessarily a rest day. These are associations in incomplete self-reported records, not causes."
  };
}

export function encouragement(entries:Entry[],settings:Settings,date:string) {
  const today=entries.filter(e=>e.date===date);
  const when=date===localDate()?"today":"on this day";
  const checkin=today.find(e=>e.kind==="checkin");
  if(checkin?.kind==="checkin"&&checkin.drinks===0)return {title:"One choice to build on.",text:`You’ve checked in with zero drinks ${when}. Keep the next choice simple and give yourself a little room to breathe.`};
  if(today.some(e=>e.kind==="journal"))return {title:"You made a little space.",text:`You took a moment to put a thought into words ${when}. Carry that pause into your next meal, your next purchase, or your evening.`};
  if(today.some(e=>e.kind==="lift"))return {title:"You showed up for yourself.",text:`You logged some training ${when}. Let that same care carry into the rest of your day—food, a little rest, and your next small choice.`};
  const recent=entries.filter(e=>recentDates(date,7).includes(e.date));
  const money=spendingSummary(recent);
  if(money.pricedAwayMeals||money.alcoholPurchases)return {title:"Noticing is a useful step.",text:"You’ve started recording a few purchases. Keep noticing what was happening around those moments; that picture can help with the next choice."};
  if(settings.reason.trim())return {title:"Make a little room for your why.",text:`${settings.reason.trim()} One small choice today can move you toward that.`};
  return {title:"A little more you.",text:"A pause, a meal, a walk, or a thought written down. Start with the small thing that would help you feel present today."};
}

export function localTrendInsight(entries:Entry[]) {
  const observations=combinedObservations(entries);
  const free=observations.sleepAfterAlcoholFree,drinks=observations.sleepAfterDrinks;
  if(free.days>=3&&drinks.days>=3&&Math.abs((free.averageHours??0)-(drinks.averageHours??0))>=0.4)return {title:"A morning pattern to notice",text:`Sleep averaged ${free.averageHours} hours across ${free.days} mornings after alcohol-free check-ins, and ${drinks.averageHours} hours across ${drinks.days} mornings after days with drinks logged.`,suggestion:"Notice whether that connection keeps showing up as you add more check-ins."};
  const a=observations.moodWithTraining,b=observations.moodWithoutTrainingLog;
  if(a.days>=3&&b.days>=3&&Math.abs((a.average??0)-(b.average??0))>=0.25)return {title:"Movement and your check-ins",text:`Your mood averaged ${a.average}/5 on ${a.days} days with training logged, compared with ${b.average}/5 on ${b.days} other checked-in days.`,suggestion:"There may be something worth noticing in how movement fits into your day."};
  const pairs=mealThoughtLinks(entries);
  if(pairs.length)return {title:"Meals and moments",text:`You have ${pairs.length} journal thoughts within four hours after a timestamped food entry in this range. That gives you a starting point for noticing timing, food source, and how the moment felt.`,suggestion:"Keep logging a thought when a meal or purchase stands out to you."};
  return {title:"A picture that grows with you",text:"Sleep, meals, thoughts, movement, and purchases can tell a more useful story together. The next few entries will give your companion more to work with.",suggestion:"Add meal times and an occasional thought about the moment around them."};
}
