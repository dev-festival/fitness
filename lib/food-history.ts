import type { Entry } from "./model";
import { entryInstant } from "./money";

type FoodEntry = Extract<Entry, { kind: "food" }>;
export type PreviousFood = { entry: FoodEntry; count: number };

export function previousFoods(entries: Entry[]): PreviousFood[] {
  const foods = new Map<string, PreviousFood>();
  for (const entry of entries) {
    if (entry.kind !== "food") continue;
    // Keep different portions or recipes available even when their names match.
    const name = entry.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
    const key = JSON.stringify([name, entry.calories, entry.protein, entry.carbs, entry.fat]);
    const existing = foods.get(key);
    if (!existing) {
      foods.set(key, { entry, count: 1 });
      continue;
    }
    existing.count += 1;
    if (entry.date > existing.entry.date ||
      (entry.date === existing.entry.date && entryInstant(entry) > entryInstant(existing.entry))) {
      existing.entry = entry;
    }
  }
  return [...foods.values()].sort((a, b) => b.count - a.count ||
    b.entry.date.localeCompare(a.entry.date) || entryInstant(b.entry) - entryInstant(a.entry));
}
