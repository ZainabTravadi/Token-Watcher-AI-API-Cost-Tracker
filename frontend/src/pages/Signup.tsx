import { useState } from "react";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, isLoading, error, user, isAuthReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/app";

  if (isAuthReady && user) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password || !confirmPassword) {
      setLocalError("All fields are required.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    try {
      await signup(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed.";
      setLocalError(message);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 lg:py-16">
        <header className="mb-10 flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-serif text-3xl tracking-tight">TokenWatch</p>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">Create an account and generate a workspace for token tracking.</p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground transition hover:text-foreground">Back to home</Link>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-hairline bg-surface p-10 shadow-sm">
            <div className="space-y-3">
              <p className="label-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Sign up</p>
              <h1 className="font-serif text-3xl">Create your account</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">Set up your default workspace, generate an API key, and retain your session for later.</p>
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
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account…" : "Create account"}
              </Button>
            </form>

            <div className="mt-6 border-t border-hairline pt-4 text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="text-foreground hover:underline">Sign in</Link>.
            </div>
          </section>

          <aside className="space-y-6 rounded-3xl border border-hairline bg-surface p-8 text-sm text-muted-foreground">
            <div>
              <p className="label-mono text-xs uppercase tracking-[0.25em]">Workspace setup</p>
              <p className="mt-3">Your first workspace is created automatically and scoped to the authenticated user.</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-background p-4 text-xs font-mono leading-6">
              <p>default workspace created</p>
              <p>API key generation</p>
              <p>session cookie persistence</p>
              <p>stream reconnection on login</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
