import type { Lift } from "./model";

export function liftSets(lift: Lift) {
  return lift.setRows ?? Array.from({ length: lift.sets }, () => ({ reps: lift.reps, weight: lift.weight }));
}

export function liftSetCount(lift: Lift) {
  return lift.setRows ? lift.setRows.length : lift.sets;
}

export function liftVolume(lift: Lift) {
  return lift.setRows
    ? lift.setRows.reduce((total, set) => total + set.reps * set.weight, 0)
    : lift.sets * lift.reps * lift.weight;
}
