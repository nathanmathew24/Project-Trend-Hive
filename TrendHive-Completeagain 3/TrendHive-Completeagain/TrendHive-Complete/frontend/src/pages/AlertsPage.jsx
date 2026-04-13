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

function AlertsPage({ navigate }) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      const areas = await api("/areas");
      if (!areas) { setLoading(false); return; }
      // Fetch anomalies for top 5 areas by demand
      const top5 = [...areas].sort((a, b) => (b.demand_score || 0) - (a.demand_score || 0)).slice(0, 5);
      const results = [];
      for (const a of top5) {
        const anomaly = await api(`/forecast/anomaly/${encodeURIComponent(a.area)}`);
        if (anomaly) results.push({ area: a.area, ...anomaly });
      }
      setAlerts(results);
      setLoading(false);
    };
    fetchAlerts();
  }, []);

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <HoneycombBg /><AppNav navigate={navigate} currentPage="alerts" />
      <FinancialNavButton navigate={navigate} currentPage="alerts" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 32, position: "relative", zIndex: 1 }}>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Market Alerts</h1>
<p style={{ color: S.muted, fontSize: 14, marginBottom: 28 }}>Real-time monitoring of demand shifts and unusual activity across Dubai's café market</p>

        {loading ? <Loader label="Running anomaly detection on top areas..." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {alerts?.map((a, i) => (
              <FadeIn key={a.area}>
                <Card style={{ padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ color: S.accent, fontSize: 16 }}>◈</span>
                    <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: 0 }}>{a.area}</h3>
                    <span style={{ background: (a.anomalies?.length || 0) > 0 ? S.red + "22" : S.green + "22", color: (a.anomalies?.length || 0) > 0 ? S.red : S.green, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4 }}>
                      {(a.anomalies?.length || 0) > 0 ? `${a.anomalies.length} ANOMALIES` : "NORMAL"}
                    </span>
                  </div>
                  {a.anomalies?.length > 0 ? a.anomalies.slice(0, 3).map((an, j) => (
                    <div key={j} style={{ background: "#1c1017", border: `1px solid ${S.red}22`, borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: S.red, fontSize: 13, fontWeight: 600 }}>Severity: {an.severity || "MEDIUM"}</span>
                        <span style={{ color: S.dim, fontSize: 12 }}>Period {an.period || j}</span>
                      </div>
                      {an.alert_narrative && <p style={{ color: "#cbd5e0", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{an.alert_narrative}</p>}
                    </div>
                  )) : (
                    <p style={{ color: S.muted, fontSize: 13 }}>No anomalies detected — demand patterns are within expected range.</p>
                  )}
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
// PAGE: CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export default AlertsPage;
