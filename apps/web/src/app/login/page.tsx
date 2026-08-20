"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ApiError } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { getAccessToken } from "@/lib/auth-storage";

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

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ identifier, password });
      const accessToken = getAccessToken();
      const roles = accessToken ? decodeJwtRoles(accessToken) : [];
      router.push(roles.includes("Student") ? "/portal" : "/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? "Invalid credentials"
          : "Login failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
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
              <Label htmlFor="identifier">Email or Student ID</Label>
              <Input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
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
