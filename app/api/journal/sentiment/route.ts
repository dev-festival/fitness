import { authorized,sameOrigin } from "@/lib/auth";
import { journalAnalysisSchema,readLimitedJson,scoreJournal } from "@/lib/analysis";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request) {
  if (!sameOrigin(request)||!await authorized()) return Response.json({error:"Please sign in."},{status:401});
  if (!process.env.OPENAI_API_KEY) return Response.json({error:"AI tone scoring is off. You can save without a score."},{status:503});
  let input;
  try { input=journalAnalysisSchema.parse(await readLimitedJson(request,20000)); }
  catch { return Response.json({error:"Write an entry of up to 4,000 characters."},{status:400}); }
  try { return Response.json({sentiment:await scoreJournal(input.note)}); }
  catch { return Response.json({error:"Couldn’t assess tone. Retry or save without a score."},{status:502}); }
}
