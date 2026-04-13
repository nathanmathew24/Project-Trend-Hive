import React from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Card, FadeIn, PublicNav, PrimaryButton } from "../components/ui";

function HowItWorksPage({ navigate }) {
  const steps = [
    {
      step: "01",
      icon: "⬇",
      title: "Data Ingestion",
      subtitle: "Where the data comes from",
      desc: "TrendHive aggregates data from multiple sources Google Places API, Google Trends, geospatial datasets, and commercial rent benchmarks. Over 500,000 customer reviews are collected across 24 Dubai areas and 4,200+ cafés.",
      details: ["Google Places API", "500,000+ customer reviews", "Commercial rent benchmarks", "Google Trends signals", "Geospatial coordinates"],
      color: S.accent,
    },
    {
      step: "02",
      icon: "⚙",
      title: "Feature Engineering",
      subtitle: "Turning raw data into metrics",
      desc: "Raw data is transformed into 38 domain-specific metrics purpose-built for the F&B market. This includes Popularity Score, Competition Index, Area Demand Score, Footfall Proxy, Sentiment Polarity, and more.",
      details: ["38 engineered features", "Popularity Score", "Competition Index", "Footfall Proxy", "Sentiment Polarity"],
      color: S.blue,
    },
    {
      step: "03",
      icon: "🧠",
      title: "AI & ML Models",
      subtitle: "The intelligence layer",
      desc: "Three AI models run in parallel on the engineered feature set. A Random Forest classifier predicts growth tiers with 87% accuracy. An LSTM neural network forecasts 6-month demand. A DistilGPT-2 SLM generates natural-language summaries.",
      details: ["Random Forest — 87% accuracy", "LSTM — 19.9% MAPE", "DistilGPT-2 — 82M params", "5-fold cross validation", "Monte Carlo Dropout"],
      color: S.green,
    },
    {
      step: "04",
      icon: "◈",
      title: "XAI Layer",
      subtitle: "Making AI decisions transparent",
      desc: "Every prediction is passed through our custom Explainable AI engine. SHAP values decompose each score into its contributing factors. Rule-based explainers generate human-readable reasoning for every recommendation.",
      details: ["SHAP value attribution", "4-component XAI engine", "Score decomposition", "Confidence intervals", "Factor-level breakdown"],
      color: S.purple,
    },
    {
      step: "05",
      icon: "✦",
      title: "Insights Delivered",
      subtitle: "What you actually see",
      desc: "All processed insights are delivered through a clean React dashboard area rankings, opportunity scores, demand forecasts, anomaly alerts, and the AI Copilot. Everything designed to be understood at a glance, no technical background needed.",
      details: ["Interactive dashboard", "Area opportunity rankings", "Demand forecast charts", "Market shift alerts", "AI Copilot chat interface"],
      color: S.orange,
    },
  ];

  const stats = [
    { value: "500K+", label: "Customer Reviews Processed", sub: "Across 24 Dubai areas" },
    { value: "87%",   label: "Growth Classifier Accuracy",  sub: "Random Forest, 5-fold CV" },
    { value: "19.9%", label: "Forecast Error Rate (MAPE)",  sub: "6-month demand projections" },
    { value: "4.3/5", label: "AI Explanation Satisfaction", sub: "Rated by 120 café managers" },
  ];

  return (
    <div style={{ background: S.bg, minHeight: "100vh", position: "relative" }}>
      <HoneycombBg />
      <PublicNav navigate={navigate} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(233,238,249,0.04)", border: `1px solid ${S.cardB}`, borderRadius: 999, padding: "8px 14px", marginBottom: 20, backdropFilter: "blur(12px)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: S.accent }} />
              <span style={{ color: S.muted, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>How it works</span>
            </div>
            <h1 style={{ color: "#fff", fontSize: 52, fontWeight: 800, marginBottom: 14, letterSpacing: "-0.03em" }}>
              From raw data to <span style={{ color: S.accent }}>decisions</span>.
            </h1>
            <p style={{ color: S.muted, fontSize: 18, maxWidth: 600, margin: "0 auto" }}>
              TrendHive processes over 500,000 customer reviews through a 5-layer AI pipeline to deliver insights you can act on.
            </p>
          </div>
        </FadeIn>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 64 }}>
          {steps.map((s, i) => (
            <FadeIn key={s.step} delay={i * 0.08}>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 0 }}>
                {/* Left connector */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: s.color + "18", border: `2px solid ${s.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, zIndex: 1 }}>
                    {s.icon}
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: `linear-gradient(to bottom, ${s.color}44, ${steps[i+1].color}22)`, minHeight: 40 }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ paddingBottom: i < steps.length - 1 ? 32 : 0, paddingLeft: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                    <span style={{ color: s.color, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>STEP {s.step}</span>
                  </div>
                  <Card style={{ padding: 28 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 28, alignItems: "start" }}>
                      <div>
                        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{s.title}</h2>
                        <p style={{ color: s.color, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>{s.subtitle}</p>
                        <p style={{ color: S.muted, fontSize: 14, lineHeight: 1.8 }}>{s.desc}</p>
                      </div>
                      <Card style={{ padding: 16, borderRadius: 18 }}>
                        {s.details.map(d => (
                          <div key={d} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ color: S.accent, fontSize: 9, flexShrink: 0 }}>◆</span>
                            <span style={{ color: "#cbd5e0", fontSize: 12 }}>{d}</span>
                          </div>
                        ))}
                      </Card>
                    </div>
                  </Card>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Stats */}
        <FadeIn delay={0.2}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 64 }}>
            {stats.map(stat => (
              <Card key={stat.value} style={{ padding: "28px 24px", textAlign: "center" }}>
                <div style={{ color: "#fff", fontSize: 36, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.02em" }}>{stat.value}</div>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ color: S.dim, fontSize: 12 }}>{stat.sub}</div>
              </Card>
            ))}
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.25}>
          <div style={{ textAlign: "center" }}>
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

export default HowItWorksPage;
