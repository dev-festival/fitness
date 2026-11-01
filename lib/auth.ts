import { createHmac, timingSafeEqual, scryptSync } from "node:crypto";
import { cookies } from "next/headers";

export function configurationError() {
  if (process.env.VERCEL && (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) return "Set APP_PASSWORD and a SESSION_SECRET of at least 32 characters before hosting.";
  return null;
}
function sign(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || process.env.APP_PASSWORD || "local-only").update(value).digest("hex");
}
export function issueSession(now = Date.now()) {
  const expires = String(now + 7 * 24 * 60 * 60 * 1000);
  return `${expires}.${sign(expires)}`;
}
export function validSession(token: string, now = Date.now()) {
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || !/^[a-f0-9]{64}$/.test(signature) || token.split(".").length !== 2 || Number(expires) <= now) return false;
  const expected = sign(expires);
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export function passwordMatches(input: string) {
  return timingSafeEqual(scryptSync(input, "steady-login", 32), scryptSync(process.env.APP_PASSWORD || "", "steady-login", 32));
}
export async function authorized() {
  if (configurationError()) return false;
  if (!process.env.APP_PASSWORD) return !process.env.VERCEL;
  return validSession((await cookies()).get("steady-session")?.value || "");
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const url = new URL(request.url);
  // Next's production server can normalize request.url to localhost while the
  // browser uses 127.0.0.1. The incoming Host retains the actual destination.
  const host = request.headers.get("host") || url.host;
  return origin === `${url.protocol}//${host}`;
}
