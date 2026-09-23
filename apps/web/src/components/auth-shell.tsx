import { GraduationCap, Sparkles } from "lucide-react";

// Shared two-panel shell for every unauthenticated auth screen (login,
// register, and the post-registration onboarding steps that render
// through this same entry point) — extracted from the login page so
// register stops being the one screen in this flow with no brand
// identity at all, instead of duplicating the panel per page.
export function BrandPanel({
  heading,
  subtitle,
  tags,
}: {
  heading: string;
  subtitle: string;
  tags: readonly string[];
}) {
  return (
    <div className="from-primary via-primary relative hidden overflow-hidden bg-gradient-to-br to-[oklch(0.5_0.15_290)] p-10 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      {/* Soft decorative glow — abstract, not a data visualization */}
      <div className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
          <GraduationCap className="size-5 text-white" />
        </div>
        <span className="font-heading text-lg font-semibold text-white">Ovexa Education</span>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="relative flex size-28 items-center justify-center rounded-3xl bg-white/10 backdrop-blur">
          <div className="absolute inset-0 rounded-3xl border border-white/20" />
          <GraduationCap className="size-14 text-white" strokeWidth={1.5} />
          <div className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-white shadow-lg">
            <Sparkles className="size-4 text-primary" />
          </div>
        </div>
        <div className="max-w-sm space-y-3">
          <h2 className="font-heading text-2xl font-semibold text-white">{heading}</h2>
          <p className="text-sm leading-relaxed text-white/80">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {tags.map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <p className="relative text-sm text-white/70">A complete Education Operating System.</p>
    </div>
  );
}

// Shared shell for every unauthenticated screen — plain (no Card
// border) to match the two-panel layout; each caller supplies its own
// heading/subtitle/body plus the brand panel's copy (registration and
// login describe the product slightly differently).
export function AuthShell({
  brandHeading,
  brandSubtitle,
  brandTags,
  children,
}: {
  brandHeading: string;
  brandSubtitle: string;
  brandTags: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      <BrandPanel heading={brandHeading} subtitle={brandSubtitle} tags={brandTags} />
      <div className="flex flex-1 items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}

// Shared input treatment — every field on every auth screen (login,
// register, both post-registration steps) uses this exact height/
// radius/padding, so the whole unauthenticated flow reads as one
// screen rather than a patchwork of default shadcn inputs.
export const authInputClassName = "h-11 rounded-xl px-4";
