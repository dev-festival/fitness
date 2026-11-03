"use client";
import { useState,type FormEvent } from "react";
import { Check,Plus } from "lucide-react";
import { localDate,type Entry,type EntryInput } from "@/lib/model";
import { formatMoney,localInputTime,parseDollars,spendingSummary } from "@/lib/money";

export function AlcoholSpendingLog({date,busy,onSave}:{date:string;busy:boolean;onSave:(entry:EntryInput)=>Promise<boolean>}) {
  const [initialWhen]=useState(()=>localInputTime(date));const [name,setName]=useState("");const [cost,setCost]=useState("");const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");
    const when=String(new FormData(event.currentTarget).get("when"));
    try{await onSave({kind:"alcohol_purchase",date:when.slice(0,10),occurredAt:new Date(when).toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,name:name.trim()||"Alcohol purchase",costCents:parseDollars(cost)});}
    catch(error){setError(error instanceof Error?error.message:"Check the purchase time and amount.");}
  }
  return <form onSubmit={submit}><p className="muted">Record a purchase when it’s useful to notice. This is separate from drinks consumed.</p><label>When<input name="when" type="datetime-local" defaultValue={initialWhen} max={`${localDate()}T23:59`} required disabled={busy}/></label><label>What did you buy? <span className="optional">(optional)</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={200} placeholder="e.g. Six-pack or drinks with dinner" disabled={busy}/></label><label>Amount spent (USD)<input type="number" min={0} max={10000} step="0.01" inputMode="decimal" value={cost} onChange={e=>setCost(e.target.value)} required disabled={busy}/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?"Saving…":"Save purchase"}<Check size={17}/></button></form>;
}
export function AlcoholSpendCard({entries,onNew}:{entries:Entry[];onNew:()=>void}) {
  const summary=spendingSummary(entries);
  return <section className="card spending-card"><div><span className="eyebrow">PURCHASES IN THE LAST 7 DAYS</span><h2>{summary.alcoholPurchases?formatMoney(summary.alcoholSpendCents):"—"}</h2><p>{summary.alcoholPurchases?`${summary.alcoholPurchases} alcohol ${summary.alcoholPurchases===1?"purchase":"purchases"} recorded`:"No alcohol purchases recorded in this range."}</p><span className="muted small">Buying alcohol and drinking it can happen on different days.</span></div><button className="secondary" onClick={onNew}><Plus size={17}/>Log alcohol spending</button></section>;
}
