import { useState } from "react";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, user, isAuthReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/app";

  if (isAuthReady && user) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError("Email and password are required.");
      return;
    }

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setLocalError(message);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 lg:py-16">
        <header className="mb-10 flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-serif text-3xl tracking-tight">TokenWatcher</p>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">A quiet, operational console for AI spend observability.</p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground transition hover:text-foreground">Back to home</Link>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="border border-hairline bg-surface p-8 sm:p-10">
            <div className="space-y-3">
              <p className="label-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Authentication</p>
              <h1 className="font-serif text-3xl">Sign in to your workspace</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">Restore your session, reconnect realtime streams, and continue tracking token usage across your workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {(error || localError) && (
                <Alert variant="destructive">
                  <AlertDescription>{error || localError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 border-t border-hairline pt-4 text-sm text-muted-foreground">
              Don’t have an account? <Link to="/signup" className="text-foreground hover:underline">Create one</Link>.
            </div>
          </section>

          <aside className="space-y-6 border border-hairline bg-surface p-8 text-sm text-muted-foreground">
            <div>
              <p className="label-mono text-xs uppercase tracking-[0.25em]">Operational by design</p>
              <p className="mt-3">Sign in to access your workspace and resume realtime analytics without a glossy checkout flow.</p>
            </div>
            <div className="border border-hairline bg-background p-4 text-xs font-mono leading-6">
              <p>workspace-scoped auth</p>
              <p>session persistence</p>
              <p>realtime stream restore</p>
              <p>quiet console aesthetic</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
