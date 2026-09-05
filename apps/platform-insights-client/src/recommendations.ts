// Authored product/UX recommendations — not derived from the loaded
// snapshot data, and not user-editable. Each one is grounded in a
// specific, real gap observed while actually building and verifying
// this platform, not a generic best-practices list.

export interface Recommendation {
  theme: "Onboarding" | "Admin ergonomics" | "Retention & communication" | "Monetization";
  title: string;
  rationale: string;
}

export const RECOMMENDATIONS: Recommendation[] = [
  {
    theme: "Onboarding",
    title: "Add a post-signup \"invite your team\" step",
    rationale:
      "A brand-new organization ends registration alone, with no prompt to add colleagues — even though a full Roles & Permissions system already exists to receive them. The first real action after signing up should be inviting the people who'll actually use the platform day to day.",
  },
  {
    theme: "Onboarding",
    title: "Surface the edition comparison earlier, not just on first lock-out",
    rationale:
      "Today an org mostly discovers what Professional/Ultra unlock by hitting a locked feature. A short \"what you get at each tier\" moment during or right after onboarding would set expectations before the first wall, not at it.",
  },
  {
    theme: "Admin ergonomics",
    title: "Add search/filter to the Platform Admin Organizations list",
    rationale:
      "This list has no search box and renders every organization on one page. Hit directly while verifying the billing feature: with 130+ accumulated organizations, finding one specific org meant scanning a long page by eye.",
  },
  {
    theme: "Admin ergonomics",
    title: "Paginate the Platform Admin Organizations list",
    rationale:
      "Related to the search gap above — the same page loads and renders every organization at once. As the platform grows past a few hundred organizations this will only get slower to scan and to load.",
  },
  {
    theme: "Retention & communication",
    title: "Let an organization see the status of its own upgrade request",
    rationale:
      "The manual upgrade-request flow (built this session, since eSewa checkout is temporarily off) is currently one-way: an org submits a request and has no way to check whether Ovexa has seen it or responded. A simple \"your request is pending / resolved\" note on the billing page would close that loop.",
  },
  {
    theme: "Retention & communication",
    title: "Add a lightweight changelog or \"what's new\" surface",
    rationale:
      "The platform ships real features often — a Highlights dashboard, self-service billing, this very insights tool — but an organization has no in-app way to discover any of it. Even a short dated list on the dashboard would help existing users find features they'd actually want.",
  },
  {
    theme: "Retention & communication",
    title: "Remind an org before its paid edition lapses",
    rationale:
      "editionExpiresAt already exists and is enforced, but nothing proactively tells an org their Professional/Ultra period is about to end — they'd only notice after being quietly downgraded to Free. This was an explicitly deferred follow-up when the billing feature was first built.",
  },
  {
    theme: "Monetization",
    title: "Offer a downgrade path, not just silent lapse-to-Free",
    rationale:
      "An org can currently only reach Free again by letting a paid period expire. A clear, explicit \"switch to Free\" option (with a plain warning about what that removes) is more honest than an edition quietly reverting on its own.",
  },
  {
    theme: "Monetization",
    title: "Track which modules never get touched, and ask why",
    rationale:
      "The Module adoption tab in this same dashboard turns this from a guess into a real question — a module with near-zero usage across paying organizations is either badly discoverable or genuinely not wanted, and those call for very different fixes.",
  },
  {
    theme: "Onboarding",
    title: "Show a first-week checklist tied to real usage, not just setup",
    rationale:
      "The dashboard's existing getting-started checklist tracks setup steps (org structure, first student, etc.). Extending it to nudge toward a first real week-one action per module — take attendance once, send one message, run one report — would turn setup completion into actual habit formation.",
  },
];
