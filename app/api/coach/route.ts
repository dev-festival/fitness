import { authorized, sameOrigin } from "@/lib/auth";
import { getData } from "@/lib/db";
import { buildCompanionContext, buildCompanionInput, companionInstructions, companionRequestSchema, CONTEXT_DAYS } from "@/lib/companion";
import { localDate, recentDates } from "@/lib/model";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await authorized()) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "AI is off. Add OPENAI_API_KEY in your server environment to enable it." }, { status: 503 });
  const parsed = companionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check your message and date. Messages can be up to 3,000 characters." }, { status: 400 });
  const body = parsed.data;
  let context = null;
  if (body.includeRecentData) {
    const referenceDate = body.referenceDate || localDate();
    try {
      const { entries, settings } = await getData({ start: recentDates(referenceDate, CONTEXT_DAYS)[0], end: referenceDate });
      context = buildCompanionContext(entries, settings, referenceDate);
    } catch {
      return Response.json({ error: "Your recent logs couldn’t load. Try again, or turn off ‘Use recent logs’ to send just your message." }, { status: 503 });
    }
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal: AbortSignal.timeout(30000),
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini", store: false, max_output_tokens: 700,
        instructions: companionInstructions,
        input: buildCompanionInput(body.message, context)
      })
    });
    if (!response.ok) throw new Error("Provider rejected request");
    const data = await response.json();
    const reply = data.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || []).filter((item: { type: string }) => item.type === "output_text").map((item: { text: string }) => item.text).join("\n");
    if (!reply) throw new Error("No response");
    return Response.json({ reply });
  } catch { return Response.json({ error: "The companion couldn’t connect. Your logs are safe; try again in a moment." }, { status: 502 }); }
}
