import { recentDates, type Entry } from "./model";
import { summarizeEntries } from "./trends";

const DAY = 86400000;
export function dateOffset(date: string, offset: number) {
  return new Date(Date.parse(date+"T12:00:00Z")+offset*DAY).toISOString().slice(0,10);
}
export function buildHistorySnapshots(entries: Entry[], referenceDate: string) {
  const cutoff = recentDates(referenceDate,14)[0];
  const groups = new Map<string,Entry[]>();
  for (const e of entries) {
    if (e.date >= cutoff) continue;
    const day = Math.floor(Date.parse(e.date+"T00:00:00Z")/DAY);
    const start = new Date(Math.floor(day/14)*14*DAY).toISOString().slice(0,10);
    groups.set(start,[...(groups.get(start)||[]),e]);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([from, records]) => {
    const blockEnd = dateOffset(from,13);
    const through = blockEnd < cutoff ? blockEnd : dateOffset(cutoff,-1);
    const sorted = records.toSorted((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    return { version:1, from, through, complete:through===blockEnd, summary:summarizeEntries(records),
      notes:sorted.flatMap(e => (e.kind === "journal" || e.kind === "checkin" || e.kind === "urge") && e.note ? [{date:e.date,kind:e.kind,text:e.note.slice(0,160)}]:[]).slice(0,3),
      interpretation:"Only logged observations. Food may be partial; missing days are unknown. Sentiment measures writing tone, not wellbeing. Raw records are retained." };
  });
}
export type HistorySnapshot = ReturnType<typeof buildHistorySnapshots>[number];
