"use client";
import { useEffect,useState,type FormEvent } from "react";
import { Check,Plus,Sparkles,Trash2 } from "lucide-react";
import { localDate,type Entry,type EntryInput } from "@/lib/model";

export const toneLabel=(score:number)=>score>0.15?"Positive":score< -0.15?"Negative":"Neutral / mixed";
export function JournalLog({date,aiEnabled,busy,onSave,onBusyChange}:{date:string;aiEnabled:boolean;busy:boolean;onSave:(entry:EntryInput)=>Promise<boolean>;onBusyChange:(busy:boolean)=>void}) {
  const now=new Date();
  const [time,setTime]=useState(`${date}T${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
  const [note,setNote]=useState("");const [assess,setAssess]=useState(aiEnabled);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  useEffect(()=>onBusyChange(pending),[pending,onBusyChange]);
  useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
  async function save(withTone:boolean) {
    setPending(true);setError("");
    try {
      let sentiment;
      if(withTone) {
        const response=await fetch("/api/journal/sentiment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({note})});
        const data=await response.json();if(!response.ok)throw new Error(data.error);sentiment=data.sentiment;
      }
      await onSave({kind:"journal",date:time.slice(0,10),occurredAt:new Date(time).toISOString(),note,...(sentiment?{sentiment}:{})});
    }catch(error){setError(error instanceof Error?error.message:"Couldn’t save this thought.");}finally{setPending(false);}
  }
  return <form onSubmit={(event:FormEvent)=>{event.preventDefault();void save(assess);}}>
    <p className="muted">A new entry for this moment. Come back as often as you like.</p>
    <label>When<input type="datetime-local" value={time} max={`${localDate()}T23:59`} onChange={e=>setTime(e.target.value)} required disabled={pending||busy}/></label>
    <label>What’s on your mind?<textarea rows={6} value={note} maxLength={4000} onChange={e=>setNote(e.target.value)} placeholder="A thought, a win, a hard moment, or something you noticed…" required disabled={pending||busy}/></label>
    <label className="context-toggle"><input type="checkbox" checked={assess} onChange={e=>setAssess(e.target.checked)} disabled={!aiEnabled||pending||busy}/><span>Add an AI tone score<small>{aiEnabled?"This entry is sent to OpenAI when you save. Scores appear in All trends.":"Connect an AI key in preferences to score new entries."}</small></span></label>
    {error&&<div className="error" role="alert"><p>{error}</p><button type="button" className="secondary" disabled={pending||busy||!note.trim()} onClick={()=>save(false)}>Save without a score</button></div>}
    <button className="primary full" disabled={pending||busy||!note.trim()}>{pending&&assess?"Assessing tone & saving…":busy?"Saving…":"Save new thought"}<Check size={17}/></button>
  </form>;
}
export function JournalTimeline({entries,busy,onDelete,onNew}:{entries:Entry[];busy:boolean;onDelete:(id:string)=>void;onNew:()=>void}) {
  const notes=entries.filter(e=>(e.kind==="journal"||e.kind==="checkin"||e.kind==="urge")&&e.note).sort((a,b)=>b.date.localeCompare(a.date)||(b.kind==="journal"?b.occurredAt:b.createdAt).localeCompare(a.kind==="journal"?a.occurredAt:a.createdAt));
  return <section className="card journal-timeline"><div className="card-heading"><h2>Your thoughts, over time</h2><button className="small-button" onClick={onNew}><Plus size={14}/>New thought</button></div>{notes.length?notes.map(e=><article key={e.id} className="journal-entry"><div className="journal-entry-top"><time dateTime={e.kind==="journal"?e.occurredAt:e.createdAt}>{new Date(e.date+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})} · {e.kind==="journal"?new Date(e.occurredAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}):e.kind==="checkin"?"Daily reflection":"Urge reflection"}</time>{e.kind==="journal"&&<button className="icon-button delete" aria-label="Delete journal entry" disabled={busy} onClick={()=>onDelete(e.id)}><Trash2 size={15}/></button>}</div><p>{'note' in e?e.note:""}</p>{e.kind==="journal"&&e.sentiment&&<span className="tone-badge" title={e.sentiment.summary}><Sparkles size={13}/>{toneLabel(e.sentiment.score)} · {e.sentiment.score.toFixed(2)}</span>}{e.kind==="journal"&&!e.sentiment&&<span className="muted small">Not scored</span>}</article>):<div className="empty-state"><p>Your first thought can start here.</p><span>Each entry keeps its own timestamp.</span></div>}</section>;
}
