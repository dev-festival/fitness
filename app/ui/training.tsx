import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import type { EntryInput, Lift, Settings, Workout } from "@/lib/model";
import { liftSets } from "@/lib/training";

const dayLabel = (date: string) => new Date(date + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "long" });
const timeLabel = (stamp: string) => new Date(stamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export function LiftForm({ initial, lifts, date, workoutId, unit, busy, onSave }: {
  initial?: Lift;
  lifts: Lift[];
  date: string;
  workoutId?: string;
  unit: Settings["unit"];
  busy: boolean;
  onSave: (entry: EntryInput, id: string) => Promise<boolean>;
}) {
  const suggestionsId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState(() => (initial ? liftSets(initial) : [{ reps: 8, weight: "" }])
    .map((set, id) => ({ id, reps: String(set.reps), weight: String(set.weight) })));
  const nextRowId = useRef(rows.length);
  const submission = useRef<{ payload: string; id: string } | null>(null);
  const names = [...new Set(lifts.map(lift => lift.name))].sort((a, b) => a.localeCompare(b));
  const previous = lifts.find(lift => lift.id !== initial?.id && lift.date <= date &&
    lift.name.toLowerCase() === name.trim().toLowerCase());

  function addSet() {
    const id = nextRowId.current++;
    setRows(current => [...current, { ...current[current.length - 1], id }]);
  }

  function changeSet(id: number, field: "reps" | "weight", value: string) {
    setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry = {
      kind: "lift" as const, name: name.trim(), date, workoutId,
      setRows: rows.map(row => ({ reps: Number(row.reps), weight: Number(row.weight) }))
    };
    const payload = JSON.stringify(entry);
    if (submission.current?.payload !== payload) submission.current = { payload, id: crypto.randomUUID() };
    await onSave(entry, submission.current.id);
  }

  return <form onSubmit={submit}>
    <p className="muted modal-date">{dayLabel(date)}{workoutId && " · Workout exercise"}</p>
    <fieldset className="training-fields" disabled={busy}>
      <label>Exercise
        <input list={suggestionsId} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Barbell squat" required maxLength={200}/>
      </label>
      <datalist id={suggestionsId}>{names.map(exercise => <option key={exercise} value={exercise}/>)}</datalist>
      {previous && <details className="muted small">
        <summary>Last logged on {dayLabel(previous.date)}</summary>
        <ol>{liftSets(previous).map((set, index) => <li key={index}>{set.reps} reps × {set.weight} {unit}</li>)}</ol>
      </details>}
      <div className="training-set-grid training-set-head" aria-hidden="true">
        <span>Set</span><span>Reps</span><span>Weight ({unit})</span>
      </div>
      {rows.map((row, index) => <div className="training-set-grid" key={row.id}>
        <span>{index + 1}</span>
        <input aria-label={`Set ${index + 1} reps`} type="number" inputMode="numeric" min={1} max={1000} required value={row.reps} onChange={event => changeSet(row.id, "reps", event.target.value)}/>
        <input aria-label={`Set ${index + 1} weight in ${unit}`} type="number" inputMode="decimal" min={0} max={10000} step="any" required value={row.weight} onChange={event => changeSet(row.id, "weight", event.target.value)}/>
        <button type="button" className="icon-button delete training-remove" aria-label={`Remove set ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(current => current.filter(set => set.id !== row.id))}><X size={16}/></button>
      </div>)}
      <p className="muted small">Use 0 for bodyweight work.</p>
      <button type="button" className="secondary" disabled={rows.length === 100} onClick={addSet}><Plus size={16}/>Add set</button>
      <button className="primary full training-save" disabled={!name.trim()}>{busy ? "Saving…" : initial ? "Save changes" : "Save exercise"}<Check size={17}/></button>
    </fieldset>
  </form>;
}

export function TrainingLog({ lifts, workouts, active, date, trainingDays, busy, onStart, onFinish, onLog, renderLifts }: {
  lifts: Lift[];
  workouts: Workout[];
  active?: Workout;
  date: string;
  trainingDays: number;
  busy: boolean;
  onStart: () => void;
  onFinish: (id: string) => void;
  onLog: (workout?: Workout) => void;
  renderLifts: (lifts: Lift[], empty: string) => ReactNode;
}) {
  const sessions = new Map<string, Lift[]>();
  const datedLogs = new Map<string, Lift[]>();
  for (const lift of lifts) {
    const groups = lift.workoutId ? sessions : datedLogs;
    const key = lift.workoutId ?? lift.date;
    const group = groups.get(key) ?? [];
    group.push(lift);
    groups.set(key, group);
  }
  const historyDates = [...new Set([...workouts.filter(workout => workout.finishedAt).map(workout => workout.date), ...datedLogs.keys()])]
    .filter(day => day <= date).sort().reverse();

  return <>
    <div className="section-title training-heading">
      <h2>Training log</h2>
      {!active && <button className="primary" disabled={busy} onClick={onStart}>Start workout</button>}
    </div>
    {active && <section className="card activity-card">
      <div className="card-heading training-heading">
        <div><h2>Workout in progress</h2><span className="muted small">{dayLabel(active.date)} · Started {timeLabel(active.startedAt)}</span></div>
        <button className="secondary" disabled={busy} onClick={() => onFinish(active.id)}>Finish workout</button>
      </div>
      {renderLifts(sessions.get(active.id) ?? [], "Add your first exercise when you’re ready.")}
      <div className="training-action"><button className="primary" disabled={busy} onClick={() => onLog(active)}><Plus size={17}/>Add exercise</button></div>
    </section>}
    <div className="section-title training-heading">
      <div><h2>Training history</h2><span className="muted small">{trainingDays} training days in the last 7 days</span></div>
      <button className="secondary" disabled={busy} onClick={() => onLog()}>Log for selected date</button>
    </div>
    {!historyDates.length && <p className="muted">No training logged through {dayLabel(date)}.</p>}
    {historyDates.map(day => <section key={day} className="training-history-day">
      <h3>{dayLabel(day)}</h3>
      {workouts.filter(workout => workout.date === day && workout.finishedAt).map(workout => <section className="card activity-card" key={workout.id}>
        <div className="card-heading"><h2>Workout</h2><span className="muted small">{timeLabel(workout.startedAt)} – {timeLabel(workout.finishedAt!)}</span></div>
        {renderLifts(sessions.get(workout.id) ?? [], "No exercises logged for this workout.")}
      </section>)}
      {datedLogs.has(day) && <section className="card activity-card">
        <div className="card-heading"><h2>Date-based log</h2></div>
        {renderLifts(datedLogs.get(day)!, "")}
      </section>}
    </section>)}
  </>;
}
