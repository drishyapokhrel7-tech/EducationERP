"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PhotoInput, EMPTY_PHOTO, hasPhoto, resolvePhotoUrl, type PhotoValue } from "@/components/photo-input";
import { api } from "@/lib/api";
import { submitAction, submitDelete } from "@/lib/submit-action";
import type { CampusType, Organization } from "@education-erp/api-client";

// Split out of the home dashboard (which used to be this page) so
// that page could become an actual "walk in and see what's
// happening" landing dashboard, not a setup form — Institution/
// Campus management gets its own place in the Organization group,
// alongside Org structure (Faculty/Department/Program.../Section),
// which every Campus is itself the root of.
export default function InstitutionsPage() {
  const organizationQuery = useSWR("organization", () => api.getOwnOrganization());
  const organization = organizationQuery.data;
  const campusesQuery = useSWR("campuses", () => api.listCampuses());
  const campuses = campusesQuery.data ?? [];
  const mutateCampuses = campusesQuery.mutate;

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [editingCampusId, setEditingCampusId] = useState<string | null>(null);
  const [editCampusForm, setEditCampusForm] = useState<{ name: string; code: string; type: CampusType }>({
    name: "",
    code: "",
    type: "GENERIC",
  });
  // Deleting an Institution is the root of an entire org tree (for a
  // single-campus school, its only campus) — the one delete button on
  // this page that genuinely earns a confirm step, unlike the small
  // catalog-entity deletes elsewhere which already have a legible
  // dependency-guard error and no real "oops" risk.
  const [deletingCampus, setDeletingCampus] = useState<{ id: string; name: string } | null>(null);

  // A real, persisted Campus.type now backs this picker (previously a
  // client-only cosmetic label with no stored column — see the git
  // history for that former comment). Selecting "College" causes the
  // backend to seed a default Faculty/Department/Program structure
  // for this campus (see the API's college-structure-defaults.ts) —
  // every other option behaves exactly as before, a bare campus row.
  // GENERIC reads as "Other" here, deliberately NOT "Institution" —
  // "Institution" is the umbrella word covering every option in this
  // list (School, College, Montessori, ...), so listing it as one of
  // the choices read as circular/confusing. "Other" is the plain,
  // not-further-classified option; "Institution"/"Institutions" is
  // reserved for the page-level heading below, never a selectable type.
  const CAMPUS_TYPE_OPTIONS = [
    { value: "GENERIC", label: "Other" },
    { value: "SCHOOL", label: "School" },
    { value: "COLLEGE", label: "College" },
    { value: "MONTESSORI", label: "Montessori" },
  ] as const;
  const [campusType, setCampusType] = useState<(typeof CAMPUS_TYPE_OPTIONS)[number]["value"]>("GENERIC");
  // Only describes what's about to be added (the button text, toast
  // messages) — never the section heading/count below. Coupling those
  // to whichever type happens to be selected in the add-form was
  // itself the confusing bug: picking "College" here used to retitle
  // the whole list "Colleges" even with zero colleges actually
  // created. The list's own label is computed separately, below, from
  // the real data only. GENERIC reads as "Institution" here (not the
  // dropdown's own "Other" label) — "Add Institution"/"Institution
  // created" reads naturally as plain action copy, the circularity
  // problem only existed inside the type list itself.
  const campusTypeLabel = campusType === "GENERIC" ? "Institution" : CAMPUS_TYPE_OPTIONS.find((o) => o.value === campusType)!.label;
  const existingCampusLabel = campuses.length === 1 ? "Institution" : "Institutions";

  // Not every institution runs multiple campuses/schools — this
  // shortcut fills the campus form from the organization's own
  // already-validated name/slug (slug is @MinLength(2) at registration,
  // well over the campus code's @MinLength(1), so this always passes
  // validation) instead of making a single-site admin retype it.
  function onSingleInstitution() {
    if (!organization) return;
    setForm({ name: organization.name, code: organization.slug });
    toast.success("Okay No Problem Now you can click Add Institution button below to make this institution official.");
  }

  async function onCreateCampus(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const campus = await api.createCampus({ ...form, type: campusType });
      setForm({ name: "", code: "" });
      toast.success(
        campusType === "COLLEGE"
          ? "College created with a default Faculty/Department/Program structure — edit it anytime under Org Structure."
          : `${campusTypeLabel} created`,
      );
      mutateCampuses([...campuses, campus], { revalidate: false });
    } catch {
      toast.error(`Failed to create ${campusTypeLabel.toLowerCase()}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Institutions</h1>
        <p className="text-muted-foreground text-sm">
          The campuses/schools this organization runs — each is the root of its own Faculty → Department → Program
          structure under Org Structure.
        </p>
      </div>

      {organization ? (
        <BrandingCard
          key={organization.id}
          organization={organization}
          onSaved={() => organizationQuery.mutate()}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{existingCampusLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campuses.length === 0 ? (
            <p className="text-muted-foreground text-sm">No institutions yet.</p>
          ) : (
            <ul className="divide-y">
              {campuses.map((campus) => (
                <li key={campus.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {campus.name} <span className="text-muted-foreground">{campus.code}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCampusId(campus.id);
                        setEditCampusForm({ name: campus.name, code: campus.code, type: campus.type });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeletingCampus({ id: campus.id, name: campus.name })}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editingCampusId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateCampus(editingCampusId, editCampusForm),
                  () => {
                    setEditingCampusId(null);
                    mutateCampuses();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Type</Label>
                <NativeSelect
                  className="w-32"
                  placeholder="Select type"
                  value={editCampusForm.type}
                  onChange={(v) => setEditCampusForm((f) => ({ ...f, type: v as CampusType }))}
                  options={CAMPUS_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editCampusForm.name}
                  onChange={(e) => setEditCampusForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editCampusForm.code}
                  onChange={(e) => setEditCampusForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingCampusId(null)}>
                Cancel
              </Button>
            </form>
          ) : null}

          <Separator />

          {campuses.length === 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Only one {campusTypeLabel.toLowerCase()}? Skip typing it in yourself.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onSingleInstitution} disabled={!organization}>
                I have only one institution
              </Button>
            </div>
          ) : null}

          <form onSubmit={onCreateCampus} className="flex items-end gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <NativeSelect
                className="w-32"
                placeholder="Select type"
                value={campusType}
                onChange={(v) => setCampusType(v as (typeof CAMPUS_TYPE_OPTIONS)[number]["value"])}
                options={CAMPUS_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campus-name">Name</Label>
              <Input
                id="campus-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campus-code">Code</Label>
              <Input
                id="campus-code"
                required
                className="w-24"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Adding…" : `Add ${campusTypeLabel}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletingCampus !== null}
        onOpenChange={(open) => !open && setDeletingCampus(null)}
        title={`Delete ${deletingCampus?.name}?`}
        description="This removes the institution and everything underneath it — faculties, departments, programs, sections. If any of those are still referenced elsewhere, the delete is blocked instead."
        confirmLabel="Delete institution"
        variant="destructive"
        onConfirm={() => {
          if (!deletingCampus) return;
          return submitDelete(() => api.deleteCampus(deletingCampus.id), () => mutateCampuses());
        }}
      />
    </div>
  );
}

// Letterhead / branding — address, phone, email, website and a logo
// that every printable document (invoices, receipts, report cards)
// renders in its header. Only `website` was ever offered at
// registration; the rest had no editing surface until this card.
// `name`/`slug` are deliberately absent — those are identity, changed
// only by a platform admin. Mounted with a `key={organization.id}` by
// the parent so its form state initializes straight from the loaded
// org (no setState-in-effect prefill).
function BrandingCard({ organization, onSaved }: { organization: Organization; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState({
    address: organization.address ?? "",
    phone: organization.phone ?? "",
    email: organization.email ?? "",
    website: organization.website ?? "",
  });
  const [logo, setLogo] = useState<PhotoValue>(
    organization.logoUrl ? { status: "uploaded", url: organization.logoUrl } : EMPTY_PHOTO,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateOwnOrganization({
        address: branding.address.trim() || undefined,
        phone: branding.phone.trim() || undefined,
        email: branding.email.trim() || undefined,
        website: branding.website.trim() || undefined,
        logoUrl: hasPhoto(logo) ? await resolvePhotoUrl(logo) : undefined,
      });
      onSaved();
      toast.success("Branding saved");
    } catch {
      toast.error("Failed to save branding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">
          Appears in the header of every printable document — invoices, receipts, report cards. All optional; documents
          fall back to just the organization name.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <PhotoInput value={logo} onChange={setLogo} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-address">Address</Label>
              <Input
                id="org-address"
                value={branding.address}
                onChange={(e) => setBranding((b) => ({ ...b, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Phone</Label>
              <Input
                id="org-phone"
                value={branding.phone}
                onChange={(e) => setBranding((b) => ({ ...b, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Email</Label>
              <Input
                id="org-email"
                type="email"
                value={branding.email}
                onChange={(e) => setBranding((b) => ({ ...b, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Website</Label>
              <Input
                id="org-website"
                type="url"
                placeholder="https://myschool.edu"
                value={branding.website}
                onChange={(e) => setBranding((b) => ({ ...b, website: e.target.value }))}
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save branding"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
