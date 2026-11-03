import { authorized,sameOrigin } from "@/lib/auth";
import { estimateFood,foodRequestSchema,readLimitedJson,validateFoodImage } from "@/lib/analysis";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request) {
  if (!sameOrigin(request)||!await authorized()) return Response.json({error:"Please sign in."},{status:401});
  if (!process.env.OPENAI_API_KEY) return Response.json({error:"Connect an AI key in preferences to estimate food. You can still log it manually."},{status:503});
  let input;
  try { input=foodRequestSchema.parse(await readLimitedJson(request,3000000)); if(input.image) validateFoodImage(input.image); }
  catch(error) { return Response.json({error:error instanceof Error && error.message==="Request too large" ? "Photo is too large. Choose a smaller photo." : "Add a description or a JPEG, PNG, or WebP photo up to 2 MB."},{status:400}); }
  try {
    const estimate=await estimateFood(input);
    if (!estimate.identifiable || !estimate.name.trim()) return Response.json({error:"Couldn’t identify the food. Add a description and portion size, then try again."},{status:422});
    return Response.json({estimate});
  } catch { return Response.json({error:"Couldn’t estimate this meal. Try again or enter the macros yourself."},{status:502}); }
}
