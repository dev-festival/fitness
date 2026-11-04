"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Activity, ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Coffee, Dumbbell, Flame, Heart, LayoutDashboard, Leaf, LogOut, Menu, Moon, Plus, Scale, Send, Settings2, ShieldCheck, Sparkles, Sprout, Timer, Trash2, Utensils, Waves, X } from "lucide-react";
import { dailyTotals, defaults, localDate, recentDates, type Entry, type EntryInput, type Settings } from "@/lib/model";
import { Pencil } from "lucide-react";
import { buildCompanionContext, CONTEXT_DAYS } from "@/lib/companion";
import FoodLog from "./food-log";
import { JournalLog, JournalTimeline } from "./journal";
import SleepFields from "./sleep-fields";
import Trends from "./trends";
import { sleepFromTimes } from "@/lib/sleep";
import type { HistorySnapshot } from "@/lib/history";
import { eventTimeLabel, formatMoney, entryInstant, localInputTime } from "@/lib/money";
import { AlcoholSpendingLog, AlcoholSpendCard } from "./alcohol-spending";

type View = "Today" | "Alcohol & urges" | "Training" | "Nutrition" | "Wellbeing" | "Journal" | "All trends" | "Settings";
type ModalKind = "food" | "lift" | "weight" | "checkin" | "start-day" | "mood" | "sleep" | "urge" | "coach" | "support" | "journal" | "purchase" | null;
type EditableEntry = Extract<Entry, {kind: "food" | "weight" | "lift"}>;
const navigation = [
  { name: "Today", icon: LayoutDashboard }, { name: "Alcohol & urges", icon: Coffee }, { name: "Training", icon: Dumbbell },
  { name: "Nutrition", icon: Utensils }, { name: "Wellbeing", icon: Heart }, { name: "Journal", icon: BookOpen }, { name: "All trends", icon: Activity }
] as const;
const moods = ["Rough", "Low", "Okay", "Good", "Great"];

export default function Dashboard({ hasPassword, initialDate }: { hasPassword: boolean; initialDate: string }) {
  const [view, setView] = useState<View>("Today");
  const [date, setDate] = useState(initialDate);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [auxBusy, setAuxBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(600);
  const [coachInput, setCoachInput] = useState("");
  const [useRecentLogs, setUseRecentLogs] = useState(true);
  const [coachReply, setCoachReply] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [intensity, setIntensity] = useState(3);
  const [mood, setMood] = useState<number>();
  const [editing, setEditing] = useState<EditableEntry | null>(null);

  async function load() {
    const response = await fetch(`/api/data?date=${localDate()}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setEntries(body.entries); setHistory(body.history || []); setSettings(body.settings); setAiEnabled(body.aiEnabled); setLoaded(true);
  }
  useEffect(() => { setDate(localDate()); load().catch(error => setError(error.message)); }, []);
  useEffect(() => { window.scrollTo({top:0,behavior:"instant"}); }, [view]);
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(""), 4000); return () => clearTimeout(id); } }, [toast]);
  useEffect(() => {
    const saved = Number(sessionStorage.getItem("steady-urge-end"));
    if (saved > Date.now()) setTimerEnd(saved);
  }, []);
  useEffect(() => {
    if (!timerEnd) return;
    const tick = () => { const seconds = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)); setRemaining(seconds); if (!seconds) { setTimerEnd(null); sessionStorage.removeItem("steady-urge-end"); } };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [timerEnd]);
  const today = entries.filter(e => e.date === date);
  const totals = dailyTotals(entries, date);
  const checkin = today.find(e => e.kind === "checkin");
  const hasWeight = today.some(e => e.kind === "weight");
  const firstCheckin = checkin?.mood === undefined && checkin?.sleep === undefined && !hasWeight && !today.some(e => e.kind === "mood");
  const logDate = editing?.date ?? date;
  const week = recentDates(date, 7);
  const weeklyCheckins = entries.filter(e => e.kind === "checkin" && e.drinks !== undefined && week.includes(e.date));
  const alcoholFree = weeklyCheckins.filter(e => e.kind === "checkin" && e.drinks === 0).length;
  const workoutDays = new Set(entries.filter(e => e.kind === "lift" && week.includes(e.date)).map(e => e.date)).size;
  const weights = entries.filter(e => e.kind === "weight" && e.date <= date).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const latestWeight = weights.at(-1);
  const displayDate = new Date(date + "T12:00:00");
  const isToday = date === localDate();
  const companionContext = modal === "coach" ? buildCompanionContext(entries, settings, localDate()) : null;
  const changeDate = (offset: number) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + offset); setDate(localDate(d)); };

  async function mutate(body: unknown, message = "Saved. One small step forward.") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      try { await load(); }
      catch { setError("Your change was saved, but the display couldn’t refresh. Try refreshing before adding it again."); }
      setToast(message); return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save."); return false; }
    finally { setBusy(false); }
  }
  function open(kind: ModalKind, entry: EditableEntry | null = null) {
    setError("");
    setEditing(entry);
    setMood(undefined);
    setModal(kind);
  }
  async function saveEntry(entry: EntryInput) {
    const saved = await mutate(editing ? { action: "update", id: editing.id, entry } : entry, editing ? "Changes saved." : undefined);
    if (saved) setModal(null);
    return saved;
  }
  async function submitLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name));
    if (modal === "lift") return saveEntry({ kind: "lift", date: logDate, name: String(form.get("name")), sets: number("sets"), reps: number("reps"), weight: number("weight") });
    if (modal === "weight") return saveEntry({ kind: "weight", date: logDate, weight: number("weight") });
    if (modal === "urge") return saveEntry({ kind: "urge", date, intensity, note: String(form.get("note")) });
    if (modal === "checkin") return saveEntry({ kind: "checkin", date, drinks: number("drinks") });

    const steps: EntryInput[] = [];
    if (mood !== undefined) {
      const when = String(form.get("when"));
      const stamp = modal === "start-day" ? `${date}T${when}` : when;
      steps.push({ kind: "mood", date: stamp.slice(0, 10), mood, occurredAt: new Date(stamp).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    }
    if (modal === "start-day" && form.get("weight")) steps.push({ kind: "weight", date, weight: number("weight") });
    try {
      if (form.get("bedtime") || form.get("wakeTime")) {
        steps.push({ kind: "checkin", date, ...sleepFromTimes(date, String(form.get("bedtime")), String(form.get("wakeTime"))) });
      } else if (form.get("sleep")) {
        steps.push({ kind: "checkin", date, sleep: number("sleep") });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Check the sleep times.");
      return;
    }
    if (!steps.length) {
      setError(modal === "mood" ? "Choose how you’re feeling." : "Add at least one detail to save.");
      return;
    }
    if (await mutate({ action: "start-day", entries: steps })) setModal(null);
  }
  function startTimer() {
    const end = Date.now() + 600000; setTimerEnd(end); setRemaining(600); sessionStorage.setItem("steady-urge-end", String(end));
  }
  async function sendCoach(event: FormEvent) {
    event.preventDefault(); setCoachBusy(true); setCoachError(""); setCoachReply("");
    try {
      const response = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: coachInput, includeRecentData: useRecentLogs, referenceDate: localDate(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setCoachReply(data.reply);
    } catch (error) { setCoachError(error instanceof Error ? error.message : "Could not connect."); }
    finally { setCoachBusy(false); }
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), settings, entries, history }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `steady-${localDate()}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function recordList(items: Entry[], empty: string) {
    if (!items.length) return <div className="empty-state"><Leaf size={24}/><p>{empty}</p></div>;
    return <div className="record-list">{items.toSorted((a,b) => b.date.localeCompare(a.date) || entryInstant(b) - entryInstant(a)).map(entry => {
      const editable = entry.kind === "food" || entry.kind === "weight" || entry.kind === "lift";
      const named = entry.kind === "food" || entry.kind === "lift" || entry.kind === "alcohol_purchase";
      const title = named ? entry.name : {
        weight: "Body weight", mood: "Mood", checkin: "Daily details", journal: "A thought", urge: "You paused and checked in"
      }[entry.kind];
      const Icon = entry.kind === "food" ? Utensils : entry.kind === "lift" ? Dumbbell : entry.kind === "weight" ? Scale : entry.kind === "alcohol_purchase" ? Coffee : entry.kind === "urge" ? Waves : entry.kind === "journal" ? BookOpen : Heart;
      const time = "occurredAt" in entry ? eventTimeLabel(entry) : null;
      let detail: string | null;
      switch (entry.kind) {
        case "food": detail = `${entry.calories} kcal · ${entry.protein}g protein · ${entry.carbs}g carbs · ${entry.fat}g fat${entry.estimated ? " · AI-assisted estimate" : ""}`; break;
        case "lift": detail = `${entry.sets} × ${entry.reps} · ${entry.weight} ${settings.unit}`; break;
        case "weight": detail = `${entry.weight} ${settings.unit}`; break;
        case "mood": detail = `${time} · ${moods[entry.mood - 1]}`; break;
        case "alcohol_purchase": detail = `${time} · ${formatMoney(entry.costCents)}`; break;
        case "urge": detail = `Urge intensity ${entry.intensity}/5`; break;
        case "journal": detail = entry.sentiment ? `${time} · Tone ${entry.sentiment.score.toFixed(2)}` : time; break;
        case "checkin": detail = [
          entry.drinks === undefined ? null : `${entry.drinks} drinks`,
          entry.sleep === undefined ? null : `${entry.sleep}h sleep`,
          entry.bedAt && entry.wakeAt ? `${eventTimeLabel({occurredAt: entry.bedAt})}–${eventTimeLabel({occurredAt: entry.wakeAt})}` : null,
          entry.mood === undefined ? null : `Feeling ${moods[entry.mood - 1].toLowerCase()}`
        ].filter(Boolean).join(" · "); break;
      }
      return <div className="record" key={entry.id}>
        <div className={`record-icon ${entry.kind}`}><Icon size={17}/></div>
        <div className="record-main">
          <strong>{title}</strong>
          {detail && <span>{detail}</span>}
          {entry.kind === "food" && <span className="food-entry-context">{time || "Time not recorded"} · {entry.source === "home" ? "From home" : entry.source === "away" ? "On the go" : "Not tagged"}{entry.costCents !== undefined ? ` · ${formatMoney(entry.costCents)}` : ""}</span>}
          {"note" in entry && entry.note && <p>{entry.note}</p>}
        </div>
        <span className="record-date">{new Date(entry.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <div className="record-actions">
          {editable && <button className="icon-button" disabled={busy} aria-label={`Edit ${title}`} title="Edit entry" onClick={() => open(entry.kind, entry)}><Pencil size={16}/></button>}
          <button className="icon-button delete" disabled={busy} aria-label={`Delete ${title}`} onClick={() => mutate({ action: "delete", id: entry.id }, "Entry removed.")}><Trash2 size={15}/></button>
        </div>
      </div>;
    })}</div>;
  }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
      <a className="brand" href="/" aria-label="Steady home"><span className="brand-mark"><Sprout size={23}/></span>steady<span className="brand-dot">.</span></a>
      <p className="sidebar-tagline">A little better, every day.</p>
      <div className="nav-label">YOUR SPACE</div>
      <nav aria-label="Main navigation">{navigation.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${view === name ? "active" : ""}`} aria-current={view === name ? "page" : undefined} onClick={() => { setView(name); setMobileNav(false); }}><Icon size={19}/>{name}{view === name && <span className="active-dot"/>}</button>)}</nav>
      <div className="sidebar-note"><div className="little-sprout"><Sprout size={26}/></div><p>Progress has<br/>a thousand small beginnings.</p><span>This one is yours.</span></div>
      <div className="sidebar-bottom"><button className={`nav-item ${view === "Settings" ? "active" : ""}`} onClick={() => { setView("Settings"); setMobileNav(false); }}><Settings2 size={18}/>Your preferences</button><button className="nav-item" onClick={() => open("support")}><CircleHelp size={18}/>Support & resources</button><div className="profile"><div className="avatar">{settings.name ? settings.name.slice(0, 1).toUpperCase() : <Leaf size={20}/>}</div><div><strong>{settings.name || "Your personal space"}</strong><span>One day at a time</span></div>{hasPassword && <button className="icon-button" aria-label="Sign out" onClick={async () => { await fetch("/api/session", { method: "DELETE" }); window.location.reload(); }}><LogOut size={17}/></button>}</div></div>
    </aside>
    {mobileNav && <button aria-label="Close navigation" className="nav-shade" onClick={() => setMobileNav(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={21}/></button><span>Your space</span><ChevronRight size={13}/><strong>{view}</strong></div><div className="topbar-right"><span className="private-label"><ShieldCheck size={14}/> Just for you</span><button className="top-avatar" aria-label="Open preferences" onClick={() => setView("Settings")}>{settings.name ? settings.name.slice(0, 1).toUpperCase() : "S"}</button></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{displayDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</div><h1>{view === "Today" ? `A little more you${settings.name ? ", " + settings.name : ""}.` : view === "Alcohol & urges" ? "Make room for better days." : view === "Training" ? "Show up. Get stronger." : view === "Nutrition" ? "Fuel the life you want." : view === "Wellbeing" ? "How are you, really?" : view === "All trends" ? "Notice what adds up." : view === "Journal" ? "Your days, in your words." : "Make this space yours."}</h1><p>{view === "Today" ? "You don’t have to change everything. Just take the next good step." : view === "Settings" ? "Small goals. Personal reasons. Your own pace." : "A place to notice the small things that add up."}</p></div>{view !== "Settings" && <div className="date-picker"><button className="icon-button" aria-label="Previous day" onClick={() => changeDate(-1)}><ChevronLeft size={16}/></button><label className="date-label"><span>{isToday ? "Today" : displayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><input type="date" aria-label="Choose log date" value={date} max={localDate()} onChange={e => e.target.value && setDate(e.target.value)}/></label><button className="icon-button" aria-label="Next day" disabled={isToday} onClick={() => changeDate(1)}><ChevronRight size={16}/></button></div>}</div>
        {error && !modal && <div role="alert" className="error-banner">{error}<button onClick={() => load().catch(e => setError(e.message))}>Try again</button></div>}
        {!loaded && !error && <div className="loading" role="status">Opening your space…</div>}
        {loaded && <>
        {(view === "Alcohol & urges") && <section className="hero-card"><div className="hero-copy"><span className="pill"><span/> ONE CHOICE AT A TIME</span><h2>You don’t need to figure out forever.<br/>Just this moment.</h2><p>A craving is a feeling, not an instruction.<br/>Give yourself a little space before your next choice.</p><div className="hero-actions"><button className="primary" onClick={() => open("urge")}><Waves size={18}/>I’m having an urge<ArrowRight size={17}/></button><button className="text-button" onClick={() => open("checkin")}>Log drinks<ArrowRight size={16}/></button></div></div><div className="hero-art" aria-hidden="true"><div className="sun"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hill hill-back"/><div className="hill hill-mid"/><div className="hill hill-front"/><div className="art-sprout"><Sprout strokeWidth={1.1}/></div><span>ONE DAY. ONE STEP.</span></div></section>}

        {view === "Today" && <>
          <div className="section-title"><h2>Your day at a glance</h2><span>Small steps count.</span></div>
          <section className="stat-grid">
            <button className="stat-card" onClick={() => setView("Alcohol & urges")}><div className="stat-top"><span className="stat-icon sage"><Coffee size={18}/></span><span>Alcohol-free days<ArrowRight size={14}/></span></div><div className="stat-value">{alcoholFree}<small> / 7 days</small></div><div className="mini-days">{week.map(d => { const c = weeklyCheckins.find(e => e.date === d); return <span key={d} className={c?.kind === "checkin" ? c.drinks === 0 ? "free" : "logged" : ""} title={`${d}: ${c?.kind === "checkin" ? c.drinks + " drinks" : "not logged"}`}>{c?.kind === "checkin" && c.drinks === 0 ? <Check size={12}/> : new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}</span>; })}</div><p>Last 7 days · {weeklyCheckins.length} days logged</p></button>
            <button className="stat-card" onClick={() => setView("Training")}><div className="stat-top"><span className="stat-icon apricot"><Dumbbell size={18}/></span><span>Training this week<ArrowRight size={14}/></span></div><div className="stat-value">{workoutDays}<small> / {settings.weeklyWorkouts} sessions</small></div><div className="progress-track"><i style={{ width: `${Math.min(100, workoutDays / settings.weeklyWorkouts * 100)}%`, background: "var(--orange)" }}/></div><p>Last 7 days · {workoutDays ? "Keep showing up for yourself." : "Your next session starts with showing up."}</p></button>
            <button className="stat-card" onClick={() => open("food")}><div className="stat-top"><span className="stat-icon butter"><Flame size={18}/></span><span>Daily nourishment<Plus size={15}/></span></div><div className="stat-value">{totals.calories.toLocaleString()}<small> / {settings.calories.toLocaleString()} kcal</small></div><div className="progress-track"><i style={{ width: `${Math.min(100, totals.calories / settings.calories * 100)}%`, background: "var(--yellow)" }}/></div><p>{totals.protein}g protein · {totals.carbs}g carbs · {totals.fat}g fat</p></button>
            <button className="stat-card" onClick={() => open("weight")}><div className="stat-top"><span className="stat-icon lavender"><Scale size={18}/></span><span>Body weight<Plus size={15}/></span></div><div className="stat-value">{latestWeight?.kind === "weight" ? latestWeight.weight : "—"}<small> {settings.unit}</small></div><WeightSparkline weights={weights}/><p>{latestWeight ? `Last logged ${new Date(latestWeight.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "A data point, not a judgment."}</p></button>
          </section>


          <section className="card activity-card small-steps">
            <div className="card-heading">
              <h2>{isToday ? "Your small steps today" : "Your small steps"}</h2>
              <button className="text-button" onClick={() => setView("All trends")}><Sparkles size={16}/>Insights<ArrowRight size={15}/></button>
            </div>
            <div className="step-actions">
              {firstCheckin && <div className="first-checkin">
                <p>Start with how you feel, your weight, or last night’s sleep.</p>
                <button className="primary" onClick={() => open("start-day")}><Heart size={16}/>First check-in</button>
              </div>}
              <div className="quick-actions">
                <button className="small-button" onClick={() => open("food")}><Plus size={14}/>Food</button>
                <button className="small-button" onClick={() => open("journal")}><Plus size={14}/>Thought</button>
                {!firstCheckin && <button className="small-button" onClick={() => open("mood")}><Plus size={14}/>Mood</button>}
                <button className="small-button" onClick={() => open("lift")}><Plus size={14}/>Training</button>
              </div>
            </div>
            {recordList(today, "A fresh page for your day.")}
          </section>
        </>}

        {view === "Alcohol & urges" && <><AlcoholSpendCard entries={entries.filter(e=>week.includes(e.date))} onNew={()=>open("purchase")}/><div className="two-column"><section className="card padded"><div className="card-heading"><h2>The last seven days</h2><Coffee size={20}/></div><div className="large-number">{alcoholFree}<span> alcohol-free days logged</span></div><p className="muted">Only days with a drink total are counted.</p><div className="week-grid">{week.map(d => { const c = weeklyCheckins.find(e => e.date === d); return <button key={d} onClick={() => setDate(d)} className={d === date ? "selected" : ""}><span>{new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{c?.kind === "checkin" ? c.drinks === 0 ? <Check size={21}/> : c.drinks : "—"}</strong><small>{c?.kind === "checkin" ? c.drinks === 0 ? "alcohol-free" : "drinks" : "not logged"}</small></button>; })}</div><button className="secondary" onClick={() => open("checkin")}>Log or update drinks<Plus size={16}/></button></section><section className="card reason-card"><Sprout size={27}/><span className="eyebrow">YOUR WHY</span><h2>{settings.reason || "What do you want more room for in your life?"}</h2><button className="text-button" onClick={() => setView("Settings")}>Make it personal<ArrowRight size={15}/></button></section></div><section className="card activity-card"><div className="card-heading"><h2>Check-ins & moments</h2><button className="small-button" onClick={() => open("urge")}><Plus size={14}/>Log an urge</button></div>{recordList(entries.filter(e => (e.kind === "checkin" || e.kind === "urge" || e.kind === "alcohol_purchase") && e.date <= date), "Your story can start with one check-in.")}</section></>}

        {view === "Training" && <><div className="section-title"><h2>Training log</h2><button className="primary" onClick={() => open("lift")}><Plus size={17}/>Log an exercise</button></div><div className="summary-strip"><div><Dumbbell size={22}/><strong>{workoutDays}<span> sessions in the last 7 days</span></strong></div><p>Log exercises with the same date to build a session.<br/>Weights are in {settings.unit}; use 0 for bodyweight work.</p></div><section className="card activity-card"><div className="card-heading"><h2>{isToday ? "Today’s work" : "This day’s work"}</h2><span className="muted">Sets × reps · {settings.unit}</span></div>{recordList(today.filter(e => e.kind === "lift"), "Your next small win is waiting.")}</section><section className="card activity-card"><div className="card-heading"><h2>Previous sessions</h2></div>{recordList(entries.filter(e => e.kind === "lift" && e.date < date), "Your training history will grow here.")}</section></>}

        {view === "Nutrition" && <><div className="section-title"><h2>Nourishment, without the noise</h2><button className="primary" onClick={() => open("food")}><Plus size={17}/>Log food</button></div><div className="nutrition-grid">{(["calories", "protein", "carbs", "fat"] as const).map((key, i) => <section className="card macro-card" key={key}><span className="eyebrow">{key === "calories" ? "ENERGY" : key.toUpperCase()}</span><h2>{totals[key].toLocaleString()}<small> / {settings[key]}{key === "calories" ? " kcal" : "g"}</small></h2><div className="progress-track"><i style={{ width: `${Math.min(100, totals[key] / settings[key] * 100)}%`, background: ["#d6ad61", "#628b71", "#9b91ad", "#cd957b"][i] }}/></div></section>)}</div><p className="muted subnote">Edit your goals in preferences. Log values from food labels or your own estimates.</p><section className="card activity-card"><div className="card-heading"><h2>On your plate</h2></div>{recordList(today.filter(e => e.kind === "food"), "Start with your next meal or snack.")}</section></>}

        {view === "Wellbeing" && <><div className="section-title"><h2>Notice how you’re doing</h2><div className="quick-actions"><button className="secondary" onClick={() => open("weight")}><Scale size={16}/>Log weight</button><button className="primary" onClick={() => open("mood")}><Heart size={16}/>Log a mood</button></div></div><div className="two-column"><section className="card padded"><span className="eyebrow">BODY WEIGHT · {settings.unit.toUpperCase()}</span><div className="large-number">{latestWeight?.kind === "weight" ? latestWeight.weight : "—"}<span> {settings.unit}</span></div><WeightSparkline weights={weights} large/><p className="muted">A trend over time, not a verdict on today.</p></section><section className="card padded"><span className="eyebrow">LAST NIGHT’S SLEEP</span><h2>{checkin?.sleep === undefined ? "How did you sleep?" : `${checkin.sleep} hours`}</h2><button className="text-button" onClick={() => open("sleep")}><Moon size={16}/>{checkin?.sleep === undefined ? "Log sleep" : "Edit sleep"}<ArrowRight size={16}/></button></section></div><section className="card activity-card"><div className="card-heading"><h2>Wellbeing history</h2></div>{recordList(entries.filter(e => (e.kind === "weight" || e.kind === "mood" || (e.kind === "checkin" && (e.sleep !== undefined || e.mood !== undefined))) && e.date <= date), "A little self-awareness starts here.")}</section></>}

        {view === "Journal" && <><div className="section-title"><h2>Notice. Reflect. Begin again.</h2><button className="primary" onClick={() => open("journal")}><Plus size={17}/>New thought</button></div><div className="journal-note"><BookOpen size={22}/><p>A good day, a hard day, a small thing you noticed.<br/>Each thought keeps its own time. Write as often as you like.</p></div><JournalTimeline entries={entries.filter(e=>e.date<=date)} busy={busy} onDelete={id=>{void mutate({action:"delete",id},"Entry removed.");}} onNew={()=>open("journal")}/></>}
        {view === "All trends" && <Trends entries={entries} settings={settings} date={date} history={history.filter(s=>s.through<=date)} aiEnabled={aiEnabled} onChat={() => open("coach")}/>}

        {view === "Settings" && <form className="settings-form" key={JSON.stringify(settings)} onSubmit={async event => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          const unit = data.get("unit");
          if (unit !== settings.unit && entries.some(e => e.kind === "weight" || e.kind === "lift")) { setError("Your existing weights use " + settings.unit + ". Keep that unit to preserve your history. Unit conversion isn’t available yet."); return; }
          await mutate({ action: "settings", settings: { name: data.get("name"), reason: data.get("reason"), unit, calories: Number(data.get("calories")), protein: Number(data.get("protein")), carbs: Number(data.get("carbs")), fat: Number(data.get("fat")), weeklyWorkouts: Number(data.get("weeklyWorkouts")) } }, "Preferences saved.");
        }}><section className="card padded"><h2>The personal part</h2><div className="form-grid"><Field label="What should we call you?" name="name" defaultValue={settings.name} maxLength={40}/><label>Weight unit<select name="unit" defaultValue={settings.unit}><option value="lb">Pounds (lb)</option><option value="kg">Kilograms (kg)</option></select></label></div><label>Your reason to keep going<textarea name="reason" defaultValue={settings.reason} maxLength={500} rows={3}/></label></section><section className="card padded"><h2>Your reference goals</h2><p className="muted">Start with goals that fit your routine. You can adjust them as you go.</p><div className="form-grid"><Field label="Energy (kcal / day)" name="calories" type="number" min={1} max={10000} defaultValue={settings.calories}/><Field label="Protein (g / day)" name="protein" type="number" min={1} max={1000} step="any" defaultValue={settings.protein}/><Field label="Carbs (g / day)" name="carbs" type="number" min={1} max={1000} step="any" defaultValue={settings.carbs}/><Field label="Fat (g / day)" name="fat" type="number" min={1} max={1000} step="any" defaultValue={settings.fat}/><Field label="Training sessions / week" name="weeklyWorkouts" type="number" min={1} max={14} defaultValue={settings.weeklyWorkouts}/></div><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save preferences"}<Check size={16}/></button></section><section className="card padded"><h2>Your data belongs to you.</h2><p className="muted">Records live in your SQLite database. Export a personal backup at any time. When you message your companion, you can include recent logs and compact snapshots of older history. Turn off “Use my app history” to send just your message.</p><button type="button" className="secondary" onClick={exportData}><ArrowDownToLine size={16}/>Export all data</button><div className="connection-status"><span className={aiEnabled ? "status-dot on" : "status-dot"}/>{aiEnabled ? "AI companion connected" : "AI companion is off"}</div><p className="muted small">{aiEnabled ? "API key is configured on your server. Messages are processed by OpenAI." : "To connect, set OPENAI_API_KEY in your server environment. See README.md for setup."}</p></section></form>}
        </>}
        <footer className="page-footer"><span><Sprout size={15}/>Built for a person. Not a perfect person.</span></footer>
      </div>
    </main>
    {toast && <div className="toast" role="status"><Check size={18}/>{toast}</div>}
    {modal && <Dialog title={modal === "urge" ? "Let’s make a little space." : modal === "food" ? editing ? "Edit food" : "A little nourishment." : modal === "lift" ? editing ? "Edit exercise" : "One step stronger." : modal === "weight" ? editing ? "Edit body weight" : "Log body weight" : modal === "checkin" ? "Drinks for this day" : modal === "start-day" ? "Your first check-in" : modal === "mood" ? "How are you feeling right now?" : modal === "sleep" ? "Last night’s sleep" : modal === "purchase" ? "Log alcohol spending." : modal === "journal" ? "A thought for this moment." : modal === "coach" ? "In your corner." : "You don’t have to do this alone."} onClose={() => { if (!busy && !coachBusy && !auxBusy) setModal(null); }}>
      {error && <p className="error" role="alert">{error}</p>}
      {modal === "urge" && <><p className="muted">You only need to choose what to do next. Let’s pause together.</p><div className="urge-timer"><div className={`breathing-orb ${timerEnd ? "breathing" : ""}`}><Waves size={32}/></div><strong>{String(Math.floor(remaining / 60)).padStart(2, "0")}<span>:</span>{String(remaining % 60).padStart(2, "0")}</strong><span>{remaining === 0 ? "You gave yourself some space. How do you feel now?" : timerEnd ? "Breathe slowly. Relax your shoulders." : "A 10-minute pause. One moment at a time."}</span><button className="primary" onClick={startTimer} disabled={Boolean(timerEnd)}><Timer size={17}/>{timerEnd ? "You’re taking a pause" : remaining === 0 ? "Take another pause" : "Start my pause"}</button></div><div className="urge-steps"><p><span>01</span>Get a glass of water or something else you enjoy.</p><p><span>02</span>Move away from the drink. Change your surroundings.</p><p><span>03</span>Text someone you trust: “Could use some company.”</p></div><blockquote>{settings.reason}</blockquote><form onSubmit={submitLog}><label>How strong is the urge? <span className="range-value">{intensity} / 5</span><input type="range" min="1" max="5" value={intensity} onChange={e => setIntensity(Number(e.target.value))}/></label><label>What’s going on? <span className="optional">(optional)</span><textarea name="note" maxLength={2000} rows={2} placeholder="A hard day? A familiar routine? Just notice it."/></label><button className="secondary full" disabled={busy}>Save this moment<Check size={16}/></button></form><p className="muted small">The timer keeps going if you close this window.</p></>}
      {modal === "food" && <FoodLog date={logDate} initial={editing?.kind === "food" ? editing : undefined} aiEnabled={aiEnabled} busy={busy} onBusyChange={setAuxBusy} onSave={saveEntry}/>}
      {modal === "purchase" && <AlcoholSpendingLog date={date} busy={busy} onSave={async entry=>{const saved=await mutate(entry,"Purchase saved.");if(saved)setModal(null);return saved;}}/>}
      {modal === "journal" && <JournalLog date={date} aiEnabled={aiEnabled} busy={busy} onBusyChange={setAuxBusy} onSave={async entry=>{const saved=await mutate(entry,"Thought saved.");if(saved)setModal(null);return saved;}}/>}
      {(modal === "lift" || modal === "weight" || modal === "checkin" || modal === "start-day" || modal === "mood" || modal === "sleep") && <form onSubmit={submitLog} key={modal}>
        <p className="muted modal-date">{editing ? "Editing entry for" : "Logging for"} {new Date(logDate + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
        {modal === "lift" && <><Field label="Exercise" name="name" placeholder="e.g. Barbell squat" defaultValue={editing?.kind === "lift" ? editing.name : undefined} required maxLength={200}/><div className="form-grid"><Field label="Sets" name="sets" type="number" min={1} max={100} defaultValue={editing?.kind === "lift" ? editing.sets : 3} required/><Field label="Reps per set" name="reps" type="number" min={1} max={1000} defaultValue={editing?.kind === "lift" ? editing.reps : 8} required/><Field label={`Weight (${settings.unit})`} name="weight" type="number" min={0} max={10000} step="any" defaultValue={editing?.kind === "lift" ? editing.weight : undefined} required/></div><p className="muted small">Different weights or reps? Save separate entries. Use 0 for bodyweight work.</p></>}
        {modal === "weight" && <><Field label={`Body weight (${settings.unit})`} name="weight" type="number" min={0.1} max={1500} step="any" defaultValue={editing?.kind === "weight" ? editing.weight : undefined} required/><p className="muted">This is information, not a measure of your worth.</p></>}
        {modal === "checkin" && <Field label="Total drinks for this date" name="drinks" type="number" min={0} max={100} defaultValue={checkin?.drinks} required/>}
        {(modal === "mood" || modal === "start-day") && <>
          <fieldset className="mood-picker">
            <legend>{modal === "start-day" ? "How are you feeling? (optional)" : "Choose a mood"}</legend>
            <div className="mood-row compact">{moods.map((label, index) => <button type="button" key={label} className={mood === index + 1 ? "selected" : ""} aria-pressed={mood === index + 1} onClick={() => setMood(mood === index + 1 ? undefined : index + 1)}><MoodFace mood={index + 1}/><span>{label}</span></button>)}</div>
          </fieldset>
          <label>Time of this mood<input name="when" type={modal === "start-day" ? "time" : "datetime-local"} defaultValue={modal === "start-day" ? localInputTime(date).slice(11) : localInputTime(date)} max={modal === "mood" ? `${localDate()}T23:59` : undefined} required={mood !== undefined}/></label>
        </>}
        {modal === "start-day" && !hasWeight && <Field label={`Body weight (${settings.unit}, optional)`} name="weight" type="number" min={0.1} max={1500} step="any"/>}
        {(modal === "sleep" || (modal === "start-day" && checkin?.sleep === undefined)) && <SleepFields date={date} initial={checkin} optional={modal === "start-day"}/>}

        <button className="primary full" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Save this small step"}<Check size={17}/></button>
      </form>}
      {modal === "coach" && <><div className="coach-intro"><Sparkles size={23}/><p>A little help connecting the dots and choosing your next step. What’s on your mind?</p></div>{!aiEnabled && <div className="ai-off"><h3>Your companion is ready to connect.</h3><p>Add your own OpenAI API key in your server environment to enable conversations. The urge timer and every tracking feature work without AI.</p><button className="secondary" onClick={() => { setModal(null); setView("Settings"); }}>View connection settings<ArrowRight size={15}/></button></div>}<form onSubmit={sendCoach}><label>Your message<textarea rows={4} maxLength={3000} value={coachInput} onChange={e => setCoachInput(e.target.value)} placeholder="What patterns do you notice in my recent sleep, mood, and drinking?" required disabled={!aiEnabled}/></label><div className="companion-context"><label className="context-toggle"><input type="checkbox" checked={useRecentLogs} onChange={e => setUseRecentLogs(e.target.checked)} disabled={coachBusy}/><span>Use my app history<small>Your last {CONTEXT_DAYS} days, plus compact snapshots of older logs</small></span></label>{useRecentLogs && companionContext && <details className="context-preview"><summary>What your companion can see</summary><p>{companionContext.window.from} through {companionContext.window.through}</p><ul><li>{companionContext.summary.daysLogged} days with drinks logged · {companionContext.summary.alcoholFreeDaysLogged} alcohol-free days logged</li><li>{companionContext.summary.foodDaysLogged} days with food logs · {companionContext.summary.trainingDaysLogged} training days</li><li>{companionContext.summary.weightReadings} weight readings · {companionContext.summary.urgesLogged} urges logged</li><li>{companionContext.summary.journalEntries} journal entries · up to 12 recent notes</li><li>Your goals, your reason, and {companionContext.history.periodsIncluded} older snapshots</li></ul><span>Unlogged days stay unknown. Food totals may cover only part of a day.</span></details>}<p className="muted small">{useRecentLogs ? "Your message, recent context, and older snapshots are sent to OpenAI when you press Send." : "Only your message is sent to OpenAI."}</p></div><button className="primary full" disabled={!aiEnabled || coachBusy || !coachInput.trim()}>{coachBusy ? "Thinking with you…" : "Send to companion"}<Send size={16}/></button></form>{coachError && <p className="error" role="alert">{coachError}</p>}{coachReply && <div className="coach-response" role="status">{coachReply}</div>}</>}
      {modal === "support" && <div className="support-content"><p>Wanting support is a good enough reason to ask for it. This app can help you notice patterns and take a pause; people and professional care can help too.</p><a href="https://alcoholtreatment.niaaa.nih.gov/" target="_blank" rel="noreferrer"><Heart size={20}/><span><strong>Find alcohol treatment</strong><small>NIAAA’s guide to professional support</small></span><ArrowRight size={17}/></a><a href="https://rethinkingdrinking.niaaa.nih.gov/" target="_blank" rel="noreferrer"><BookOpen size={20}/><span><strong>Rethinking Drinking</strong><small>Practical tools and information from NIAAA</small></span><ArrowRight size={17}/></a><div className="health-note"><strong>A note on stopping safely</strong><p>If you drink heavily or have withdrawal symptoms, talk with a clinician before stopping suddenly. Alcohol withdrawal can be dangerous. For seizures, hallucinations, confusion, or severe symptoms, seek emergency care.</p><a className="inline-link" href="https://rethinkingdrinking.niaaa.nih.gov/thinking-about-change/cut-down-or-quit" target="_blank" rel="noreferrer">Read NIAAA’s guidance<ArrowRight size={13}/></a></div></div>}
    </Dialog>}
  </div>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label>{label}<input {...props}/></label>;
}
function MoodFace({ mood }: { mood: number }) {
  return <svg viewBox="0 0 40 40" fill="none" className={`mood-face mood-${mood}`} aria-hidden="true"><circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="1.4"/><circle cx="14" cy="16" r="1.4" fill="currentColor"/><circle cx="26" cy="16" r="1.4" fill="currentColor"/>{mood === 1 ? <><path d="M13 28 Q20 20 27 28" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M11 12 L16 13 M24 13 L29 12" stroke="currentColor" strokeWidth="1.4"/></> : mood === 2 ? <path d="M14 27 Q20 23 26 27" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/> : mood === 3 ? <path d="M15 26 H25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/> : <path d={mood === 4 ? "M13 24 Q20 31 27 24" : "M12 23 Q20 36 28 23 Z"} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/>}</svg>;
}
function WeightSparkline({ weights, large = false }: { weights: Entry[]; large?: boolean }) {
  const data = weights.slice(-20).flatMap(e => e.kind === "weight" ? [e.weight] : []);
  if (data.length < 2) return <div className={`spark-empty ${large ? "large" : ""}`}><span/>{large && <p>Log at least two weights to see a trend.</p>}</div>;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const points = data.map((n, i) => `${i / (data.length - 1) * 240},${38 - (n - min) / range * 30}`).join(" ");
  return <svg className={`sparkline ${large ? "large" : ""}`} viewBox="0 0 240 44" preserveAspectRatio="none" role="img" aria-label={`Last ${data.length} weight readings, from ${data[0]} to ${data.at(-1)}`}><polyline points={points} fill="none" stroke="#a59ab9" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>;
}
function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = ref.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}><div className="modal-header"><span className="brand small-brand"><Sprout size={19}/>steady.</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21}/></button></div><h2 id="modal-title">{title}</h2>{children}</dialog>;
}
