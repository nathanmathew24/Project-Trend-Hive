import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, Cell, PieChart, Pie
} from "recharts";

import { api } from "../lib/api";
import { S } from "../styles/theme";
import { HoneycombBg, Logo, Card, Loader, ScoreBadge, ChartTooltip, ConfidenceBadge, FadeIn, PublicNav, AppNav, FinancialNavButton, PrimaryButton, SecondaryButton } from "../components/ui";

function OpportunitiesPage({ navigate }) {
  const [profile, setProfile] = useState("balanced_investor");
  const [profiles, setProfiles] = useState([]);
  const [opps, setOpps] = useState(null);

  useEffect(() => { api("/explain/profiles").then(d => d && setProfiles(d)); }, []);
  useEffect(() => {
  setOpps(null); // clear old results so loader shows while fetching
  api(`/recommend?profile=${profile}&top_n=15`).then(d => d && setOpps(d));
}, [profile]);

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <HoneycombBg /><AppNav navigate={navigate} currentPage="opportunities" />
      <FinancialNavButton navigate={navigate} currentPage="opportunities" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32, position: "relative", zIndex: 1 }}>
        <h1 style={{ color: "#fff", fontSize: 36, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.03em" }}>Opportunity Recommendations</h1>
        <p style={{ color: S.muted, fontSize: 14, marginBottom: 28 }}>AI-powered rankings by investor profile — live from API</p>

        {/* Profile Selector */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
          {(profiles.length ? profiles : [{ key: "balanced_investor", label: "Balanced Investor" }, { key: "budget_cautious", label: "Budget Cautious" }, { key: "growth_hunter", label: "Growth Hunter" }, { key: "premium_concept", label: "Premium Concept" }, { key: "tourist_focused", label: "Tourist Focused" }]).map(p => (
            <button key={p.key} onClick={() => setProfile(p.key)}
              style={{
                background: profile === p.key ? "rgba(233,238,249,0.06)" : "rgba(233,238,249,0.03)",
                color: profile === p.key ? "#fff" : S.muted,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                padding: "10px 14px",
                borderRadius: 999,
                border: `1px solid ${profile === p.key ? "rgba(255,255,255,0.16)" : S.cardB}`,
                cursor: "pointer", transition: "all 0.2s",
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {!opps ? <Loader label="Fetching opportunities..." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {opps.map((o, idx) => (
              <FadeIn key={o.area + o.profile}>
                <Card style={{ padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ color: S.accent, fontSize: 22, fontWeight: 800 }}>#{idx + 1}</span>
                        <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>{o.area}</h2>
                        <span style={{ background: "rgba(233,238,249,0.04)", border: `1px solid ${S.cardB}`, color: S.muted, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 999, textTransform: "uppercase" }}>{o.market_positioning}</span>
                      </div>
                    </div>
                    <span title="Opportunity Score: composite ranking (0-100) combining demand, reputation, growth, competition, rent, and utility factors. Higher = better investment potential."><ScoreBadge value={o.opportunity_score} size="lg" /></span>
                  </div>
                  <p style={{ color: S.muted, fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>{o.explanation}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 14 }}>
                    {[
                     
                      { l: "Demand", v: (o.demand_score * 100).toFixed(1), c: S.accent, tip: "Consumer demand level (0-100%). Measures foot traffic potential, search volume, and customer interest in this area." },
                      { l: "Competition", v: (o.competition_intensity * 100).toFixed(1), c: "rgba(233,238,249,0.88)", tip: "Market saturation (0-100%). How many cafes already compete here. Higher = harder to capture market share." },
                      { l: "Reputation", v: (o.reputation_strength * 100).toFixed(1), c: "rgba(233,238,249,0.76)", tip: "Area reputation strength (0-100%). Based on average ratings, positive review share, and sentiment analysis." },
                      { l: "Growth", v: (o.growth_momentum * 100).toFixed(1), c: "rgba(233,238,249,0.64)", tip: "Growth momentum (0-100%). Rate of new cafe openings and review velocity — indicates market expansion trend." },
                      { l: "Barrier", v: (o.barrier_to_entry * 100).toFixed(1), c: "rgba(233,238,249,0.52)", tip: "Barrier to entry (0-100%). Combines rent costs, utility expenses, and competition density. Higher = harder/costlier to enter." },
                    
                    ].map(m => (
                      <div key={m.l} style={{ background: "rgba(233,238,249,0.03)", border: `1px solid ${S.cardB}`, borderRadius: 14, padding: "10px 12px", textAlign: "center" }} title={m.tip}>
                        <p style={{ color: S.dim, fontSize: 11, marginBottom: 4 }}>{m.l}</p>
                        <p style={{ color: m.c, fontSize: 18, fontWeight: 700 }}>{m.v}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${S.cardB}` }}>
                    <div style={{ display: "flex", gap: 20 }}>
                      <span style={{ color: S.muted, fontSize: 12 }}>★ {o.avg_rating?.toFixed(1)}</span>
                      <span style={{ color: S.muted, fontSize: 12 }}>{o.total_cafes} cafés</span>
                      <span style={{ color: S.muted, fontSize: 12 }}>AED {o.avg_rent?.toFixed(0)}/sqft</span>
                    </div>
                    <SecondaryButton onClick={() => navigate("area-detail", o.area)} style={{ padding: "10px 14px", fontSize: 13, borderRadius: 999 }}>
                      View Full Analysis →
                    </SecondaryButton>
                  </div>
                </Card>
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: ALERTS (LSTM Anomaly Detection)
// ═══════════════════════════════════════════════════════════════════════════════

export default OpportunitiesPage;
