import React, { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area
} from "recharts";

import { api } from "../lib/api";
import { S } from "../styles/theme";
import { HoneycombBg, Card, Loader, ScoreBadge, ChartTooltip, FadeIn, AppNav, FinancialNavButton } from "../components/ui";

// ── Animated counter hook ────────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ── Animated KPI card ────────────────────────────────────────────────────────
function KpiCard({ icon, label, rawValue, displayValue, color, tip, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div
      title={tip}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "rgba(11,16,24,0.62)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.16)" : S.cardB}`,
        borderRadius: 22,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        padding: 22,
        cursor: "default",
        transition: "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease, opacity 400ms ease",
        transform: visible ? (hovered ? "translateY(-2px)" : "translateY(0)") : "translateY(14px)",
        opacity: visible ? 1 : 0,
        boxShadow: hovered ? S.shadowSm : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, ${S.accent}55 0%, rgba(255,255,255,0.00) 65%)`,
        opacity: hovered ? 0.9 : 0.6,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, position: "relative" }}>
        <div style={{
          background: "rgba(233,238,249,0.03)",
          borderRadius: 14,
          padding: 10,
          width: 42,
          height: 42,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${S.cardB}`,
        }}>
          {icon}
        </div>
        <span style={{ color: S.muted, fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ color: S.text, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", position: "relative" }}>
        {displayValue}
      </div>
      <div style={{ color: S.dim, fontSize: 12, marginTop: 6 }}>
        {rawValue ?? ""}
      </div>
    </div>
  );
}

// ── SVG Icons ────────────────────────────────────────────────────────────────
const IconDemand = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);
const IconCompetition = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
  </svg>
);
const IconRating = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
const IconCafe = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
  </svg>
);

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(11,16,24,0.82)", border: `1px solid ${S.cardB}`, borderRadius: 14, padding: "12px 14px", boxShadow: S.shadowSm, backdropFilter: "blur(12px)" }}>
      <p style={{ color: S.muted, fontSize: 11, marginBottom: 8 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: S.text, fontSize: 13, fontWeight: 600, margin: "3px 0" }}>
          <span style={{ color: p.color || S.accent }}>{p.name}</span>: {p.value}%
        </p>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function DashboardPage({ navigate }) {
  const [areas, setAreas] = useState(null);
  const [health, setHealth] = useState(null);
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    api("/areas").then(d => d && setAreas(d));
    api("/health").then(d => d && setHealth(d));
    setTimeout(() => setHeaderVisible(true), 100);
  }, []);

  if (!areas) return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <HoneycombBg />
      <AppNav navigate={navigate} currentPage="dashboard" />
      <FinancialNavButton navigate={navigate} currentPage="dashboard" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />
      <Loader label="Loading dashboard..." />
    </div>
  );

  const avgDemand = (areas.reduce((s, a) => s + (a.demand_score || 0), 0) / areas.length * 100).toFixed(1);
  const avgComp = (areas.reduce((s, a) => s + (a.competition_intensity || 0), 0) / areas.length * 100).toFixed(1);
  const avgRating = (areas.reduce((s, a) => s + (a.avg_rating || 0), 0) / areas.length).toFixed(2);
  const totalCafes = health?.businesses || areas.reduce((s, a) => s + (a.total_cafes || 0), 0);

  const topAreas = [...areas].sort((a, b) => (b.demand_score || 0) - (a.demand_score || 0)).slice(0, 6);
  const chartData = areas.map(a => ({
    name: a.area,
    demand: +(a.demand_score * 100).toFixed(1),
    competition: +(a.competition_intensity * 100).toFixed(1),
  })).sort((a, b) => b.demand - a.demand).slice(0, 10);

  const scatterData = areas.map(a => ({
    x: +((a.barrier_to_entry || 0) * 100).toFixed(1),
    y: +((a.demand_score || 0) * 100).toFixed(1),
    name: a.area,
  }));

  const posColors = [
    S.accent,
    "rgba(233,238,249,0.68)",
    "rgba(233,238,249,0.46)",
    "rgba(233,238,249,0.28)",
    "rgba(233,238,249,0.14)",
  ];
  const posMap = {};
  areas.forEach(a => { posMap[a.market_positioning] = (posMap[a.market_positioning] || 0) + 1; });
  const posData = Object.entries(posMap).map(([name, value]) => ({ name, value }));
  const totalAreas = areas.length;

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .area-row:hover { background: rgba(233,238,249,0.04) !important; border-color: rgba(255,255,255,0.16) !important; }
      `}</style>

      <HoneycombBg />
      <AppNav navigate={navigate} currentPage="dashboard" />
      <FinancialNavButton navigate={navigate} currentPage="dashboard" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 32px 64px", position: "relative", zIndex: 1 }}>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36,
          opacity: headerVisible ? 1 : 0, transform: headerVisible ? "translateY(0)" : "translateY(-16px)",
          transition: "all 0.5s ease",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: S.accent, boxShadow: `0 0 0 6px ${S.accent}14` }} />
              <h1 style={{ color: "#fff", fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" }}>Market Dashboard</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("ai-copilot")}
            style={{
              background: "rgba(233,238,249,0.04)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              padding: "12px 18px",
              borderRadius: 999,
              border: `1px solid ${S.cardB}`,
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = S.cardB; }}
          >
            Ask AI Copilot →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          <KpiCard icon={<IconDemand color={S.accent} />} label="Avg Demand" rawValue="Across 24 Dubai areas" displayValue={`${avgDemand}%`} color={S.accent} tip="Average consumer demand level." delay={0} />
          <KpiCard icon={<IconCompetition color={"rgba(233,238,249,0.75)"} />} label="Competition" rawValue="Saturation intensity" displayValue={`${avgComp}%`} color={S.accent} tip="Average market saturation." delay={100} />
          <KpiCard icon={<IconRating color={S.accent} />} label="Avg Rating" rawValue="Google Maps (1–5)" displayValue={avgRating} color={S.accent} tip="Mean Google Maps rating." delay={200} />
          <KpiCard icon={<IconCafe color={S.accent} />} label="Cafes Tracked" rawValue="Total in database" displayValue={totalCafes.toLocaleString()} color={S.accent} tip="Total cafes in our database." delay={300} />
        </div>

        <FadeIn delay={0.2}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 24 }}>
            <Card style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: S.accent }} />
                <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Demand vs Competition — Top 10 Areas</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke={"rgba(255,255,255,0.06)"} vertical={false} />
                  <XAxis dataKey="name" stroke="none" tick={{ fill: S.muted, fontSize: 10 }} angle={-35} textAnchor="end" height={70} />
                  <YAxis domain={[0, 100]} stroke="none" tick={{ fill: S.muted, fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: S.muted, fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="demand" name="Demand %" fill={S.accent} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="competition" name="Competition %" fill={"rgba(233,238,249,0.65)"} radius={[8, 8, 0, 0]} />             </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(233,238,249,0.55)" }} />
                <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Market Positioning Map</h3>
              </div>
              <p style={{ color: S.muted, fontSize: 11, marginBottom: 16, paddingLeft: 13 }}>Barrier to Entry vs Demand — each dot is a Dubai area</p>
              <ResponsiveContainer width="100%" height={270}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={"rgba(255,255,255,0.06)"} />
                  <XAxis dataKey="x" name="Barrier to Entry" stroke="none" tick={{ fill: S.muted, fontSize: 11 }} label={{ value: "Barrier to Entry %", position: "insideBottom", offset: -5, fill: S.muted, fontSize: 10 }} />
                  <YAxis dataKey="y" name="Demand" domain={[0, 100]} stroke="none" tick={{ fill: S.muted, fontSize: 11 }} label={{ value: "Demand %", angle: -90, position: "insideLeft", fill: S.muted, fontSize: 10 }} />
                  <Tooltip cursor={{ stroke: S.cardB }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: "rgba(11,16,24,0.82)", border: `1px solid ${S.cardB}`, borderRadius: 14, padding: "10px 12px", backdropFilter: "blur(12px)" }}>
                        <p style={{ color: S.accent, fontWeight: 700, fontSize: 13 }}>{d.name}</p>
                        <p style={{ color: S.muted, fontSize: 12 }}>Barrier: {d.x}% · Demand: {d.y}%</p>
                      </div>
                    );
                  }} />
                  <Scatter data={scatterData} fill={"rgba(233,238,249,0.22)"} stroke={S.accent} strokeWidth={1} opacity={0.95} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Card style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: S.accent }} />
                <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Top Areas by Demand</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topAreas.map((a, idx) => (
                  <div
                    key={a.area}
                    className="area-row"
                    onClick={() => navigate("area-detail", a.area)}
                    style={{
                      background: "rgba(233,238,249,0.03)", border: `1px solid ${S.cardB}`,
                      borderRadius: 12, padding: "12px 16px", cursor: "pointer",
                      transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 14,
                    }}
                  >
                    <span style={{ color: S.accent, fontSize: 12, fontWeight: 800, width: 18, textAlign: "center", opacity: 0.7 }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{a.area}</span>
                        <span style={{ background: "rgba(233,238,249,0.04)", border: `1px solid ${S.cardB}`, color: S.muted, fontSize: 10, padding: "2px 8px", borderRadius: 999 }}>{a.market_positioning}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ color: S.muted, fontSize: 11 }}>{a.total_cafes} cafes</span>
                        <span style={{ color: S.muted, fontSize: 11 }}>{a.avg_rating?.toFixed(1)} rating</span>
                        <span style={{ color: S.muted, fontSize: 11 }}>AED {a.avg_rent?.toFixed(0)}/sqft</span>
                      </div>
                    </div>
                    <ScoreBadge value={(a.demand_score || 0) * 100} />
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(233,238,249,0.55)" }} />
                <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Market Positioning Distribution</h3>
              </div>
              <p style={{ color: S.muted, fontSize: 11, marginBottom: 8, paddingLeft: 13 }}>How Dubai's {totalAreas} cafe areas are classified</p>

              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={posData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={84}
                    dataKey="value"
                    paddingAngle={4}
                  >
                    {posData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={posColors[i % posColors.length]}
                        stroke={S.bg}
                        strokeWidth={3}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} areas`, name]}
                    contentStyle={{
                      background: "#1a1d2e",
                      border: `1px solid ${S.accent}44`,
                      borderRadius: 10,
                      fontSize: 12,
                      color: "#fff",
                      padding: "10px 14px",
                    }}
                    labelStyle={{ color: "#fff", fontWeight: 700 }}
                    itemStyle={{ color: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {posData.map((p, i) => {
                  const pct = ((p.value / totalAreas) * 100).toFixed(0);
                  const color = posColors[i % posColors.length];
                  return (
                    <div key={p.name} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", borderRadius: 10,
                      background: "rgba(233,238,249,0.03)", border: `1px solid ${S.cardB}`,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ width: 3, height: 28, borderRadius: 4, background: color, flexShrink: 0 }} />
                      <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, flex: 1 }}>{p.name}</span>
                      <span style={{ color: S.muted, fontSize: 11 }}>{p.value} area{p.value !== 1 ? "s" : ""}</span>
                      <span style={{ background: "rgba(233,238,249,0.04)", border: `1px solid ${S.cardB}`, color: S.muted, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999 }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

export default DashboardPage;