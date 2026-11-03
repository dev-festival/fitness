import { authorized, sameOrigin } from "@/lib/auth";
import { addEntry, deleteEntry, getData, saveSettings, syncHistorySnapshots } from "@/lib/db";
import { dateSchema, entrySchema, localDate, settingsSchema } from "@/lib/model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await authorized()) return Response.json({ error: "Please sign in." }, { status: 401 });
  const date = dateSchema.safeParse(new URL(request.url).searchParams.get("date") || localDate());
  if (!date.success) return Response.json({error:"Choose a valid date."},{status:400});
  try { const data = await getData(); const history = await syncHistorySnapshots(data.entries,date.data); return Response.json({ ...data, history, aiEnabled: Boolean(process.env.OPENAI_API_KEY) }); }
  catch (error) { console.error("Database unavailable", error); return Response.json({ error: "Could not open the database. Check your server configuration." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await authorized()) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === "settings") await saveSettings(settingsSchema.parse(body.settings));
    else if (body.action === "delete") {
      if (typeof body.id !== "string" || body.id.length > 100) throw new Error("Invalid entry");
      await deleteEntry(body.id);
    } else await addEntry(entrySchema.parse(body));
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Could not save. Check your values and try again." }, { status: 400 }); }
}
