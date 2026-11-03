"use client";
import { useState } from "react";
import { Activity,Archive,TrendingUp } from "lucide-react";
import type { Entry,Settings } from "@/lib/model";
import { dailyTrends,mean,summarizeEntries,type MetricKey,type TrendDay } from "@/lib/trends";
import type { HistorySnapshot } from "@/lib/history";
import { formatMoney } from "@/lib/money";
import InsightCard from "./insight-card";

type Metric={key:MetricKey;label:string;unit:string;color:string;range?:[number,number];clock?:boolean};
function valueLabel(value:number,metric:Metric) {
  if(metric.clock){const minute=Math.round(value)%1440;return `${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;}
  return `${new Intl.NumberFormat(undefined,{maximumFractionDigits:metric.key==="sentiment"?2:1}).format(value)}${metric.unit?" "+metric.unit:""}`;
}
export function chartBuckets(days:TrendDay[],key:MetricKey) {
  const size=Math.max(1,Math.ceil(days.length/90));
  return {size,points:Array.from({length:Math.ceil(days.length/size)},(_,i)=>{
    const chunk=days.slice(i*size,(i+1)*size);
    return {from:chunk[0].date,through:chunk.at(-1)!.date,value:mean(chunk.flatMap(d=>d[key]===null?[]:[d[key] as number]))};
  })};
}
function TrendChart({days,metric}:{days:TrendDay[];metric:Metric}) {
  const {size,points}=chartBuckets(days,metric.key);
  const observed=days.flatMap(d=>d[metric.key]===null?[]:[d[metric.key] as number]);
  const values=points.flatMap(p=>p.value===null?[]:[p.value]);
  const minimum=metric.range?.[0]??(values.length?Math.min(...values):0);
  const maximum=metric.range?.[1]??(values.length?Math.max(...values):1);
  const margin=metric.range?0:Math.max((maximum-minimum)*0.15,metric.clock?30:metric.key==="weight"?1:0.5);
  const lower=minimum-margin,upper=maximum+margin;
  const x=(i:number)=>54+(points.length<2?0.5:i/(points.length-1))*422;
  const y=(value:number)=>115-(value-lower)/(upper-lower||1)*94;
  let path="";let continuing=false;
  points.forEach((point,i)=>{if(point.value===null){continuing=false;return;}path+=`${continuing?"L":"M"}${x(i)},${y(point.value)} `;continuing=true;});
  return <section className="card trend-card"><div className="card-heading"><h3>{metric.label}</h3><span style={{color:metric.color}}><TrendingUp size={17}/></span></div>
    <div className="trend-latest"><strong>{observed.length?valueLabel(observed.at(-1)!,metric):"—"}</strong><span>Latest logged{observed.length?` · ${observed.length} days`:""}</span></div>
    {values.length?<><svg viewBox="0 0 500 145" role="img" aria-label={`${metric.label} over ${days[0].date} through ${days.at(-1)!.date}. ${size>1?`${size}-day averages.`:"Daily values."} Missing logs are gaps.`}>
      {[25,70,115].map(v=><line key={v} x1="54" y1={v} x2="476" y2={v} stroke="#e9eee3" strokeDasharray="3 5"/>)}
      <text x="2" y="26">{metric.clock?valueLabel(maximum,metric):new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(maximum)}</text><text x="2" y="116">{metric.clock?valueLabel(minimum,metric):new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(minimum)}</text>
      <path d={path} stroke={metric.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      {points.map((p,i)=>p.value===null?null:<circle key={p.from} cx={x(i)} cy={y(p.value)} r="3" fill={metric.color}><title>{p.from}{p.through!==p.from?` – ${p.through}`:""}: {valueLabel(p.value,metric)}</title></circle>)}
      <text x="54" y="140">{days[0].date.slice(5)}</text><text x="476" y="140" textAnchor="end">{days.at(-1)!.date.slice(5)}</text>
    </svg><div className="trend-footnote"><span>Average: {valueLabel(mean(observed)!,metric)}</span><span>{size>1?`${size}-day averages shown`:"Daily values"}</span></div><details className="trend-values"><summary>View values</summary><div><table><thead><tr><th>Date</th><th>Value</th></tr></thead><tbody>{points.filter(p=>p.value!==null).map(p=><tr key={p.from}><td>{p.from}{p.through!==p.from?` – ${p.through}`:""}</td><td>{valueLabel(p.value!,metric)}</td></tr>)}</tbody></table></div></details></>:<div className="trend-empty"><Activity size={23}/><p>No values logged in this range yet.</p></div>}
  </section>;
}
export default function Trends({entries,settings,date,history,aiEnabled}:{entries:Entry[];settings:Settings;date:string;history:HistorySnapshot[];aiEnabled:boolean}) {
  const [range,setRange]=useState("30");
  const eligible=entries.filter(e=>e.date<=date);
  const first=eligible.reduce((from,e)=>e.date<from?e.date:from,date);
  const length=range==="all"?Math.max(1,Math.round((Date.parse(date+"T12:00:00Z")-Date.parse(first+"T12:00:00Z"))/86400000)+1):Number(range);
  const days=dailyTrends(eligible,date,length);
  const inRange=eligible.filter(e=>e.date>=days[0].date);
  const summary=summarizeEntries(inRange);
  const metrics:Metric[]=[
    {key:"sleep",label:"Sleep duration",unit:"h",color:"#8b88ad"},
    {key:"bedtime",label:"Bedtime",unit:"",color:"#9a88ac",clock:true},{key:"wakeTime",label:"Wake time",unit:"",color:"#b49b60",clock:true},
    {key:"weight",label:"Body weight",unit:settings.unit,color:"#a59ab9"},
    {key:"mood",label:"Mood check-in",unit:"/ 5",color:"#8caa73",range:[1,5]},
    {key:"sentiment",label:"Journal tone · daily mean",unit:"",color:"#839e9c",range:[-1,1]},
    {key:"drinks",label:"Drinks logged",unit:"",color:"#b7997a"},{key:"urge",label:"Urge intensity · daily mean",unit:"/ 5",color:"#8fa3af",range:[1,5]},
    {key:"calories",label:"Energy logged",unit:"kcal",color:"#c5ae6f"},{key:"protein",label:"Protein logged",unit:"g",color:"#7f9e78"},
    {key:"carbs",label:"Carbs logged",unit:"g",color:"#a99abb"},{key:"fat",label:"Fat logged",unit:"g",color:"#ca9e85"},
    {key:"trainingSets",label:"Training sets",unit:"",color:"#bb9c80"},{key:"trainingVolume",label:"Training volume",unit:`${settings.unit} × reps`,color:"#9aaa7c"},
    {key:"journalEntries",label:"Journal entries",unit:"",color:"#8b9e93"},
    {key:"foodSpend",label:"On-the-go food spend",unit:"USD",color:"#9ca67e"},{key:"alcoholSpend",label:"Alcohol purchases",unit:"USD",color:"#b09c86"}
  ];
  return <><div className="section-title trends-heading"><div><h2>Your patterns, in one place</h2><p className="muted small">Gaps mean no log. Food totals reflect what you recorded.</p></div><label className="range-select">Time range<select value={range} onChange={e=>setRange(e.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All history</option></select></label></div>
    <div className="trend-summary"><div><strong>{summary.alcoholFreeDays}</strong><span>alcohol-free days / {summary.checkins} checked in</span></div><div><strong>{summary.averageSleep??"—"}<small> h</small></strong><span>average sleep from {summary.checkins} check-ins</span></div><div><strong>{summary.trainingDays}</strong><span>training days logged</span></div><div><strong>{summary.averageSentiment===null?"—":summary.averageSentiment.toFixed(2)}</strong><span>tone from {summary.sentimentScored} scored journal entries</span></div></div>
    <div className="spending-overview"><div><strong>{summary.spending.pricedAwayMeals?formatMoney(summary.spending.foodSpendCents):"—"}</strong><span>on-the-go food · {summary.spending.pricedAwayMeals} of {summary.spending.awayMeals} tagged meals priced</span></div><div><strong>{summary.spending.alcoholPurchases?formatMoney(summary.spending.alcoholSpendCents):"—"}</strong><span>alcohol · {summary.spending.alcoholPurchases} purchases recorded</span></div><p>{summary.spending.homeMeals} meals from home · {summary.spending.untaggedMeals} untagged. These are recorded purchases; unknown costs stay unknown.</p></div>
    <InsightCard mode="trends" entries={entries} settings={settings} from={days[0].date} through={date} aiEnabled={aiEnabled}/>
    <p className="muted small">Journal tone ranges from −1 to +1 and describes the writing. Mood is your own 1–5 check-in.</p>
    <div className="trends-grid">{metrics.map(metric=><TrendChart key={metric.key} days={days} metric={metric}/>)}</div>
    <section className="card memory-card"><div className="card-heading"><h2><Archive size={18}/>Companion history</h2><span>{history.length} snapshots</span></div><p>Recent days stay detailed. Older logs are compressed into two-week snapshots stored in your database. The companion gets the latest 12 snapshots plus totals across all older history. Originals remain available here and in your export; edits and deletions refresh the summaries.</p>{history.length?<details><summary>View saved snapshots</summary><div className="snapshot-list">{history.toReversed().map(s=><article key={s.from}><strong>{s.from} – {s.through}{s.complete?"":" · still growing"}</strong><p>{s.summary.checkins} check-ins · {s.summary.alcoholFreeDays} alcohol-free days · {s.summary.averageSleep??"—"}h average sleep · {s.summary.trainingDays} training days · {s.summary.journalEntries} journal entries</p></article>)}</div></details>:<p className="muted small">Your first snapshot appears once a logged day falls outside the recent 14-day window.</p>}</section>
  </>;
}
