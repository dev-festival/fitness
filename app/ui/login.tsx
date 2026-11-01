"use client";
import { useState } from "react";
import { Sprout, ArrowRight } from "lucide-react";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <main className="login-wrap"><form className="card login-card" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: new FormData(event.currentTarget).get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.reload();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not sign in."); setBusy(false); }
  }}><div className="brand"><Sprout /> steady<span> / your own pace</span></div><h1>Good to have you here.</h1><p>A small space to take care of yourself.</p><label>Your password<input name="password" type="password" required autoComplete="current-password" autoFocus /></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? "Signing in…" : "Come on in"}<ArrowRight size={18}/></button></form></main>;
}
