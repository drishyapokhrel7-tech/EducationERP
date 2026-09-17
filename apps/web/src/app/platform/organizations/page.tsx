"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { platformApi } from "@/lib/platform-api";
import { getStoredPlatformSession, setStoredPlatformSession } from "@/lib/platform-session";
import type {
  CommissionStatus,
  Edition,
  MarketingCommissionRecord,
  MarketingPartnerRecord,
  PlatformOrganizationSummary,
  PlatformUpgradeRequestSummary,
} from "@education-erp/api-client";

const EDITION_OPTIONS = [
  { value: "FREE", label: "Free (50 records)" },
  { value: "PROFESSIONAL", label: "Professional (500 records)" },
  { value: "ULTRA", label: "Ultra (1000 records)" },
];

const COMMISSION_FILTER_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "ALL", label: "All" },
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

  // Manual upgrade-request inbox — see BillingService.submitUpgradeRequest's
  // own doc comment for why this exists (eSewa checkout is temporarily
  // disabled on the tenant-side billing page).
  const [upgradeRequests, setUpgradeRequests] = useState<PlatformUpgradeRequestSummary[] | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Edit state — one shared inline form, mirrors roles-permissions'
  // own "editingXId + a form rendered below the matching row"
  // convention rather than an always-editable field per row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "" });

  // Delete state — the one action on this page severe enough to
  // warrant more than ConfirmDialog's normal one-click confirm: this
  // removes an entire college and every record ever created under it,
  // not just one entity within an org, so it gates on typing the
  // org's exact name (see ConfirmDialog's confirmText prop).
  const [deletingOrg, setDeletingOrg] = useState<{ id: string; name: string } | null>(null);

  // Per-row optional "how much did they actually deposit" input for
  // resolving an upgrade request referred by a partner — see
  // resolveUpgradeRequest below. Keyed by request id so multiple
  // pending rows don't share one value.
  const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});

  // Marketing partners — list, create, inline edit (same
  // editingId/editForm convention as the orgs list above), and an
  // active/inactive toggle (reversible, so no ConfirmDialog unlike the
  // org hard-delete below).
  const [partners, setPartners] = useState<MarketingPartnerRecord[] | null>(null);
  const [newPartner, setNewPartner] = useState({
    name: "",
    email: "",
    phone: "",
    referralCode: "",
    payoutAccount: "",
    commissionRatePercent: "10",
  });
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [editPartnerForm, setEditPartnerForm] = useState({ name: "", commissionRatePercent: "", payoutAccount: "" });
  const [savingPartnerId, setSavingPartnerId] = useState<string | null>(null);

  // Commissions — filterable list + mark-paid action.
  const [commissions, setCommissions] = useState<MarketingCommissionRecord[] | null>(null);
  const [commissionFilter, setCommissionFilter] = useState<"ALL" | CommissionStatus>("PENDING");
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  function load() {
    platformApi
      .platformListOrganizations()
      .then(setOrgs)
      .catch(() => toast.error("Failed to load organizations"));
    platformApi
      .platformListUpgradeRequests()
      .then(setUpgradeRequests)
      .catch(() => toast.error("Failed to load upgrade requests"));
    platformApi
      .platformListMarketingPartners()
      .then(setPartners)
      .catch(() => toast.error("Failed to load marketing partners"));
  }

  useEffect(() => {
    if (!mounted) return;
    if (!getStoredPlatformSession()) {
      router.replace("/platform/login");
      return;
    }
    load();
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted || !getStoredPlatformSession()) return;
    platformApi
      .platformListMarketingCommissions(commissionFilter === "ALL" ? undefined : { status: commissionFilter })
      .then(setCommissions)
      .catch(() => toast.error("Failed to load commissions"));
  }, [mounted, commissionFilter]);

  async function resolveUpgradeRequest(req: PlatformUpgradeRequestSummary) {
    setResolvingId(req.id);
    try {
      const raw = depositAmounts[req.id];
      const depositedAmount = raw ? Number(raw) : undefined;
      const result = await platformApi.platformResolveUpgradeRequest(req.organizationId, req.id, {
        depositedAmount,
      });
      setUpgradeRequests((prev) => (prev ?? []).filter((r) => r.id !== req.id));
      toast.success(result.commissionCreated ? "Marked resolved — commission recorded" : "Marked resolved");
    } catch {
      toast.error("Failed to resolve request");
    } finally {
      setResolvingId(null);
    }
  }

  async function createPartner(e: FormEvent) {
    e.preventDefault();
    setCreatingPartner(true);
    try {
      const created = await platformApi.platformCreateMarketingPartner({
        name: newPartner.name,
        email: newPartner.email || undefined,
        phone: newPartner.phone || undefined,
        referralCode: newPartner.referralCode,
        payoutAccount: newPartner.payoutAccount || undefined,
        commissionRatePercent: newPartner.commissionRatePercent ? Number(newPartner.commissionRatePercent) : undefined,
      });
      setPartners((prev) => [created, ...(prev ?? [])]);
      setNewPartner({ name: "", email: "", phone: "", referralCode: "", payoutAccount: "", commissionRatePercent: "10" });
      toast.success("Marketing partner added");
    } catch (err) {
      toast.error(err instanceof Error && err.message.includes("code") ? err.message : "Failed to add partner");
    } finally {
      setCreatingPartner(false);
    }
  }

  async function saveEditPartner(e: FormEvent) {
    e.preventDefault();
    if (!editingPartnerId) return;
    setSavingPartnerId(editingPartnerId);
    try {
      const updated = await platformApi.platformUpdateMarketingPartner(editingPartnerId, {
        name: editPartnerForm.name,
        commissionRatePercent: Number(editPartnerForm.commissionRatePercent),
        payoutAccount: editPartnerForm.payoutAccount || undefined,
      });
      setPartners((prev) => (prev ?? []).map((p) => (p.id === editingPartnerId ? updated : p)));
      toast.success("Marketing partner updated");
      setEditingPartnerId(null);
    } catch {
      toast.error("Failed to update partner");
    } finally {
      setSavingPartnerId(null);
    }
  }

  async function togglePartnerActive(partner: MarketingPartnerRecord) {
    setSavingPartnerId(partner.id);
    try {
      const updated = await platformApi.platformUpdateMarketingPartner(partner.id, { active: !partner.active });
      setPartners((prev) => (prev ?? []).map((p) => (p.id === partner.id ? updated : p)));
      toast.success(updated.active ? "Partner reactivated" : "Partner deactivated");
    } catch {
      toast.error("Failed to update partner");
    } finally {
      setSavingPartnerId(null);
    }
  }

  async function markCommissionPaid(id: string) {
    setMarkingPaidId(id);
    try {
      const updated = await platformApi.platformMarkCommissionPaid(id);
      setCommissions((prev) =>
        (prev ?? [])
          .map((c) => (c.id === id ? updated : c))
          .filter((c) => commissionFilter === "ALL" || c.status === commissionFilter),
      );
      toast.success("Commission marked paid");
    } catch {
      toast.error("Failed to mark commission paid");
    } finally {
      setMarkingPaidId(null);
    }
  }

  async function updateEdition(id: string, edition: Edition) {
    setSavingId(id);
    try {
      const updated = await platformApi.platformUpdateOrganization(id, { edition });
      setOrgs((prev) => (prev ?? []).map((o) => (o.id === id ? { ...o, ...updated } : o)));
      toast.success("Edition updated");
    } catch {
      toast.error("Failed to update edition");
    } finally {
      setSavingId(null);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSavingId(editingId);
    try {
      const updated = await platformApi.platformUpdateOrganization(editingId, {
        name: editForm.name,
        slug: editForm.slug,
      });
      setOrgs((prev) => (prev ?? []).map((o) => (o.id === editingId ? { ...o, ...updated } : o)));
      toast.success("Organization updated");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error && err.message.includes("slug") ? err.message : "Failed to update organization");
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
          <CardTitle>Pending upgrade requests</CardTitle>
        </CardHeader>
        <CardContent>
          {!upgradeRequests ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : upgradeRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending requests.</p>
          ) : (
            <div className="space-y-3">
              {upgradeRequests.map((req) => (
                <div key={req.id} className="space-y-1 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {req.organizationName} <span className="text-muted-foreground text-xs">{req.organizationSlug}</span>
                      {" — wants "}
                      <Badge variant="secondary">{req.targetEdition}</Badge>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={resolvingId === req.id}
                      onClick={() => resolveUpgradeRequest(req)}
                    >
                      {resolvingId === req.id ? "Resolving…" : "Mark resolved"}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Contact: {req.contactPhone} · {req.requesterEmail} · {new Date(req.createdAt).toLocaleString()}
                  </p>
                  {req.notes ? <p className="text-muted-foreground text-xs">Notes: {req.notes}</p> : null}
                  {req.referredByPartnerId ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Label className="text-xs">Deposited amount (referred by {req.referredByPartnerName})</Label>
                      <Input
                        className="h-8 w-32"
                        type="number"
                        placeholder="Leave blank for list price"
                        value={depositAmounts[req.id] ?? ""}
                        onChange={(e) => setDepositAmounts((d) => ({ ...d, [req.id]: e.target.value }))}
                      />
                    </div>
                  ) : null}
                  <p className="text-muted-foreground text-xs italic">
                    Change the edition below, then mark resolved.
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colleges &amp; schools</CardTitle>
        </CardHeader>
        <CardContent>
          {!orgs ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No organizations yet.</p>
          ) : (
            <div className="space-y-3">
              {orgs.map((org) => (
                <div key={org.id} className="space-y-3 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {org.name} <span className="text-muted-foreground text-xs">{org.slug}</span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {org.studentCount + org.employeeCount} of {org.limit} records used
                        {org.atLimit ? (
                          <Badge variant="destructive" className="ml-2">
                            At limit
                          </Badge>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <NativeSelect
                        className="w-56"
                        placeholder="Select edition"
                        value={org.edition}
                        onChange={(v) => updateEdition(org.id, v as Edition)}
                        options={EDITION_OPTIONS}
                        disabled={savingId === org.id}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(org.id);
                          setEditForm({ name: org.name, slug: org.slug });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeletingOrg({ id: org.id, name: org.name })}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {editingId === org.id ? (
                    <form className="flex flex-wrap items-end gap-3 border-t pt-3" onSubmit={saveEdit}>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          required
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input
                          required
                          value={editForm.slug}
                          onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={savingId === org.id}>
                        {savingId === org.id ? "Saving…" : "Save"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketing partners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!partners ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : partners.length === 0 ? (
            <p className="text-muted-foreground text-sm">No marketing partners yet.</p>
          ) : (
            <div className="space-y-3">
              {partners.map((partner) => (
                <div key={partner.id} className="space-y-3 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {partner.name}{" "}
                        <span className="text-muted-foreground font-mono text-xs">{partner.referralCode}</span>{" "}
                        <Badge variant={partner.active ? "secondary" : "outline"}>
                          {partner.active ? "Active" : "Inactive"}
                        </Badge>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {partner.commissionRatePercent}% commission
                        {partner.email ? ` · ${partner.email}` : ""}
                        {partner.phone ? ` · ${partner.phone}` : ""}
                        {partner.payoutAccount ? ` · Payout: ${partner.payoutAccount}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={savingPartnerId === partner.id}
                        onClick={() => {
                          setEditingPartnerId(partner.id);
                          setEditPartnerForm({
                            name: partner.name,
                            commissionRatePercent: String(partner.commissionRatePercent),
                            payoutAccount: partner.payoutAccount ?? "",
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={savingPartnerId === partner.id}
                        onClick={() => togglePartnerActive(partner)}
                      >
                        {partner.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </div>

                  {editingPartnerId === partner.id ? (
                    <form className="flex flex-wrap items-end gap-3 border-t pt-3" onSubmit={saveEditPartner}>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          required
                          value={editPartnerForm.name}
                          onChange={(e) => setEditPartnerForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Commission %</Label>
                        <Input
                          required
                          type="number"
                          className="w-24"
                          min={0}
                          max={100}
                          value={editPartnerForm.commissionRatePercent}
                          onChange={(e) => setEditPartnerForm((f) => ({ ...f, commissionRatePercent: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Payout account</Label>
                        <Input
                          value={editPartnerForm.payoutAccount}
                          onChange={(e) => setEditPartnerForm((f) => ({ ...f, payoutAccount: e.target.value }))}
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={savingPartnerId === partner.id}>
                        {savingPartnerId === partner.id ? "Saving…" : "Save"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingPartnerId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <form className="flex flex-wrap items-end gap-3 border-t pt-4" onSubmit={createPartner}>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                required
                value={newPartner.name}
                onChange={(e) => setNewPartner((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Referral code</Label>
              <Input
                required
                placeholder="PARTNER2026"
                value={newPartner.referralCode}
                onChange={(e) => setNewPartner((f) => ({ ...f, referralCode: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input
                type="email"
                value={newPartner.email}
                onChange={(e) => setNewPartner((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input
                value={newPartner.phone}
                onChange={(e) => setNewPartner((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Payout account (optional)</Label>
              <Input
                placeholder="eSewa ID, bank account, …"
                value={newPartner.payoutAccount}
                onChange={(e) => setNewPartner((f) => ({ ...f, payoutAccount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Commission %</Label>
              <Input
                type="number"
                className="w-24"
                min={0}
                max={100}
                value={newPartner.commissionRatePercent}
                onChange={(e) => setNewPartner((f) => ({ ...f, commissionRatePercent: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={creatingPartner}>
              {creatingPartner ? "Adding…" : "Add partner"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Commissions</CardTitle>
            <NativeSelect
              className="w-40"
              placeholder="Filter"
              value={commissionFilter}
              onChange={(v) => setCommissionFilter(v as "ALL" | CommissionStatus)}
              options={COMMISSION_FILTER_OPTIONS}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!commissions ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : commissions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No commissions to show.</p>
          ) : (
            <div className="space-y-3">
              {commissions.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {c.partnerName}{" "}
                      <span className="text-muted-foreground text-xs">
                        referred {c.organizationName} ({c.organizationSlug})
                      </span>{" "}
                      <Badge variant={c.status === "PAID" ? "secondary" : "outline"}>{c.status}</Badge>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      NPR {c.depositedAmount.toLocaleString()} deposited × {c.commissionRatePercent}% ={" "}
                      <span className="font-medium">NPR {c.commissionAmount.toLocaleString()}</span> ·{" "}
                      {new Date(c.createdAt).toLocaleDateString()}
                      {c.paidAt ? ` · Paid ${new Date(c.paidAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  {c.status === "PENDING" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={markingPaidId === c.id}
                      onClick={() => markCommissionPaid(c.id)}
                    >
                      {markingPaidId === c.id ? "Marking…" : "Mark paid"}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletingOrg !== null}
        onOpenChange={(open) => !open && setDeletingOrg(null)}
        title={`Delete ${deletingOrg?.name}?`}
        description="This permanently removes this college and every record ever created under it — students, staff, invoices, exams, attendance, everything. Child records are deleted first, then the college itself. This cannot be undone."
        confirmLabel="Delete college"
        variant="destructive"
        confirmText={deletingOrg?.name}
        onConfirm={async () => {
          if (!deletingOrg) return;
          try {
            await platformApi.platformDeleteOrganization(deletingOrg.id);
            setOrgs((prev) => (prev ?? []).filter((o) => o.id !== deletingOrg.id));
            toast.success(`${deletingOrg.name} deleted`);
          } catch {
            toast.error("Failed to delete organization");
          }
        }}
      />
    </main>
  );
}
