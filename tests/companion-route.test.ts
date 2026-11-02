import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/coach/route";
import { addEntry } from "../lib/db";

test("companion sends the server's recent SQLite records, supports opt-out, and rejects invalid dates before calling the provider", async () => {
  const names = ["APP_PASSWORD", "VERCEL", "DATABASE_URL", "DATABASE_AUTH_TOKEN", "OPENAI_API_KEY"];
  const saved = new Map(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  const calls: Record<string, any>[] = [];
  try {
    delete process.env.APP_PASSWORD;
    delete process.env.VERCEL;
    delete process.env.DATABASE_AUTH_TOKEN;
    process.env.DATABASE_URL = "file::memory:";
    process.env.OPENAI_API_KEY = "test-key-never-sent";
    globalThis.fetch = async (_input, init) => {
      calls.push(JSON.parse(String(init?.body)));
      return Response.json({ output: [{ content: [{ type: "output_text", text: "You logged two check-ins. Let’s plan tonight." }] }] });
    };
    await addEntry({ kind: "checkin", date: "2026-11-01", drinks: 0, mood: 4, sleep: 8, note: "A walk helped." });
    await addEntry({ kind: "checkin", date: "2026-11-02", drinks: 1, mood: 3, sleep: 7, note: "Busy day." });
    await addEntry({ kind: "urge", date: "2026-10-19", intensity: 3, note: "Excluded old private note" });
    await addEntry({ kind: "urge", date: "2026-11-03", intensity: 3, note: "Excluded future note" });
    const request = (body: unknown) => new Request("http://localhost:3000/api/coach", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(body) });
    const response = await POST(request({ message: "What do you notice?", includeRecentData: true, referenceDate: "2026-11-02", context: "Client fabricated log" }));
    assert.equal(response.status, 200);
    assert.ok((await response.json()).reply.includes("two check-ins"));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].store, false);
    assert.ok(calls[0].input[0].content.includes("A walk helped."));
    assert.ok(!JSON.stringify(calls[0]).includes("Excluded old private note"));
    assert.ok(!JSON.stringify(calls[0]).includes("Excluded future note"));
    assert.ok(!JSON.stringify(calls[0]).includes("Client fabricated log"));
    const context = JSON.parse(calls[0].input[0].content.split("\n").slice(1).join("\n"));
    assert.equal(context.summary.daysLogged, 2);
    assert.equal(context.summary.daysUnknown, 12);
    const privateResponse = await POST(request({ message: "Just my message", includeRecentData: false, referenceDate: "2026-11-02" }));
    assert.equal(privateResponse.status, 200);
    assert.deepEqual(calls[1].input, [{ role: "user", content: "Just my message" }]);
    const invalid = await POST(request({ message: "Hi", includeRecentData: true, referenceDate: "2026-02-30" }));
    assert.equal(invalid.status, 400);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
