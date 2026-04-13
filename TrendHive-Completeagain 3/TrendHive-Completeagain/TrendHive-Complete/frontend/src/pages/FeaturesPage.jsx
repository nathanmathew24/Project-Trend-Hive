import React from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Card, FadeIn, PublicNav, PrimaryButton } from "../components/ui";

function FeaturesPage({ navigate }) {
  const features = [
    {
      icon: "◈",
      title: "Score Breakdown & Explanation",
      subtitle: "XAI Score Decomposition",
      desc: "Every area score is broken down factor by factor demand, competition, reputation, growth. You see exactly what's driving the number, not just the number itself. Powered by SHAP values so every prediction traces back to real data.",
      details: ["Demand score decomposition", "Competition intensity analysis", "Reputation strength index", "SHAP-based factor attribution"],
      color: S.accent,
    },
    {
      icon: "◎",
      title: "6-Month Demand Forecasting",
      subtitle: "LSTM Time-Series Forecasting",
      desc: "Know where demand is heading before it gets there. Our 2-layer LSTM neural network projects area demand 6 months ahead with 90% confidence intervals so you understand both the forecast and the uncertainty around it.",
      details: ["2-layer LSTM architecture", "Monte Carlo Dropout for uncertainty", "90% confidence intervals", "6-month forward projection"],
      color: S.blue,
    },
    {
      icon: "▦",
      title: "Personalised Investment Rankings",
      subtitle: "Investor Profile Matching",
      desc: "Choose your investor type and get a ranking built specifically for your goals. Five distinct profiles with custom weighted scoring no generic one-size-fits-all list.",
      details: ["Balanced Investor", "Budget-Cautious", "Growth Hunter", "Premium Concept", "Tourist-Focused"],
      color: S.green,
    },
    {
      icon: "△",
      title: "Market Shift Alerts",
      subtitle: "Anomaly Detection",
      desc: "Get notified when an area's demand pattern moves outside its normal range. Spot emerging opportunities and warning signs before they become obvious to competitors.",
      details: ["Real-time anomaly monitoring", "24 area coverage", "Demand signal tracking", "Early warning system"],
      color: S.purple,
    },
    {
      icon: "✦",
      title: "Plain-English Area Summaries",
      subtitle: "AI Narrative Engine (SLM)",
      desc: "Every area and opportunity comes with a written summary in plain language no jargon, no spreadsheets. DistilGPT-2 (82M parameters) generates natural-language insights from every score.",
      details: ["DistilGPT-2 language model", "82M parameter SLM", "Template-conditioned generation", "Plain-English output"],
      color: S.orange,
    },
    {
      icon: "⊙",
      title: "Ask Anything About the Market",
      subtitle: "Agentic AI Copilot",
      desc: "Type a question about any Dubai area and get a complete, data-backed answer. Our autonomous AI agent plans, executes multiple tool calls, and reflects to deliver comprehensive market analysis in seconds.",
      details: ["Plan → Execute → Reflect loop", "12 integrated tools", "GPT-4o-mini / Claude backbone", "Multi-step reasoning"],
      color: S.accent,
    },
  ];

  return (
    <div style={{ background: S.bg, minHeight: "100vh", position: "relative" }}>
      <HoneycombBg />
      <PublicNav navigate={navigate} />
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 24px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(233,238,249,0.04)", border: `1px solid ${S.cardB}`, borderRadius: 999, padding: "8px 14px", marginBottom: 20, backdropFilter: "blur(12px)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: S.accent }} />
              <span style={{ color: S.muted, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Platform Features</span>
            </div>
            <h1 style={{ color: "#fff", fontSize: 52, fontWeight: 800, marginBottom: 14, letterSpacing: "-0.03em" }}>
              What <span style={{ color: S.accent }}>TrendHive</span> ships.
            </h1>
            <p style={{ color: S.muted, fontSize: 18, maxWidth: 600, margin: "0 auto" }}>
              Everything you need to make confident investment decisions in Dubai's café market no data science background required.
            </p>
          </div>
        </FadeIn>

        {/* Feature Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.05}>
              <Card style={{ padding: 40 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 40, alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                      <div style={{ background: "rgba(233,238,249,0.03)", border: `1px solid ${S.cardB}`, borderRadius: 14, width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: S.accent, flexShrink: 0 }}>
                        {f.icon}
                      </div>
                      <div>
                        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{f.title}</h2>
                        <p style={{ color: S.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{f.subtitle}</p>
                      </div>
                    </div>
                    <p style={{ color: S.muted, fontSize: 15, lineHeight: 1.8 }}>{f.desc}</p>
                  </div>
                  <Card style={{ padding: 20, borderRadius: 18 }}>
                    <p style={{ color: S.dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Key Details</p>
                    {f.details.map(d => (
                      <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ color: S.accent, fontSize: 10, flexShrink: 0 }}>◆</span>
                        <span style={{ color: "#cbd5e0", fontSize: 13 }}>{d}</span>
                      </div>
                    ))}
                  </Card>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>

        {/* CTA */}
        <FadeIn delay={0.2}>
          <div style={{ textAlign: "center", marginTop: 64 }}>
            <PrimaryButton onClick={() => navigate("login")} style={{ padding: "14px 26px", fontSize: 15, borderRadius: 999 }}>
              Get Started Today →
            </PrimaryButton>
          </div>
        </FadeIn>

      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${S.cardB}`, padding: "36px 24px", textAlign: "center" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>TrendHive</div>
        <div style={{ color: S.muted, fontSize: 13 }}>AI-Powered Market Intelligence for F&B • Dubai, UAE</div>
      </footer>
    </div>
  );
}

export default FeaturesPage;
