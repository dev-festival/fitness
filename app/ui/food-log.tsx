"use client";
import { useEffect,useRef,useState,type FormEvent } from "react";
import { Camera,Check,Sparkles,X } from "lucide-react";
import type { EntryInput } from "@/lib/model";
import type { FoodEstimate } from "@/lib/analysis";

async function preparePhoto(file:File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG, or WebP photo.");
  if (file.size>15*1024*1024) throw new Error("Choose a photo smaller than 15 MB.");
  const url=URL.createObjectURL(file);
  try {
    const image=new Image(); image.src=url; await image.decode();
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext("2d"); if(!context) throw new Error("Photo preparation is unavailable.");
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    let result=canvas.toDataURL("image/jpeg",0.85);
    if(result.length>2800000) result=canvas.toDataURL("image/jpeg",0.65);
    if(result.length>2800000) throw new Error("This photo is still too large. Try a smaller one.");
    return result;
  } finally { URL.revokeObjectURL(url); }
}
export default function FoodLog({date,aiEnabled,busy,onSave,onBusyChange}:{date:string;aiEnabled:boolean;busy:boolean;onSave:(entry:EntryInput)=>Promise<boolean>;onBusyChange:(busy:boolean)=>void}) {
  const [description,setDescription]=useState(""); const [photo,setPhoto]=useState("");
  const [values,setValues]=useState({name:"",calories:"",protein:"",carbs:"",fat:""});
  const [estimate,setEstimate]=useState<FoodEstimate|null>(null);
  const [pending,setPending]=useState(false); const [error,setError]=useState("");
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>onBusyChange(pending),[pending,onBusyChange]);
  useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
  async function assess() {
    setPending(true);setError("");request.current?.abort();request.current=new AbortController();
    try {
      const response=await fetch("/api/food/estimate",{method:"POST",headers:{"Content-Type":"application/json"},signal:request.current.signal,body:JSON.stringify({description,image:photo||undefined})});
      const data=await response.json();if(!response.ok) throw new Error(data.error);
      const result:FoodEstimate=data.estimate;setEstimate(result);
      setValues({name:result.name,calories:String(result.calories),protein:String(result.protein),carbs:String(result.carbs),fat:String(result.fat)});
    } catch(error) { if(!(error instanceof Error && error.name==="AbortError")) setError(error instanceof Error?error.message:"Couldn’t estimate this meal."); }
    finally {setPending(false);}
  }
  async function submit(event:FormEvent) {
    event.preventDefault();
    await onSave({kind:"food",date,name:values.name,calories:Number(values.calories),protein:Number(values.protein),carbs:Number(values.carbs),fat:Number(values.fat),...(estimate?{estimated:true,estimateNote:estimate.assumptions}:{})});
  }
  return <form onSubmit={submit}><p className="muted modal-date">Logging for {new Date(date+"T12:00:00").toLocaleDateString(undefined,{month:"long",day:"numeric"})}</p>
    <section className="food-assistant"><div className="card-heading"><h3><Sparkles size={17}/>Estimate with AI</h3><Camera size={18}/></div>
      <label>Describe the food and portion<textarea rows={2} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Two eggs, one slice of buttered toast, and a small latte" disabled={pending||busy}/></label>
      <label className="photo-picker">Or choose a meal photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending||busy||!aiEnabled} onChange={async e=>{
        const file=e.target.files?.[0];e.target.value="";if(!file)return;setPending(true);setError("");
        try{setPhoto(await preparePhoto(file));}catch(error){setError(error instanceof Error?error.message:"Couldn’t read this photo.");}finally{setPending(false);}
      }}/></label>
      {photo&&<div className="food-photo"><img src={photo} alt="Selected meal for estimation"/><button type="button" className="icon-button" aria-label="Remove meal photo" onClick={()=>setPhoto("")} disabled={pending}><X size={17}/></button></div>}
      <p className="muted small">{aiEnabled?"Your description or photo is sent to OpenAI when you choose Estimate. Photos aren’t saved in your food log.":"Connect an AI key in preferences to enable estimates. Manual entry is always available."}</p>
      <button type="button" className="secondary full" disabled={!aiEnabled||pending||busy||(!photo&&!description.trim())} onClick={assess}><Sparkles size={16}/>{pending?"Preparing estimate…":"Estimate macros"}</button>
    </section>
    {error&&<p className="error" role="alert">{error}</p>}
    {estimate&&<div className="estimate-note" role="status"><strong>Estimate · {estimate.confidence} confidence</strong><p>{estimate.assumptions}</p><span>Review the portion and edit any values before saving.</span></div>}
    <label>What did you eat?<input name="name" value={values.name} onChange={e=>setValues({...values,name:e.target.value})} maxLength={200} required disabled={busy||pending}/></label>
    <div className="form-grid">{([['calories','Energy (kcal)'],['protein','Protein (g)'],['carbs','Carbs (g)'],['fat','Fat (g)']] as const).map(([key,label])=><label key={key}>{label}<input name={key} type="number" min={0} max={10000} step="any" required value={values[key]} onChange={e=>setValues({...values,[key]:e.target.value})} disabled={busy||pending}/></label>)}</div>
    <button className="primary full" disabled={busy||pending}>{busy?"Saving…":"Save food"}<Check size={17}/></button>
  </form>;
}
