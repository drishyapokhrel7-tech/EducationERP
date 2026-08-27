"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CaptchaField } from "@/components/captcha-field";
import { platformApi } from "@/lib/platform-api";
import { setStoredPlatformSession } from "@/lib/platform-session";

// The cross-org "application super admin" console (licensing
// editions) — a deliberately separate login surface from
// /login, matching this project's own recommended design: every
// tenant User requires organizationId, so a platform admin is a
// genuinely different actor, not a bent version of the existing one.
export default function PlatformLoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState({ captchaId: "", captchaAnswer: "" });
  const [captchaRefresh, setCaptchaRefresh] = useState(0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await platformApi.platformLogin({ email, password, ...captcha });
      setStoredPlatformSession({ accessToken: result.accessToken, admin: result.admin });
      router.push("/platform/organizations");
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? "Invalid credentials"
          : err instanceof ApiError && err.status === 400
            ? "Incorrect captcha — please try again"
            : "Login failed";
      toast.error(message);
      setCaptchaRefresh((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Platform admin</CardTitle>
          <CardDescription>Ovexa licensing &amp; editions console</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
        </CardContent>
      </Card>
    </main>
  );
}
