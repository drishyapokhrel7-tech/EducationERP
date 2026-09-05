import { RECOMMENDATIONS, type Recommendation } from "../recommendations";

const THEME_ORDER: Recommendation["theme"][] = [
  "Onboarding",
  "Admin ergonomics",
  "Retention & communication",
  "Monetization",
];

export function RecommendationsTab() {
  return (
    <div className="tab-content">
      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        A curated set of product/UX ideas grounded in specific gaps observed while building and
        verifying this platform — not derived from the loaded snapshot.
      </p>
      {THEME_ORDER.map((theme) => {
        const items = RECOMMENDATIONS.filter((r) => r.theme === theme);
        if (items.length === 0) return null;
        return (
          <div className="card" key={theme}>
            <h2>{theme}</h2>
            <ul className="recommendation-list">
              {items.map((r) => (
                <li key={r.title}>
                  <p className="recommendation-title">{r.title}</p>
                  <p className="muted">{r.rationale}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
