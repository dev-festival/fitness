import { authorized, sameOrigin } from "@/lib/auth";
import { addEntries, addEntry, addLift, deleteEntry, finishWorkout, getData, getWorkouts, saveSettings, startWorkout, syncHistorySnapshots, updateEntry } from "@/lib/db";
import { dateSchema, entrySchema, localDate, setLiftSchema, settingsSchema } from "@/lib/model";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await authorized()) return Response.json({ error: "Please sign in." }, { status: 401 });
  const date = dateSchema.safeParse(new URL(request.url).searchParams.get("date") || localDate());
  if (!date.success) return Response.json({error:"Choose a valid date."},{status:400});
  try { const [data, workouts] = await Promise.all([getData(), getWorkouts()]); const history = await syncHistorySnapshots(data.entries,date.data); return Response.json({ ...data, workouts, history, aiEnabled: Boolean(process.env.OPENAI_API_KEY) }); }
  catch (error) { console.error("Database unavailable", error); return Response.json({ error: "Could not open the database. Check your server configuration." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await authorized()) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === "settings") await saveSettings(settingsSchema.parse(body.settings));
    else if (body.action === "start-workout") await startWorkout(z.uuid().parse(body.id), dateSchema.parse(body.date));
    else if (body.action === "finish-workout") await finishWorkout(z.uuid().parse(body.id));
    else if (body.action === "add-lift") {
      if (!await addLift(z.uuid().parse(body.id), setLiftSchema.parse(body.entry))) {
        return Response.json({ error: "Could not add this exercise. Refresh to check whether the workout is still active." }, { status: 409 });
      }
    }
    else if (body.action === "update") {
      if (typeof body.id !== "string" || body.id.length > 100) throw new Error("Invalid entry");
      const entry = entrySchema.parse(body.entry);
      if (entry.kind !== "food" && entry.kind !== "weight" && entry.kind !== "lift") throw new Error("Invalid entry type");
      if (!await updateEntry(body.id, entry)) return Response.json({ error: "This entry is no longer available." }, { status: 404 });
    } else if (body.action === "start-day") {
      if (!Array.isArray(body.entries) || body.entries.length < 1 || body.entries.length > 3) throw new Error("Invalid check-in");
      const inputs: unknown[] = body.entries;
      const entries = inputs.map(entry => entrySchema.parse(entry));
      if (new Set(entries.map(entry => entry.kind)).size !== entries.length ||
        entries.some(entry => entry.date !== entries[0].date ||
          (entry.kind !== "mood" && entry.kind !== "weight" && !(entry.kind === "checkin" && entry.sleep !== undefined && entry.drinks === undefined && entry.mood === undefined && entry.note === undefined)))) throw new Error("Invalid check-in");
      await addEntries(entries);
    }
    else if (body.action === "delete") {
      if (typeof body.id !== "string" || body.id.length > 100) throw new Error("Invalid entry");
      await deleteEntry(body.id);
    } else {
      const entry = entrySchema.parse(body);
      if (entry.kind === "lift" && entry.workoutId) throw new Error("Use the workout logging action");
      await addEntry(entry);
    }
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Could not save. Check your values and try again." }, { status: 400 }); }
}
