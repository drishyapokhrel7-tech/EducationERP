"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import type { PublicCertificateVerification } from "@education-erp/api-client";

// A genuinely public page — no login, no session, no organization
// context. A third party (an employer, another institution) checking
// a certificate printed with a verification code lands here with
// nothing but that code. See the Certificate model's own
// schema.prisma comment for why this table has no RLS, which is what
// makes this lookup possible at all.
export default function VerifyCertificatePage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PublicCertificateVerification | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setNotFound(false);
    try {
      const data = await api.verifyCertificate(code.trim().toUpperCase());
      setResult(data);
    } catch {
      setNotFound(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify a certificate</CardTitle>
          <CardDescription>
            Enter the verification code printed on the certificate to confirm it was genuinely issued by the institution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex items-end gap-2" onSubmit={onSubmit}>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Verification code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 7K9M3PQRXZ"
                className="uppercase"
              />
            </div>
            <Button type="submit" disabled={!code.trim() || submitting}>
              {submitting ? "Checking…" : "Verify"}
            </Button>
          </form>

          {result ? (
            <div className="space-y-2 rounded-md border p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{result.type}</span>
                <Badge variant={statusVariant(result.status)}>{result.status}</Badge>
              </div>
              <p className="text-muted-foreground">Issued to {result.studentName}</p>
              <p className="text-muted-foreground">Issued on {new Date(result.issuedAt).toLocaleDateString()}</p>
              {result.status === "REVOKED" && result.revokedAt ? (
                <p className="text-destructive">Revoked on {new Date(result.revokedAt).toLocaleDateString()}</p>
              ) : null}
            </div>
          ) : null}

          {notFound ? (
            <p className="text-destructive text-sm">
              No certificate found for this code. Double-check it against the printed document and try again.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
