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
import { HoneycombBg, Logo, Card, Loader, ScoreBadge, ChartTooltip, ConfidenceBadge, FadeIn, PublicNav, AppNav, FinancialNavButton } from "../components/ui";

function AreaDetailPage({ navigate, areaId }) {
  const [area, setArea] = useState(null);
  const [xai, setXai] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [narrative, setNarrative] = useState(null);

  useEffect(() => {
    if (!areaId) return;
    api(`/areas/${encodeURIComponent(areaId)}`).then(d => d && setArea(d));
    api(`/explain/area/${encodeURIComponent(areaId)}`).then(d => d && setXai(d));
    api(`/forecast/area/${encodeURIComponent(areaId)}?horizon=6`).then(d => d && setForecast(d));
    api(`/narrative/area/${encodeURIComponent(areaId)}`).then(d => d && setNarrative(d));
  }, [areaId]);

  if (!area) return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <HoneycombBg />
      <AppNav navigate={navigate} currentPage="area-detail" />
      <FinancialNavButton navigate={navigate} currentPage="area-detail" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />
      <Loader label={`Loading ${areaId}...`} />
    </div>
  );

  const scores = [
    { label: "Demand", key: "demand_score", color: S.accent, tip: "Consumer demand level (0-100%). Measures foot traffic potential, search interest, and customer appetite in this area." },
    { label: "Competition", key: "competition_intensity", color: S.blue, tip: "Market saturation (0-100%). Number of existing cafes competing for the same customers. Higher = more crowded market." },
    { label: "Reputation", key: "reputation_strength", color: S.green, tip: "Area reputation strength (0-100%). Based on average ratings, positive review share, and sentiment analysis of 16K+ reviews." },
    { label: "Growth", key: "growth_momentum", color: S.purple, tip: "Growth momentum (0-100%). Rate of new cafe openings and review velocity — indicates whether the market is expanding." },
    { label: "Barrier", key: "barrier_to_entry", color: S.red, tip: "Barrier to entry (0-100%). Combines commercial rent, utility costs, and competition density. Higher = costlier to start." },
  ];

  const radarData = scores.map(s => ({ metric: s.label, value: Math.round((area[s.key] || 0) * 100) }));
  const businesses = area.businesses || [];

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <HoneycombBg /><AppNav navigate={navigate} currentPage="area-detail" />
      <FinancialNavButton navigate={navigate} currentPage="area-detail" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 32, position: "relative", zIndex: 1 }}>
        <button onClick={() => navigate("opportunities")} style={{ background: "none", border: "none", color: S.muted, fontSize: 13, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>← Back to Opportunities</button>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <span style={{ color: S.accent, fontSize: 28 }}>◈</span>
          <h1 style={{ color: "#fff", fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em" }}>{area.area}</h1>
          <span style={{ background: "rgba(233,238,249,0.04)", border: `1px solid ${S.cardB}`, color: S.muted, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", padding: "4px 12px", borderRadius: 999, textTransform: "uppercase" }}>{area.market_positioning}</span>
        </div>

        {/* SLM Narrative */}
        {narrative?.narrative && (
          <FadeIn>
            <Card style={{ padding: "16px 20px", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: S.accent }} />
                <span style={{ color: S.muted, fontWeight: 800, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Summary</span>
              </div>
              <p style={{ color: "#cbd5e0", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{narrative.narrative}</p>
            </Card>
          </FadeIn>
        )}

        {/* Score Cards */}
        <FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
            {scores.map(s => (
              <Card key={s.key} hoverable style={{ padding: 20, textAlign: "center" }} title={s.tip}>
                <p style={{ color: S.muted, fontSize: 12, marginBottom: 8 }}>{s.label}</p>
                <p style={{ color: s.color, fontSize: 34, fontWeight: 800, marginBottom: 4 }}>{((area[s.key] || 0) * 100).toFixed(1)}</p>
                <p style={{ color: S.dim, fontSize: 11 }}>/ 100</p>
              </Card>
            ))}
          </div>
        </FadeIn>

        {/* Radar + XAI Decomposition */}
        <FadeIn delay={0.1}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            <Card style={{ padding: 24 }}>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Performance Radar</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: S.muted, fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: S.dim, fontSize: 10 }} />
                  <Radar name="Score" dataKey="value" stroke={S.accent} fill={S.accent} fillOpacity={0.3} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card style={{ padding: 24 }}>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>XAI — Demand Score Decomposition</h3>
              {xai?.decompositions?.demand ? (() => {
                const d = xai.decompositions.demand;
                const factors = Object.entries(d.factors || {}).map(([k, v]) => ({ name: k, pct: v.pct_of_score, weight: v.weight, raw: v.raw_value, contribution: v.contribution }));
                return (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      {factors.map(f => (
                        <div key={f.name} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ color: "#cbd5e0", fontSize: 13 }}>{f.name}</span>
                            <span style={{ color: S.accent, fontSize: 13, fontWeight: 600 }}>{f.pct?.toFixed(1)}%</span>
                          </div>
                          <div style={{ background: "rgba(233,238,249,0.10)", borderRadius: 999, height: 6, overflow: "hidden" }}>
                            <div style={{ background: S.accent, height: "100%", width: `${Math.min(f.pct || 0, 100)}%`, borderRadius: 999, transition: "width 0.6s ease" }}/>
                          </div>
                          <div style={{ color: S.dim, fontSize: 11, marginTop: 2 }}>Weight: {(f.weight * 100).toFixed(0)}% • Raw: {f.raw?.toFixed(1)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ color: S.green, fontSize: 12, fontWeight: 600 }}>Top Driver: {d.top_driver}</div>
                    {d.confidence && <div style={{ marginTop: 8 }}><ConfidenceBadge level={d.confidence?.overall_level} /></div>}
                  </>
                );
              })() : <p style={{ color: S.dim, fontSize: 13 }}>XAI data not available</p>}
            </Card>
          </div>
        </FadeIn>

        {/* Forecast */}
        {forecast?.forecast && (
          <FadeIn delay={0.15}>
            <Card style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>LSTM Demand Forecast — {forecast.horizon || 6} Period Ahead</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={forecast.forecast.map((f, i) => ({ period: `T+${i + 1}`, predicted: +f.predicted?.toFixed(2), lower: +f.lower_bound?.toFixed(2), upper: +f.upper_bound?.toFixed(2) }))}>
                  <defs>
                    <linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={S.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={S.accent} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" stroke={S.dim} tick={{ fill: S.muted, fontSize: 12 }} />
                  <YAxis stroke={S.dim} tick={{ fill: S.muted, fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="upper" stroke="none" fill={S.blue} fillOpacity={0.1} />
                  <Area type="monotone" dataKey="lower" stroke="none" fill={S.blue} fillOpacity={0.1} />
                  <Area type="monotone" dataKey="predicted" stroke={S.accent} strokeWidth={2.5} fill="url(#fGrad)" dot={{ r: 4, fill: S.accent }} />
                </AreaChart>
              </ResponsiveContainer>
              {forecast.narrative && <p style={{ color: S.muted, fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>✦ {forecast.narrative}</p>}
              <div style={{ color: S.dim, fontSize: 11, marginTop: 8 }}>⚠ Proxy estimate — forecasts derived from synthesized demand history, not actual transaction data.</div>
            </Card>
          </FadeIn>
        )}

        {/* Strengths & Risks */}
        <FadeIn delay={0.2}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            <Card style={{ padding: 24 }}>
              <h3 style={{ color: S.green, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>✓ Strengths</h3>
              {(area.strengths || "").split(";").filter(Boolean).map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: S.green, marginTop: 3, fontSize: 8 }}>●</span>
                  <span style={{ color: "#cbd5e0", fontSize: 14, lineHeight: 1.5 }}>{s.trim()}</span>
                </div>
              ))}
            </Card>
            <Card style={{ padding: 24 }}>
              <h3 style={{ color: S.red, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>⚠ Risks</h3>
              {(area.risks || "").split(";").filter(Boolean).map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: S.red, marginTop: 3, fontSize: 8 }}>●</span>
                  <span style={{ color: "#cbd5e0", fontSize: 14, lineHeight: 1.5 }}>{r.trim()}</span>
                </div>
              ))}
            </Card>
          </div>
        </FadeIn>

        {/* Competitors / Businesses in Area */}
        {businesses.length > 0 && (
          <FadeIn delay={0.25}>
            <Card style={{ padding: 24 }}>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Businesses in Area ({businesses.length})</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {businesses.slice(0, 8).map((b, i) => (
                  <div key={i} style={{ background: "#0f172a", border: `1px solid ${S.cardB}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{b.Name}</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ color: S.muted, fontSize: 12 }}>★ {b.Rating}</span>
                        <span style={{ color: S.dim, fontSize: 12 }}>{b.Reviews?.toLocaleString()} reviews</span>
                      </div>
                    </div>
                    <span style={{ color: S.accent, fontWeight: 600, fontSize: 13 }}>{b.sentiment_mean?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </FadeIn>
        )}

        {/* Metric Details Table */}
        <FadeIn delay={0.3}>
          <Card style={{ padding: 24, marginTop: 24 }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Full Area Metrics</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { l: "Total Cafés", v: area.total_cafes, tip: "Number of cafes in this area from our 4,200+ cafe database." },
                { l: "Avg Rating", v: area.avg_rating?.toFixed(2), tip: "Mean Google Maps rating (1-5 stars) for cafes in this area." },
                { l: "Total Reviews", v: area.total_reviews?.toLocaleString(), tip: "Sum of all Google reviews across cafes in this area." },
                { l: "Avg Rent (AED/sqft/yr)", v: area.avg_rent?.toFixed(0), tip: "Average commercial rent cost in AED per square foot per year for this area." },
                { l: "Avg Utility Cost", v: `AED ${area.avg_utility_cost?.toFixed(0)}/mo`, tip: "Average monthly utility cost (electricity, water, cooling) in AED for cafe-sized premises." },
                { l: "Tourist Index", v: area.avg_tourist_index?.toFixed(1), tip: "Relative tourist foot traffic index. Higher = more tourist activity (hotels, attractions nearby)." },
                { l: "Avg Footfall", v: area.avg_footfall?.toFixed(1), tip: "Estimated average daily pedestrian foot traffic score for this area." },
                { l: "Pop Density", v: area.avg_pop_density?.toFixed(0), tip: "Population density estimate (people per sq km) — indicates resident customer base size." },
                { l: "Avg Sentiment", v: area.avg_sentiment?.toFixed(3), tip: "Average TextBlob polarity score (-1 to +1) from 16K+ customer reviews. Positive = favorable opinions." },
                { l: "Positive %", v: `${((area.avg_positive_ratio || 0) * 100).toFixed(1)}%`, tip: "Percentage of reviews with positive sentiment (polarity > 0.1) from NLP analysis." },
                { l: "% Growing", v: `${((area.pct_growing || 0) * 100).toFixed(0)}%`, tip: "Percentage of cafes classified as 'GROWING' by the Random Forest growth classifier." },
                { l: "Saturation Index", v: area.saturation_index?.toFixed(2), tip: "Market saturation measure (cafes per unit area). Higher = more competitive, less room for new entrants." },
              ].map(m => (
                <div key={m.l} style={{ background: "#0f172a", border: `1px solid ${S.cardB}`, borderRadius: 8, padding: "12px 14px" }} title={m.tip}>
                  <p style={{ color: S.dim, fontSize: 11, marginBottom: 4 }}>{m.l}</p>
                  <p style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{m.v ?? "—"}</p>
                </div>
              ))}
            </div>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: OPPORTUNITIES
// ═══════════════════════════════════════════════════════════════════════════════

export default AreaDetailPage;
