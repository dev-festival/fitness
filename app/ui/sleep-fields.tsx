"use client";
import { useState } from "react";
import type { Entry } from "@/lib/model";
import { clockTime,sleepFromTimes } from "@/lib/sleep";
export default function SleepFields({date,initial,optional=false}:{date:string;initial:Entry|undefined;optional?:boolean}) {
  const c=initial?.kind==="checkin"?initial:undefined;
  const [mode,setMode]=useState(c?.bedAt || (optional && c?.sleep === undefined)?"times":"hours");
  const [bed,setBed]=useState(clockTime(c?.bedAt));const [wake,setWake]=useState(clockTime(c?.wakeAt));
  let duration="";if(bed&&wake){try{duration=`${sleepFromTimes(date,bed,wake).sleep} hours`;}catch{duration="Check your times.";}}
  return <div className="sleep-fields"><label>Record last night’s sleep<select name="sleepMode" value={mode} onChange={e=>setMode(e.target.value)}><option value="hours">Hours slept</option><option value="times">Bedtime & wake time</option></select></label>
    {mode==="hours"?<label>Sleep (hours)<input name="sleep" type="number" min={0} max={24} step="0.01" defaultValue={c?.sleep} required={!optional}/></label>:<><div className="form-grid"><label>Bedtime<input name="bedtime" type="time" value={bed} onChange={e=>setBed(e.target.value)} required={!optional || !!wake}/></label><label>Wake time<input name="wakeTime" type="time" value={wake} onChange={e=>setWake(e.target.value)} required={!optional || !!bed}/></label></div><p className="muted small">{duration || (optional ? "Leave both blank to skip." : "Choose both times.")} Wake date is {date}.</p></>}
  </div>;
}
