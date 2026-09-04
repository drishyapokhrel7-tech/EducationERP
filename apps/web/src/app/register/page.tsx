"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, type EmailVerificationChallenge } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function RegisterPage() {
  const router = useRouter();
  const { registerOrganization } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    slug: "",
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

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const challenge = await registerOrganization(form);
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
      router.push("/dashboard");
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

  if (verification) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verify your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We&apos;ve sent a verification code to your email. Can&apos;t find it? Here it is for now:
            </p>
            <div className="bg-muted rounded-lg border p-4 text-center">
              <p className="text-muted-foreground text-xs">Verification code</p>
              <p className="font-mono text-2xl tracking-widest">{verification.code}</p>
            </div>
            <form onSubmit={onVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Enter the code</Label>
                <Input
                  id="code"
                  required
                  autoFocus
                  inputMode="numeric"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifying}>
                {verifying ? "Verifying…" : "Verify email"}
              </Button>
            </form>
            <div className="flex items-center justify-center text-sm">
              <button type="button" className="text-muted-foreground hover:text-foreground underline" onClick={onResend}>
                Generate a new code
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register your institution</CardTitle>
          <CardDescription>
            Creates a new organization and its first Organization Admin account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Institution name</Label>
              <Input
                id="organizationName"
                required
                value={form.organizationName}
                onChange={(e) => update("organizationName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Prefix Code</Label>
              <Input
                id="slug"
                required
                placeholder="my-school"
                value={form.slug}
                onChange={(e) => update("slug", e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Student Id will look like{" "}
                <span className="font-mono">{form.slug || "prefix"}.STU001</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminFirstName">First name</Label>
                <Input
                  id="adminFirstName"
                  required
                  value={form.adminFirstName}
                  onChange={(e) => update("adminFirstName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminLastName">Last name</Label>
                <Input
                  id="adminLastName"
                  required
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
                value={form.adminEmail}
                onChange={(e) => update("adminEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Registering…" : "Register Institution"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
