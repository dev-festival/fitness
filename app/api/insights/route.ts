import { authorized,sameOrigin } from "@/lib/auth";
import { getData,readCompanionCard,storeCompanionCard } from "@/lib/db";
import { cardIdentity,cardRequestSchema,generateInsight,insightContext,type CardRequest } from "@/lib/insights";
import { readLimitedJson } from "@/lib/analysis";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

async function state(input:CardRequest){
  const {entries,settings}=await getData();const context=insightContext(input,entries,settings);
  return {context,...cardIdentity(input,context)};
}
export async function GET(request:Request){
  if(!await authorized())return Response.json({error:"Please sign in."},{status:401});
  const parsed=cardRequestSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success)return Response.json({error:"Choose a valid insight range."},{status:400});
  try{const s=await state(parsed.data);return Response.json({card:await readCompanionCard(s.cacheKey,s.fingerprint)});}
  catch{return Response.json({error:"Couldn’t load the saved insight."},{status:503});}
}
export async function POST(request:Request){
  if(!sameOrigin(request)||!await authorized())return Response.json({error:"Please sign in."},{status:401});
  const parsed=cardRequestSchema.safeParse(await readLimitedJson(request,20000).catch(()=>null));
  if(!parsed.success)return Response.json({error:"Choose a valid insight range."},{status:400});
  try{
    const s=await state(parsed.data);
    const cached=await readCompanionCard(s.cacheKey,s.fingerprint);
    if(cached&&!parsed.data.force)return Response.json({card:cached});
    if(!process.env.OPENAI_API_KEY)return Response.json({error:"Connect an AI key in preferences to personalize this card."},{status:503});
    const card=await generateInsight(parsed.data,s.context);
    const latest=await state(parsed.data);
    if(latest.fingerprint!==s.fingerprint)return Response.json({error:"Your logs changed while this was being written. Refresh the insight to use the latest entries."},{status:409});
    await storeCompanionCard(s.cacheKey,s.fingerprint,card);
    return Response.json({card});
  }catch{return Response.json({error:"Couldn’t refresh this insight. Your logs are saved; try again in a moment."},{status:502});}
}
