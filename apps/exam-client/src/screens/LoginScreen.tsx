import { useState, type FormEvent } from "react";
import type { SafeUser } from "@education-erp/api-client";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (user: SafeUser) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await window.examClient.login({ identifier, password });
      onLoggedIn(user);
    } catch {
      setError("Incorrect student ID or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen centered">
      <form className="card" onSubmit={onSubmit}>
        <h1>Secure Examination Client</h1>
        <p className="muted">Sign in with your student ID to begin.</p>
        <label>
          Student ID
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
