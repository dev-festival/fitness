import { z } from "zod";

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Choose a real date");
const text = z.string().trim().min(1).max(200);
const amount = z.number().finite().min(0).max(10000);
export const entrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("food"), date: dateSchema, name: text, calories: amount, protein: amount, carbs: amount, fat: amount }),
  z.object({ kind: z.literal("lift"), date: dateSchema, name: text, sets: z.number().int().min(1).max(100), reps: z.number().int().min(1).max(1000), weight: amount }),
  z.object({ kind: z.literal("weight"), date: dateSchema, weight: z.number().finite().positive().max(1500) }),
  z.object({ kind: z.literal("checkin"), date: dateSchema, drinks: z.number().int().min(0).max(100), mood: z.number().int().min(1).max(5), sleep: z.number().finite().min(0).max(24), note: z.string().trim().max(2000) }),
  z.object({ kind: z.literal("urge"), date: dateSchema, intensity: z.number().int().min(1).max(5), note: z.string().trim().max(2000) })
]);
export type EntryInput = z.infer<typeof entrySchema>;
export type Entry = EntryInput & { id: string; createdAt: string };
export const settingsSchema = z.object({
  name: z.string().trim().max(40),
  reason: z.string().trim().max(500),
  calories: z.number().int().min(1).max(10000),
  protein: z.number().min(1).max(1000),
  carbs: z.number().min(1).max(1000),
  fat: z.number().min(1).max(1000),
  weeklyWorkouts: z.number().int().min(1).max(14),
  unit: z.enum(["lb", "kg"])
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaults: Settings = { name: "", reason: "I want to feel present, strong, and more like myself.", calories: 2200, protein: 150, carbs: 250, fat: 65, weeklyWorkouts: 3, unit: "lb" };
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function recentDates(end: string, count: number) {
  const day = new Date(end + "T12:00:00");
  return Array.from({ length: count }, (_, i) => { const d = new Date(day); d.setDate(d.getDate() - (count - 1 - i)); return localDate(d); });
}
export function dailyTotals(entries: Entry[], date: string) {
  return entries.filter(e => e.date === date && e.kind === "food").reduce((a, e) => {
    if (e.kind !== "food") return a;
    return { calories: a.calories + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}
