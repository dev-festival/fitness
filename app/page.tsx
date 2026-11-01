import { authorized, configurationError } from "@/lib/auth";
import Dashboard from "./ui/dashboard";
import Login from "./ui/login";
import { localDate } from "@/lib/model";
export const dynamic = "force-dynamic";
export default async function Page() {
  const error = configurationError();
  if (error) return <main className="login-wrap"><section className="card login-card"><h1>Let’s make this private.</h1><p>{error}</p><p>See .env.example and the deployment guide in README.md.</p></section></main>;
  if (!await authorized()) return <Login />;
  return <Dashboard hasPassword={Boolean(process.env.APP_PASSWORD)} initialDate={localDate()} />;
}
