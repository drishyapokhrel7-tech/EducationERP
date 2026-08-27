"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { platformApi } from "@/lib/platform-api";
import { getStoredPlatformSession, setStoredPlatformSession } from "@/lib/platform-session";
import type { Edition, PlatformOrganizationSummary } from "@education-erp/api-client";

const EDITION_OPTIONS = [
  { value: "FREE", label: "Free (50 records)" },
  { value: "PROFESSIONAL", label: "Professional (500 records)" },
  { value: "ULTRA", label: "Ultra (unlimited)" },
];

export default function PlatformOrganizationsPage() {
  const router = useRouter();
  // Same post-hydration mounted guard as dashboard/layout.tsx and
  // portal/layout.tsx, for the same reason — reading localStorage
  // before hydration risks a redirect race.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const [orgs, setOrgs] = useState<PlatformOrganizationSummary[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    if (!getStoredPlatformSession()) {
      router.replace("/platform/login");
      return;
    }
    platformApi
      .platformListOrganizations()
      .then(setOrgs)
      .catch(() => toast.error("Failed to load organizations"));
  }, [mounted, router]);

  async function updateEdition(id: string, edition: Edition) {
    setSavingId(id);
    try {
      const updated = await platformApi.platformUpdateOrganizationEdition(id, edition);
      setOrgs((prev) => (prev ?? []).map((o) => (o.id === id ? { ...o, ...updated } : o)));
      toast.success("Edition updated");
    } catch {
      toast.error("Failed to update edition");
    } finally {
      setSavingId(null);
    }
  }

  const session = mounted ? getStoredPlatformSession() : null;

  if (!mounted || !session) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-muted-foreground text-sm">Signed in as {session.admin.email}</p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setStoredPlatformSession(null);
            router.push("/platform/login");
          }}
        >
          Sign out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licensing editions</CardTitle>
        </CardHeader>
        <CardContent>
          {!orgs ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No organizations yet.</p>
          ) : (
            <div className="space-y-3">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {org.name} <span className="text-muted-foreground text-xs">{org.slug}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {org.studentCount + org.employeeCount} of {org.limit ?? "∞"} records used
                      {org.atLimit ? (
                        <Badge variant="destructive" className="ml-2">
                          At limit
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <NativeSelect
                    className="w-56"
                    placeholder="Select edition"
                    value={org.edition}
                    onChange={(v) => updateEdition(org.id, v as Edition)}
                    options={EDITION_OPTIONS}
                    disabled={savingId === org.id}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
