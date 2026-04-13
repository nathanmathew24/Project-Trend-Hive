import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from "recharts";

import { api } from "../lib/api";
import { S } from "../styles/theme";
import { HoneycombBg, Card, Loader, ChartTooltip, FadeIn, AppNav, FinancialNavButton } from "../components/ui";

const CUISINE_ICONS = {
  cafe:     "☕",
  arabic:   "🥙",
  dessert:  "🍰",
  french:   "🥐",
  indian:   "🍛",
  japanese: "🍱",
  lebanese: "🫔",
  turkish:  "🍢",
  unknown:  "🍽️",
};

const CUISINE_LABELS = {
  cafe:     "Café",
  arabic:   "Arabic",
  dessert:  "Dessert & Sweets",
  french:   "French",
  indian:   "Indian",
  japanese: "Japanese",
  lebanese: "Lebanese",
  turkish:  "Turkish",
  unknown:  "Other / Unclassified",
};

const BAR_COLORS = [
  S.accent, S.blue, S.green, S.purple,
  S.red, S.orange, "rgba(217,179,95,0.55)", "rgba(233,238,249,0.55)", "rgba(74,222,128,0.75)"
];

function CategoriesPage({ navigate }) {
  const [cats, setCats] = useState(null);
  useEffect(() => { api("/categories").then(d => d && setCats(d)); }, []);

  const totalCafes = cats ? cats.reduce((s, c) => s + (c.count || 0), 0) : 0;

  const chartData = cats
    ? cats
        .map((c, i) => ({
          name: CUISINE_LABELS[c.cuisine] || c.cuisine,
          share: +(c.market_share * 100).toFixed(1),
          count: c.count,
          color: BAR_COLORS[i % BAR_COLORS.length],
        }))
        .sort((a, b) => b.share - a.share)
    : [];

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <HoneycombBg /><AppNav navigate={navigate} currentPage="categories" />
      <FinancialNavButton navigate={navigate} currentPage="categories" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 32, position: "relative", zIndex: 1 }}>

        {/* Header */}
        <h1 style={{ color: "#fff", fontSize: 36, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.03em" }}>Cuisine & Category Analytics</h1>
        <p style={{ color: S.muted, fontSize: 14, marginBottom: 20 }}>
          Market breakdown by cuisine type across Dubai's café sector
        </p>

        {/* Context banner */}
        <Card style={{ padding: "14px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: S.accent, fontSize: 20 }}>ℹ</span>
          <div>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
              Based on {totalCafes} fully-analysed cafés with complete feature data
            </p>
            <p style={{ color: S.muted, fontSize: 12 }}>
              Cuisine classification is available for our ML-analysed dataset. The broader 4,223-café market is tracked at area level — cuisine tagging for the full market is planned for a future release.
            </p>
          </div>
        </Card>

        {!cats ? <Loader /> : (
          <>
            {/* Market Share Bar Chart */}
            <FadeIn>
              <Card style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Market Share by Cuisine Type</h3>
                <p style={{ color: S.dim, fontSize: 12, marginBottom: 20 }}>Percentage of total cafés in each cuisine category</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke={S.dim} tick={{ fill: S.muted, fontSize: 12 }} />
                    <YAxis stroke={S.dim} tick={{ fill: S.muted, fontSize: 12 }} unit="%" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: "rgba(11,16,24,0.82)", border: `1px solid ${S.cardB}`, borderRadius: 14, padding: "10px 12px", boxShadow: S.shadowSm, backdropFilter: "blur(12px)" }}>
                            <p style={{ color: "#fff", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{d.name}</p>
                            <p style={{ color: S.muted, fontSize: 12 }}>Market Share: {d.share}%</p>
                            <p style={{ color: S.muted, fontSize: 12 }}>Cafés: {d.count}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="share" name="Market Share %" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </FadeIn>

            {/* Category Cards */}
            <FadeIn delay={0.1}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {cats.map((c, i) => {
                  const label = CUISINE_LABELS[c.cuisine] || c.cuisine;
                  const icon = CUISINE_ICONS[c.cuisine] || "🍽️";
                  const color = BAR_COLORS[i % BAR_COLORS.length];
                  const shareVal = (c.market_share * 100).toFixed(1);
                  return (
                    <Card key={c.cuisine} style={{ padding: 20 }}>
                      {/* Card header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 22 }}>{icon}</span>
                          <div>
                            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>{label}</h3>
                            <p style={{ color: S.dim, fontSize: 11, marginTop: 2 }}>{c.count} cafés</p>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: color, fontWeight: 800, fontSize: 20 }}>{shareVal}%</div>
                          <div style={{ color: S.dim, fontSize: 10 }}>market share</div>
                        </div>
                      </div>

                      {/* Market share bar */}
                      <div style={{ background: "#0f172a", borderRadius: 4, height: 4, marginBottom: 14, overflow: "hidden" }}>
                        <div style={{ background: color, height: "100%", width: `${Math.min(parseFloat(shareVal), 100)}%`, borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>

                      {/* Stats grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { l: "Avg Rating",    v: c.avg_rating?.toFixed(2) },
                          { l: "Avg Reviews",   v: Math.round(c.avg_reviews)?.toLocaleString() },
                          { l: "Sentiment",     v: c.avg_sentiment?.toFixed(3) },
                          { l: "Areas Present", v: c.num_areas },
                          { l: "% Premium",     v: `${(c.pct_premium * 100).toFixed(0)}%` },
                          { l: "Avg Competitors", v: c.avg_competitors?.toFixed(0) },
                        ].map(m => (
                          <div key={m.l} style={{ background: "#0f172a", borderRadius: 6, padding: "8px 10px" }}>
                            <p style={{ color: S.dim, fontSize: 10, marginBottom: 2 }}>{m.l}</p>
                            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{m.v ?? "—"}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </FadeIn>
          </>
        )}
      </div>
    </div>
  );
}

export default CategoriesPage;
