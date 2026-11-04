"use client";
import { useEffect,useRef,useState } from "react";
import { ArrowRight,RefreshCw,Sparkles } from "lucide-react";
import type { Entry,Settings } from "@/lib/model";
import { encouragement,localTrendInsight } from "@/lib/observations";
import type { CompanionCard } from "@/lib/insights";

export default function InsightCard({mode,entries,settings,from,through,aiEnabled,onChat}:{mode:"home"|"trends";entries:Entry[];settings:Settings;from:string;through:string;aiEnabled:boolean;onChat?:()=>void}){
  const [card,setCard]=useState<CompanionCard|null>(null);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  const active=useRef<AbortController|null>(null);
  const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const revision=JSON.stringify({entries,settings});
  const selected=entries.filter(e=>e.date>=from&&e.date<=through);
  const fallback=mode==="home"?{...encouragement(selected,settings,through),suggestion:""}:localTrendInsight(selected);
  useEffect(()=>{
    active.current?.abort();const controller=new AbortController();active.current=controller;
    setCard(null);setError("");setPending(false);
    const query=new URLSearchParams({mode,from,through,timeZone});
    fetch(`/api/insights?${query}`,{signal:controller.signal,cache:"no-store"}).then(async response=>{
      if(!response.ok)return;const data=await response.json();if(!controller.signal.aborted)setCard(data.card);
    }).catch(()=>{});
    return ()=>controller.abort();
  },[mode,from,through,timeZone,revision]);
  useEffect(()=>()=>active.current?.abort(),[]);
  async function refresh(){
    active.current?.abort();const controller=new AbortController();active.current=controller;setPending(true);setError("");
    try{
      const response=await fetch("/api/insights",{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,from,through,timeZone,force:Boolean(card)})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);if(!controller.signal.aborted)setCard(data.card);
    }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Couldn’t refresh this insight.");}
    finally{if(!controller.signal.aborted)setPending(false);}
  }
  const shown=card||fallback;
  return <section className={`card insight-card insight-${mode}`} aria-busy={pending}><div className="insight-heading"><span><Sparkles size={19}/>{mode==="home"?"A little encouragement":"Companion insights"}</span><small>{card?"Companion":"From your logs"}</small></div>
    <h2>{shown.title}</h2><p>{shown.text}</p>{shown.suggestion&&<p className="insight-suggestion">{shown.suggestion}</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="insight-actions"><button className="text-button" type="button" onClick={refresh} disabled={pending||!aiEnabled}>{pending?<><RefreshCw size={15}/>Thinking through your logs…</>:<><Sparkles size={15}/>{card?"Refresh with companion":mode==="home"?"Personalize with companion":"Get companion insights"}</>}</button>{onChat&&<button className="text-button quiet-chat" onClick={onChat}>Open chat<ArrowRight size={14}/></button>}</div>
    <small className="insight-disclosure">{!aiEnabled?"AI personalization is available when you connect a key.":card?`Saved ${new Date(card.generatedAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}. Refresh to ask for another perspective.`:mode==="home"?"Uses recent logs when you choose Personalize.":"Uses logs in this date range when you request insights."}</small>
  </section>;
}
