import { ImageResponse } from "next/og";
import { companies } from "@/lib/companies";
import { MATCH_AUC } from "@/lib/eval-summary";

// The link preview (LinkedIn, Slack, iMessage). Generated once at build time; no data from the
// database, so it's the same for the demo and a self-hosted install.
export const alt = "Shortlist: self-hosted AI job search";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#047857"; // --accent in globals.css
const MUTED = "#6b7280";

export default function Image() {
  const stats = [
    [String(companies.length), "companies' career boards"],
    [MATCH_AUC, "AUC on a labeled eval"],
    ["$0", "to run: local models, no paid APIs"],
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: ACCENT }} />
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>Shortlist</div>
        </div>
        <div style={{ marginTop: 56, fontSize: 68, fontWeight: 600, letterSpacing: -2, lineHeight: 1.08, maxWidth: 960 }}>
          Self-hosted AI job search that shows its work
        </div>
        <div style={{ marginTop: 24, fontSize: 30, color: MUTED, maxWidth: 940, lineHeight: 1.35 }}>
          Hybrid search over public career boards, local-LLM match scores with code-checked rules, company briefs and a tracker.
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 56, borderTop: "2px solid #e5e7eb", paddingTop: 32 }}>
          {stats.map(([value, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 44, fontWeight: 600, color: ACCENT }}>{value}</div>
              <div style={{ fontSize: 22, color: MUTED }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
