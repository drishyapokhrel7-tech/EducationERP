"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

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

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await registerOrganization(form);
      toast.success("Organization created");
      router.push("/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? ((err.body as { message?: string })?.message ?? "Registration failed")
          : "Registration failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
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
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                required
                placeholder="my-school"
                value={form.slug}
                onChange={(e) => update("slug", e.target.value)}
              />
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
              {submitting ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
