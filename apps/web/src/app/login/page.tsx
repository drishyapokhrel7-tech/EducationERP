"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, GraduationCap, Sparkles } from "lucide-react";
import { ApiError, type PasswordResetChallenge } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
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

// Left brand panel — purely visual, no auth logic, no real/internal
// data. Hidden below `lg` so small screens just get the plain form,
// full width. The centerpiece is an abstract illustration + brand
// copy for Ovexa Education, not a data mockup.
function BrandPanel() {
  return (
    <div className="from-primary via-primary relative hidden overflow-hidden bg-gradient-to-br to-[oklch(0.5_0.15_290)] p-10 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      {/* Soft decorative glow — abstract, not a data visualization */}
      <div className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
          <GraduationCap className="size-5 text-white" />
        </div>
        <span className="font-heading text-lg font-semibold text-white">Ovexa Education</span>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="relative flex size-28 items-center justify-center rounded-3xl bg-white/10 backdrop-blur">
          <div className="absolute inset-0 rounded-3xl border border-white/20" />
          <GraduationCap className="size-14 text-white" strokeWidth={1.5} />
          <div className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-white shadow-lg">
            <Sparkles className="size-4 text-primary" />
          </div>
        </div>
        <div className="max-w-sm space-y-3">
          <h2 className="font-heading text-2xl font-semibold text-white">
            Run your institution, effortlessly
          </h2>
          <p className="text-sm leading-relaxed text-white/80">
            Ovexa Education brings admissions, academics, attendance, exams, and fees together
            in one place — built for schools and colleges to run smoothly, end to end.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {["Admissions", "Academics", "Finance", "Examinations"].map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <p className="relative text-sm text-white/70">A complete Education Operating System.</p>
    </div>
  );
}

// Shared shell for all three modes — plain (no Card border) to match
// the two-panel layout; each mode supplies its own heading/subtitle/
// body.
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState({ captchaId: "", captchaAnswer: "" });
  const [captchaRefresh, setCaptchaRefresh] = useState(0);

  // Password reset — main tenant login only, matches this page's own
  // scope. "forgot" collects the identifier + captcha; on success the
  // API sends the code to the account's real email address (no
  // on-screen fallback anymore — see PasswordResetService), moving to
  // "reset" to collect it back plus a new password.
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetCaptcha, setResetCaptcha] = useState({ captchaId: "", captchaAnswer: "" });
  const [resetCaptchaRefresh, setResetCaptchaRefresh] = useState(0);
  const [resetChallenge, setResetChallenge] = useState<PasswordResetChallenge | null>(null);
  const [resetCodeInput, setResetCodeInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const inputClassName = "h-11 rounded-xl px-4";

  if (mode === "forgot") {
    return (
      <AuthShell>
        <h1 className="font-heading text-2xl font-semibold">Reset your password</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Enter your User Id and, if we find a matching account, we&apos;ll email you a reset
          code.
        </p>
        <form onSubmit={onForgotPassword} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-identifier">User Id</Label>
            <Input
              id="reset-identifier"
              required
              className={inputClassName}
              placeholder="you@example.com or org.STU001"
              value={resetIdentifier}
              onChange={(e) => setResetIdentifier(e.target.value)}
            />
          </div>
          <CaptchaField value={resetCaptcha} onChange={setResetCaptcha} refreshSignal={resetCaptchaRefresh} />
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={submitting}>
            {submitting ? "Sending…" : "Send reset code"}
          </Button>
        </form>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mt-6 block text-center text-sm underline underline-offset-4"
          onClick={() => setMode("login")}
        >
          Back to sign in
        </button>
      </AuthShell>
    );
  }

  if (mode === "reset" && resetChallenge) {
    return (
      <AuthShell>
        <h1 className="font-heading text-2xl font-semibold">Please Type Your Reset Code to Proceed.</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Check your email — we&apos;ve sent a 6-digit reset code to the address on your account.
          Enter it below along with your new password.
        </p>
        <form onSubmit={onResetPassword} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-code">Reset code from your email</Label>
            <Input
              id="reset-code"
              required
              autoFocus
              inputMode="numeric"
              className={inputClassName}
              placeholder="6-digit code"
              value={resetCodeInput}
              onChange={(e) => setResetCodeInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                required
                minLength={8}
                className={`${inputClassName} pr-10`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={submitting}>
            {submitting ? "Resetting…" : "Reset password"}
          </Button>
        </form>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mt-6 block text-center text-sm underline underline-offset-4"
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
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-heading text-2xl font-semibold">Welcome to Ovexa Education</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        No institution yet?{" "}
        <Link href="/register" className="text-primary font-medium underline underline-offset-4">
          Register now
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">User Id</Label>
          <Input
            id="identifier"
            type="text"
            required
            className={inputClassName}
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
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              className={`${inputClassName} pr-10`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <CaptchaField value={captcha} onChange={setCaptcha} refreshSignal={captchaRefresh} />
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
