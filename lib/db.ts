import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildHistorySnapshots } from "./history";
import { defaults, type Entry, type EntryInput, type Settings } from "./model";

let client: Client | undefined;
let initialized: Promise<void> | undefined;
function database() {
  if (client) return client;
  const url = process.env.DATABASE_URL || "file:data/steady.db";
  if (process.env.VERCEL && !/^libsql:\/\/|^https:\/\//.test(url)) throw new Error("Configure a remote SQLite database before deploying.");
  if (url === "file:data/steady.db") mkdirSync("data", { recursive: true });
  client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  return client;
}
async function ready() {
  const db = database();
  initialized ??= db.batch([
    "CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL, date TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS entries_date ON entries(date)",
    "CREATE UNIQUE INDEX IF NOT EXISTS one_checkin_per_day ON entries(date) WHERE kind = 'checkin'",
    "CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS history_snapshots (period_start TEXT PRIMARY KEY, source_hash TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS companion_cards (cache_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, payload TEXT NOT NULL)"
  ], "write").then(() => {}).catch(error => { initialized = undefined; throw error; });
  await initialized;
  return db;
}
export async function getData(range?: { start: string; end: string }) {
  const db = await ready();
  const [entries, settings] = await Promise.all([
    db.execute(range ? { sql: "SELECT * FROM entries WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC", args: [range.start, range.end] } : "SELECT * FROM entries ORDER BY date DESC, created_at DESC"),
    db.execute("SELECT payload FROM settings WHERE id = 1")
  ]);
  return {
    entries: entries.rows.map(row => ({ ...JSON.parse(String(row.payload)), id: String(row.id), createdAt: String(row.created_at) })) as Entry[],
    settings: settings.rows.length ? { ...defaults, ...JSON.parse(String(settings.rows[0].payload)) } as Settings : defaults
  };
}
export async function addEntry(input: EntryInput) {
  await addEntries([input]);
}
export async function addEntries(inputs: EntryInput[]) {
  const db = await ready();
  const createdAt = new Date().toISOString();
  const statements = inputs.map(input => ({
    sql: input.kind === "checkin"
      ? `INSERT INTO entries (id,kind,date,payload,created_at) VALUES (?,?,?,?,?)
         ON CONFLICT(date) WHERE kind = 'checkin' DO UPDATE SET payload = json_patch(
           CASE WHEN json_type(excluded.payload, '$.sleep') IS NOT NULL
             THEN json_remove(entries.payload, '$.bedAt', '$.wakeAt')
             ELSE entries.payload END,
           excluded.payload)`
      : "INSERT INTO entries (id,kind,date,payload,created_at) VALUES (?,?,?,?,?)",
    args: [crypto.randomUUID(), input.kind, input.date, JSON.stringify(input), createdAt]
  }));
  await db.batch([...statements, "DELETE FROM companion_cards"], "write");
}
export async function updateEntry(id: string, input: Extract<EntryInput, {kind: "food" | "weight" | "lift"}>) {
  const db = await ready();
  const [result] = await db.batch([
    { sql: "UPDATE entries SET date = ?, payload = ? WHERE id = ? AND kind = ?", args: [input.date, JSON.stringify(input), id, input.kind] },
    "DELETE FROM companion_cards"
  ], "write");
  return result.rowsAffected > 0;
}
export async function deleteEntry(id: string) {
  const db = await ready();
  await db.batch([{ sql: "DELETE FROM entries WHERE id = ?", args: [id] },"DELETE FROM companion_cards"],"write");
}
export async function saveSettings(settings: Settings) {
  const db = await ready();
  const current = await db.execute("SELECT payload FROM settings WHERE id = 1");
  const currentUnit = current.rows.length ? JSON.parse(String(current.rows[0].payload)).unit : defaults.unit;
  if (settings.unit !== currentUnit) {
    const weights = await db.execute("SELECT id FROM entries WHERE kind IN ('weight','lift') LIMIT 1");
    if (weights.rows.length) throw new Error("Cannot change units while weight records exist");
  }
  await db.batch([{ sql: "INSERT INTO settings (id,payload) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload", args: [JSON.stringify(settings)] },"DELETE FROM companion_cards"],"write");
}

export async function syncHistorySnapshots(entries: Entry[], referenceDate: string) {
  const db = await ready();
  const snapshots = buildHistorySnapshots(entries, referenceDate);
  const existing = await db.execute("SELECT period_start, source_hash FROM history_snapshots");
  const hashes = new Map(existing.rows.map(row=>[String(row.period_start),String(row.source_hash)]));
  const statements: {sql:string;args:string[]}[] = [];
  for (const snapshot of snapshots) {
    const payload = JSON.stringify(snapshot);
    const hash = createHash("sha256").update(payload).digest("hex");
    if (hashes.get(snapshot.from) !== hash) statements.push({sql:"INSERT INTO history_snapshots (period_start,source_hash,payload,updated_at) VALUES (?,?,?,?) ON CONFLICT(period_start) DO UPDATE SET source_hash=excluded.source_hash,payload=excluded.payload,updated_at=excluded.updated_at",args:[snapshot.from,hash,payload,new Date().toISOString()]});
    hashes.delete(snapshot.from);
  }
  for (const start of hashes.keys()) statements.push({sql:"DELETE FROM history_snapshots WHERE period_start=?",args:[start]});
  if (statements.length) await db.batch(statements,"write");
  return snapshots;
}

export async function readCompanionCard(cacheKey:string,fingerprint:string) {
  const db=await ready();
  const rows=await db.execute({sql:"SELECT payload FROM companion_cards WHERE cache_key=? AND fingerprint=?",args:[cacheKey,fingerprint]});
  return rows.rows.length?JSON.parse(String(rows.rows[0].payload)):null;
}
export async function storeCompanionCard(cacheKey:string,fingerprint:string,payload:unknown) {
  const db=await ready();
  await db.execute({sql:"INSERT INTO companion_cards (cache_key,fingerprint,payload) VALUES (?,?,?) ON CONFLICT(cache_key) DO UPDATE SET fingerprint=excluded.fingerprint,payload=excluded.payload",args:[cacheKey,fingerprint,JSON.stringify(payload)]});
}
