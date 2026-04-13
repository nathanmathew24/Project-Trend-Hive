import React, { useState, useEffect } from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Card, PublicNav, PrimaryButton, SecondaryButton } from "../components/ui";

const fakeAreas = [
  { area: "Downtown Dubai", demand_score: 0.80 },
  { area: "DIFC",           demand_score: 0.75 },
  { area: "JBR",            demand_score: 0.70 },
  { area: "Dubai Marina",   demand_score: 0.65 },
  { area: "Business Bay",   demand_score: 0.60 },
  { area: "City Walk",      demand_score: 0.55 },
];

function DemoPage({ navigate }) {
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/areas")
      .then(r => r.json())
      .then(d => setAreas(d.slice(0, 6)))
      .catch(() => {});
  }, []);

  const displayAreas = areas.length > 0 ? areas.slice(0, 6) : fakeAreas;
  const blurStyle    = { filter: "blur(5px)", pointerEvents: "none", userSelect: "none" };

  return (
    <div style={{ background: S.bg, minHeight: "100vh", position: "relative" }}>
      <HoneycombBg />
      <PublicNav navigate={navigate} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px", position: "relative", zIndex: 1 }}>
        <h1 style={{ color: "#fff", fontSize: 40, fontWeight: 800, textAlign: "center", marginBottom: 8, letterSpacing: "-0.03em" }}>
          Platform Preview
        </h1>
        <p style={{ color: S.muted, textAlign: "center", fontSize: 15, marginBottom: 32 }}>
          A glimpse of TrendHive market intelligence
        </p>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { l: "Areas Tracked",    v: "24"  },
            { l: "Cafes Analyzed",   v: "349" },
            { l: "AI Models",        v: "4"   },
            { l: "Investor Profiles",v: "5"   },
          ].map(k => (
            <Card key={k.l} style={{ padding: 20, textAlign: "center" }}>
              <div style={{ color: S.accent, fontSize: 28, fontWeight: 800 }}>{k.v}</div>
              <div style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>{k.l}</div>
            </Card>
          ))}
        </div>

        {/* Blurred preview + lock overlay */}
        <div style={{ position: "relative" }}>
          <div style={blurStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {displayAreas.map(a => (
                <Card key={a.area} style={{ padding: 20 }}>
                  <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{a.area}</h3>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: S.muted, fontSize: 13 }}>Demand Score</span>
                    <span style={{ color: S.accent, fontWeight: 700 }}>
                      {((a.demand_score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ background: "rgba(233,238,249,0.10)", borderRadius: 999, height: 6, marginTop: 8 }}>
                    <div style={{ background: S.accent, borderRadius: 999, height: 6, width: ((a.demand_score || 0) * 100) + "%" }} />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Lock overlay */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(8,12,20,0.55)",
          }}>
            <Card style={{ padding: 40, textAlign: "center", maxWidth: 380, backdropFilter: "blur(2px)" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                Sign In for Full Access
              </h2>
              <p style={{ color: S.muted, fontSize: 14, marginBottom: 24 }}>
                Unlock all 24 areas, XAI explanations, LSTM forecasts, and the full AI Copilot.
              </p>
              <PrimaryButton onClick={() => navigate("login")} style={{ width: "100%", padding: 13, fontSize: 15, borderRadius: 14, marginBottom: 10 }}>
                Sign In →
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate("signup")} style={{ width: "100%", padding: 12, fontSize: 14, borderRadius: 14 }}>
                Create Free Account
              </SecondaryButton>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemoPage;
