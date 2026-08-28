"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ApiError, type PasswordResetChallenge } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { getAccessToken } from "@/lib/auth-storage";
import { api } from "@/lib/api";
import { CaptchaField } from "@/components/captcha-field";

// Payload decode only, no signature check — this is purely a client-side
// routing convenience (which landing page to show), never an
// authorization decision. Every route remains enforced server-side by
// the API regardless of what this returns.
function decodeJwtRoles(token: string): string[] {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const decoded = JSON.parse(json) as { roles?: unknown };
    return Array.isArray(decoded.roles) ? decoded.roles.filter((r) => typeof r === "string") : [];
  } catch {
    return [];
  }
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 400) return "Incorrect captcha — please try again";
  if (err instanceof ApiError && err.status === 404) return "No account found for that User Id";
  const message =
    err instanceof ApiError ? ((err.body as { message?: string })?.message ?? null) : null;
  return typeof message === "string" ? message : fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState({ captchaId: "", captchaAnswer: "" });
  const [captchaRefresh, setCaptchaRefresh] = useState(0);

  // Password reset — main tenant login only, matches this page's own
  // scope. "forgot" collects the identifier + captcha; on success the
  // API returns the code directly (this project has no real email
  // provider — same on-screen pattern as registration's email
  // verification), moving to "reset" to collect it back plus a new
  // password.
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetCaptcha, setResetCaptcha] = useState({ captchaId: "", captchaAnswer: "" });
  const [resetCaptchaRefresh, setResetCaptchaRefresh] = useState(0);
  const [resetChallenge, setResetChallenge] = useState<PasswordResetChallenge | null>(null);
  const [resetCodeInput, setResetCodeInput] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ identifier, password, ...captcha });
      const accessToken = getAccessToken();
      const roles = accessToken ? decodeJwtRoles(accessToken) : [];
      if (roles.includes("Student")) {
        router.push("/portal");
      } else {
        // Driver and Teacher logins both carry no RBAC role at all (they
        // only need their own portal, not the admin dashboard) — a 200
        // here is what tells them apart from every other roleless-but-
        // staff login. Checked in sequence, not in parallel, since a
        // 404 from one is the expected, common case, not an error to
        // race against the other.
        try {
          await api.getDriverPortalMe();
          router.push("/driver");
          return;
        } catch {
          // not a driver — fall through
        }
        try {
          await api.getTeacherPortalMe();
          router.push("/teacher");
          return;
        } catch {
          // not a teacher — fall through
        }
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Login failed"));
      // A captcha is single-use whether the attempt succeeded or not
      // (see CaptchaService) — the one just submitted is already
      // consumed, so a fresh one is needed for the next try.
      setCaptchaRefresh((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPassword(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const challenge = await api.forgotPassword({ identifier: resetIdentifier, ...resetCaptcha });
      setResetChallenge(challenge);
      setMode("reset");
    } catch (err) {
      toast.error(errorMessage(err, "Could not start a password reset"));
      setResetCaptchaRefresh((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function onResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetChallenge) return;
    setSubmitting(true);
    try {
      await api.resetPassword({ codeId: resetChallenge.codeId, code: resetCodeInput, newPassword });
      toast.success("Password reset — sign in with your new password");
      setMode("login");
      setPassword("");
      setResetIdentifier("");
      setResetChallenge(null);
      setResetCodeInput("");
      setNewPassword("");
    } catch (err) {
      toast.error(errorMessage(err, "Incorrect code"));
      // Single-use, same as this project's CAPTCHA/email-verification
      // codes — a wrong attempt consumes it, so a fresh one is needed.
      try {
        const fresh = await api.forgotPassword({ identifier: resetIdentifier, ...resetCaptcha });
        setResetChallenge(fresh);
      } catch {
        // Couldn't silently mint a fresh code (e.g. stale captcha) —
        // send them back to the request step rather than leaving a
        // dead code on screen.
        setMode("forgot");
        setResetChallenge(null);
      }
      setResetCodeInput("");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "forgot") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              This project doesn&apos;t send real email yet, so your reset code will be shown right
              here instead of in your inbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-identifier">User Id</Label>
                <Input
                  id="reset-identifier"
                  required
                  placeholder="you@example.com or org.STU001"
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                />
              </div>
              <CaptchaField value={resetCaptcha} onChange={setResetCaptcha} refreshSignal={resetCaptchaRefresh} />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset code"}
              </Button>
            </form>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground mt-4 block text-center text-sm underline underline-offset-4"
              onClick={() => setMode("login")}
            >
              Back to sign in
            </button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (mode === "reset" && resetChallenge) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Please Type Your Reset Code to Proceed.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg border p-4 text-center">
              <p className="text-muted-foreground text-xs">Your reset code</p>
              <p className="font-mono text-2xl tracking-widest">{resetChallenge.code}</p>
            </div>
            <form onSubmit={onResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-code">Enter the code above</Label>
                <Input
                  id="reset-code"
                  required
                  autoFocus
                  inputMode="numeric"
                  value={resetCodeInput}
                  onChange={(e) => setResetCodeInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Resetting…" : "Reset password"}
              </Button>
            </form>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground mt-4 block text-center text-sm underline underline-offset-4"
              onClick={() => {
                setMode("login");
                setResetChallenge(null);
                setResetIdentifier("");
                setResetCodeInput("");
                setNewPassword("");
              }}
            >
              Back to sign in
            </button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Education ERP administration</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">User Id</Label>
              <Input
                id="identifier"
                type="text"
                required
                placeholder="you@example.com or org.STU001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                  onClick={() => {
                    setMode("forgot");
                    setResetIdentifier(identifier);
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <CaptchaField value={captcha} onChange={setCaptcha} refreshSignal={captchaRefresh} />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            No institution yet?{" "}
            <Link href="/register" className="underline underline-offset-4">
              Register one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
