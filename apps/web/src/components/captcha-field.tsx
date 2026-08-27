"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

// Shared by every login surface in this app (the main login page and
// the platform-admin login page) — a self-hosted, in-process human-
// verification challenge (see services/api's CaptchaService), not a
// third-party service. Fully controlled: the parent form owns
// {captchaId, captchaAnswer} and submits them alongside its other
// fields; bump `refreshSignal` (e.g. on a failed login) to force a
// fresh challenge, since a captcha is single-use regardless of
// whether the attempt was right.
export function CaptchaField({
  value,
  onChange,
  refreshSignal,
}: {
  value: { captchaId: string; captchaAnswer: string };
  onChange: (next: { captchaId: string; captchaAnswer: string }) => void;
  refreshSignal?: number;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const challenge = await api.getCaptcha();
      setSvg(challenge.svg);
      onChange({ captchaId: challenge.captchaId, captchaAnswer: "" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Deferred to a microtask so nothing in `load` (its own setState
    // calls) runs synchronously within the effect body itself — same
    // restructuring already used by GlobalSearchBox's debounced
    // search effect for the same react-hooks/set-state-in-effect
    // reasoning, just via a microtask instead of a timer since this
    // has no debounce delay of its own.
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshSignal is the only intended trigger besides mount
  }, [refreshSignal]);

  return (
    <div className="space-y-2">
      <Label>Verify you&apos;re human</Label>
      <div className="flex items-center gap-2">
        {svg ? (
          // Server-generated (svg-captcha), never user-supplied — safe to render directly.
          <div className="rounded border" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="text-muted-foreground flex h-[50px] w-[150px] items-center justify-center rounded border text-xs">
            Loading…
          </div>
        )}
        <Button type="button" variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Refresh captcha">
          ↻
        </Button>
      </div>
      <Input
        required
        placeholder="Type the characters above"
        value={value.captchaAnswer}
        onChange={(e) => onChange({ captchaId: value.captchaId, captchaAnswer: e.target.value })}
      />
    </div>
  );
}
