"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { InviteUserResult } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/submit-action";

// The first real action after registering — inviting the colleagues
// who'll actually use the platform day to day, into the Roles &
// Permissions system that already exists to receive them. Entirely
// optional: 0 invites and moving on is a completely normal outcome,
// not a failure state — this is a nudge, not a gate.
export function InviteTeamStep({ onNext }: { onNext: () => void }) {
  const roles = useSWR("register-invite-roles", () => api.listRoles());
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", roleId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [invited, setInvited] = useState<InviteUserResult[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.inviteUser(form);
      setInvited((prev) => [...prev, result]);
      setForm({ firstName: "", lastName: "", email: "", roleId: "" });
      toast.success(`Invited ${result.user.firstName} ${result.user.lastName}`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send that invite"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Invite your team</CardTitle>
          <CardDescription>
            Add the colleagues who&apos;ll use the platform day to day — you can assign more roles later from
            Roles &amp; Permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">First name</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <NativeSelect
                placeholder="Select a role"
                value={form.roleId}
                onChange={(v) => setForm((f) => ({ ...f, roleId: v }))}
                options={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={submitting || !form.roleId}>
              {submitting ? "Inviting…" : "Invite"}
            </Button>
          </form>

          {invited.length > 0 ? (
            <ul className="space-y-2">
              {invited.map((entry) => (
                <li key={entry.user.id} className="rounded border bg-amber-50 p-3 text-sm">
                  <p>
                    <strong>
                      {entry.user.firstName} {entry.user.lastName}
                    </strong>{" "}
                    can sign in with <strong>{entry.user.email}</strong> and this temporary password — share it
                    with them now, it won&apos;t be shown again:
                  </p>
                  <p className="mt-1 font-mono text-base font-semibold">{entry.tempPassword}</p>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex justify-between pt-2">
            <button type="button" className="text-muted-foreground hover:text-foreground text-sm underline" onClick={onNext}>
              Skip for now
            </button>
            <Button type="button" onClick={onNext}>
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
