import { localDate } from "./model";

export function sleepFromTimes(wakeDate: string, bedtime: string, wakeTime: string) {
  if (!/^\d{2}:\d{2}$/.test(bedtime) || !/^\d{2}:\d{2}$/.test(wakeTime)) throw new Error("Choose both times.");
  const wake = new Date(`${wakeDate}T${wakeTime}:00`);
  const bedDay = new Date(`${wakeDate}T12:00:00`);
  if (bedtime >= wakeTime) bedDay.setDate(bedDay.getDate() - 1);
  const bed = new Date(`${localDate(bedDay)}T${bedtime}:00`);
  const sleep = (wake.getTime() - bed.getTime()) / 3600000;
  if (!Number.isFinite(sleep) || sleep <= 0 || sleep > 24) throw new Error("Choose a sleep interval between 0 and 24 hours, or enter hours instead.");
  return { bedAt: bed.toISOString(), wakeAt: wake.toISOString(), sleep: Math.round(sleep * 100) / 100 };
}
export function clockTime(timestamp?: string) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
