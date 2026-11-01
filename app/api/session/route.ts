import { cookies } from "next/headers";
import { configurationError, issueSession, passwordMatches, sameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request." }, { status: 403 });
  const error = configurationError();
  if (error) return Response.json({ error }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.password !== "string" || body.password.length > 1000 || !passwordMatches(body.password)) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return Response.json({ error: "That password didn’t match." }, { status: 401 });
  }
  (await cookies()).set("steady-session", issueSession(), { httpOnly: true, secure: Boolean(process.env.VERCEL), sameSite: "strict", path: "/", maxAge: 7 * 86400 });
  return Response.json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request." }, { status: 403 });
  (await cookies()).delete("steady-session");
  return Response.json({ ok: true });
}
