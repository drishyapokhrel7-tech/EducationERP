import { useEffect, useState, type FormEvent } from "react";
import type { SafeUser } from "@education-erp/api-client";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (user: SafeUser) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Same self-hosted human-verification challenge as every other login
  // surface in this project — this is a one-time interactive sign-in
  // (the station then stays signed in via its own refresh token),
  // still done by a real person once, not exempt.
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaSvg, setCaptchaSvg] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  async function loadCaptcha() {
    setCaptchaAnswer("");
    const challenge = await window.deviceGatewayClient.getCaptcha();
    setCaptchaId(challenge.captchaId);
    setCaptchaSvg(challenge.svg);
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!captchaId) throw new Error("Captcha not loaded");
      const user = await window.deviceGatewayClient.login({ identifier, password, captchaId, captchaAnswer });
      onLoggedIn(user);
    } catch {
      setError("Incorrect email/username, password, or captcha answer.");
      loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen centered">
      <form className="card" onSubmit={onSubmit}>
        <h1>Device Gateway Station</h1>
        <p className="muted">
          Sign in with an admin account once — this station stays signed in afterward, refreshing its
          own session automatically.
        </p>
        <label>
          Email or username
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
        <div>
          {captchaSvg ? (
            // Server-generated (svg-captcha), never user-supplied — safe to render directly.
            <div dangerouslySetInnerHTML={{ __html: captchaSvg }} style={{ width: 150, height: 50 }} />
          ) : (
            <p className="muted">Loading captcha…</p>
          )}
          <button type="button" onClick={loadCaptcha} aria-label="Refresh captcha">
            ↻
          </button>
        </div>
        <label>
          Captcha
          <input
            type="text"
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
