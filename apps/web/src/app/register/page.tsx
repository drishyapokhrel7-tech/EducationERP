"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { ApiError, type EmailVerificationChallenge } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AuthShell, authInputClassName } from "@/components/auth-shell";
import { InviteTeamStep } from "./InviteTeamStep";
import { PlansStep } from "./PlansStep";

const REGISTER_BRAND_TAGS = ["Free to start", "5-minute setup", "No card required"] as const;

function RegisterShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell
      brandHeading="Get your institution online in minutes"
      brandSubtitle="One quick setup gives your team admissions, academics, attendance, exams, and fees — ready to use from day one, with nothing else to install."
      brandTags={REGISTER_BRAND_TAGS}
    >
      {children}
    </AuthShell>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

// A small uppercase group label, same visual language as the
// dashboard sidebar's own group headers — breaks this 8-field form
// into two scannable chunks instead of one long wall of inputs, the
// single biggest gap this page had next to login's more careful
// layout.
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      {children}
    </div>
  );
}

// useSearchParams() (for the ?ref= referral prefill below) needs a
// Suspense boundary above it in the App Router, or Next.js bails out
// of static optimization for the whole route — this thin wrapper is
// the boundary; all the actual page content/state lives in the inner
// component below.
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registerOrganization } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    slug: "",
    website: "",
    referralCode: searchParams.get("ref") ?? "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    password: "",
  });

  // The account is already created and the user is already logged in
  // by the time this is set — this is a non-blocking confirmation
  // step, not a gate. See EmailVerificationChallenge's own comment for
  // why the code is shown here rather than emailed.
  const [verification, setVerification] = useState<EmailVerificationChallenge | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  // Post-verification onboarding, before landing on the dashboard —
  // both steps are skippable; "invite-team" and "plans" never block
  // reaching /dashboard, they're a nudge in front of it, not a gate.
  const [step, setStep] = useState<"invite-team" | "plans" | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const challenge = await registerOrganization({
        ...form,
        website: form.website || undefined,
        referralCode: form.referralCode || undefined,
      });
      toast.success("Organization created");
      setVerification(challenge);
    } catch (err) {
      toast.error(errorMessage(err, "Registration failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (!verification) return;
    setVerifying(true);
    try {
      await api.verifyEmail({ codeId: verification.codeId, code: codeInput });
      toast.success("Email verified");
      setStep("invite-team");
    } catch (err) {
      toast.error(errorMessage(err, "Incorrect code"));
      // Single-use, same as this project's CAPTCHA — a wrong attempt
      // consumes it, so a fresh one is needed before retrying.
      const fresh = await api.resendVerificationCode().catch(() => null);
      if (fresh) setVerification(fresh);
      setCodeInput("");
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    try {
      const fresh = await api.resendVerificationCode();
      setVerification(fresh);
      setCodeInput("");
      toast.success("New code generated");
    } catch {
      toast.error("Could not generate a new code");
    }
  }

  if (step === "invite-team") {
    return <InviteTeamStep onNext={() => setStep("plans")} />;
  }

  if (step === "plans") {
    return <PlansStep onNext={() => router.push("/dashboard")} />;
  }

  if (verification) {
    return (
      <RegisterShell>
        <h1 className="font-heading text-2xl font-semibold">Verify your email</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          We&apos;ve sent a verification code to your email. Can&apos;t find it? Here it is for now:
        </p>
        <div className="bg-muted mt-4 rounded-xl border p-4 text-center">
          <p className="text-muted-foreground text-xs">Verification code</p>
          <p className="font-mono text-2xl tracking-widest">{verification.code}</p>
        </div>
        <form onSubmit={onVerify} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Enter the code</Label>
            <Input
              id="code"
              required
              autoFocus
              inputMode="numeric"
              className={authInputClassName}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={verifying}>
            {verifying ? "Verifying…" : "Verify email"}
          </Button>
        </form>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mt-6 block w-full text-center text-sm underline underline-offset-4"
          onClick={onResend}
        >
          Generate a new code
        </button>
      </RegisterShell>
    );
  }

  return (
    <RegisterShell>
      <h1 className="font-heading text-2xl font-semibold">Register your institution</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium underline underline-offset-4">
          Sign in
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <FieldGroup label="Institution">
          <div className="space-y-2">
            <Label htmlFor="organizationName">Institution name</Label>
            <Input
              id="organizationName"
              required
              className={authInputClassName}
              placeholder="Greenwood International School"
              value={form.organizationName}
              onChange={(e) => update("organizationName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Prefix code</Label>
            <Input
              id="slug"
              required
              className={authInputClassName}
              placeholder="my-school"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Short code used in every student ID, e.g.{" "}
              <span className="font-mono">{form.slug || "prefix"}.STU001</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">
              Website <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="website"
              type="url"
              className={authInputClassName}
              placeholder="https://myschool.edu"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referralCode">
              Referral code <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="referralCode"
              className={authInputClassName}
              placeholder="PARTNER2026"
              value={form.referralCode}
              onChange={(e) => update("referralCode", e.target.value)}
            />
          </div>
        </FieldGroup>

        <FieldGroup label="Your account">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adminFirstName">First name</Label>
              <Input
                id="adminFirstName"
                required
                className={authInputClassName}
                value={form.adminFirstName}
                onChange={(e) => update("adminFirstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminLastName">Last name</Label>
              <Input
                id="adminLastName"
                required
                className={authInputClassName}
                value={form.adminLastName}
                onChange={(e) => update("adminLastName", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin email</Label>
            <Input
              id="adminEmail"
              type="email"
              required
              className={authInputClassName}
              placeholder="you@myschool.edu"
              value={form.adminEmail}
              onChange={(e) => update("adminEmail", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                className={`${authInputClassName} pr-10`}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
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
            <p className="text-muted-foreground text-xs">At least 8 characters.</p>
          </div>
        </FieldGroup>

        <Button type="submit" className="h-11 w-full rounded-xl" disabled={submitting}>
          {submitting ? "Registering…" : "Register institution"}
        </Button>
      </form>
    </RegisterShell>
  );
}
