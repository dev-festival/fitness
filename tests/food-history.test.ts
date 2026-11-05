import assert from "node:assert/strict";
import { test } from "node:test";
import { previousFoods } from "../lib/food-history";
import type { Entry } from "../lib/model";

test("food history groups repeated names and macros, keeps portion variants, and prefers the latest logged copy", () => {
  const food = { kind: "food", date: "2026-11-04", name: "Coffee", calories: 5, protein: 0, carbs: 1, fat: 0, createdAt: "2026-11-04T14:00:00Z" } as const;
  const entries: Entry[] = [
    { ...food, id: "old", name: " coffee " },
    { ...food, id: "new", date: "2026-11-05", occurredAt: "2026-11-05T14:00:00Z", source: "home", estimated: true, estimateNote: "Black coffee" },
    { ...food, id: "large", calories: 10, carbs: 2 },
    { kind: "weight", id: "weight", date: food.date, createdAt: food.createdAt, weight: 180 }
  ];
  const result = previousFoods(entries);
  assert.equal(result.length, 2);
  assert.equal(result[0].count, 2);
  assert.equal(result[0].entry.id, "new");
  assert.equal(result[0].entry.estimated, true);
  assert.equal(result[1].entry.id, "large");
  assert.deepEqual(previousFoods([]), []);
});
