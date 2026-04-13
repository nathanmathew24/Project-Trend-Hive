import React from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Card, PublicNav, PrimaryButton } from "../components/ui";

function AboutPage({ navigate }) {
  const team = [
    { name: "Nathan Mathew",  id: "8183284", photo: "/team/NATHAN.jpg"    },
    { name: "Inara Fatima",   id: "8450560", photo: "/team/INARA.jpeg"    },
    { name: "Arya Sunil",     id: "8248497", photo: "/team/ARIA.jpeg"     },
    { name: "Arvinder Singh", id: "8374879", photo: "/team/ARVINDER.jpeg" },
    { name: "Asil Habib",     id: "8392201", photo: "/team/ASIL.png"      },
    { name: "Asrar Ahmed",    id: "7068311", photo: "/team/ASRAR.jpeg"    },
  ];

  const techs = [
    { cat: "Machine Learning",  items: "Random Forest, SHAP, Growth Classifier" },
    { cat: "Deep Learning",     items: "LSTM Neural Networks, Monte Carlo Dropout" },
    { cat: "Explainable AI",    items: "Multi-dimensional XAI Engine, Confidence Scoring" },
    { cat: "NLP / SLM",         items: "DistilGPT-2, Template-Conditioned Generation" },
    { cat: "Agentic AI",        items: "Autonomous Planning, Multi-Tool Execution, LLM-Powered" },
    { cat: "Backend",           items: "Python, FastAPI, Pandas, Scikit-learn" },
    { cat: "Frontend",          items: "React, Recharts, Vite" },
    { cat: "Data",              items: "349 Cafes, 24 Areas, 9 Cuisines, Google Trends" },
  ];

  return (
    <div style={{ background: S.bg, minHeight: "100vh", position: "relative" }}>
      <HoneycombBg />
      <PublicNav navigate={navigate} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px", position: "relative", zIndex: 1 }}>

        {/* Hero */}
        <p style={{ color: S.muted, fontSize: 12, fontWeight: 700, letterSpacing: "0.22em", textAlign: "center", marginBottom: 12, textTransform: "uppercase" }}>
          TEAM GRANDE
        </p>
        <h1 style={{ color: "#fff", fontSize: 44, fontWeight: 800, textAlign: "center", marginBottom: 10, letterSpacing: "-0.03em" }}>
          The <span style={{ color: S.accent }}>hive mind</span> behind TrendHive
        </h1>
        <p style={{ color: S.muted, textAlign: "center", fontSize: 15, marginBottom: 48 }}>
          CSIT321 — University of Wollongong in Dubai, AUT'25
        </p>

        {/* Team Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 64 }}>
          {team.map(m => (
            <Card key={m.id} hoverable style={{ padding: 28, textAlign: "center" }}>
              <div style={{
                width: 100, height: 100, borderRadius: "50%",
                overflow: "hidden", margin: "0 auto 16px",
                border: `3px solid ${S.accent}44`,
              }}>
                <img
                  src={m.photo}
                  alt={m.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                />
              </div>
              <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{m.name}</h3>
              <p style={{ color: S.dim, fontSize: 13, margin: 0 }}>{m.id}</p>
            </Card>
          ))}
        </div>

        {/* About text */}
        <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>
          About TrendHive
        </h2>
        <p style={{ color: S.muted, textAlign: "center", fontSize: 15, lineHeight: 1.8, maxWidth: 720, margin: "0 auto 40px" }}>
          TrendHive is an AI-powered market intelligence platform built to help investors, entrepreneurs, and F&B operators
          make data-driven decisions in Dubai's competitive cafe landscape. By combining explainable AI, deep learning
          forecasting, and autonomous agentic systems, TrendHive transforms raw market data into actionable insights.
        </p>

        {/* Tech Stack */}
        <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, textAlign: "center", marginBottom: 24 }}>
          Technology Stack
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 48 }}>
          {techs.map(t => (
            <Card key={t.cat} style={{ padding: 20 }}>
              <h4 style={{ color: S.accent, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t.cat}</h4>
              <p style={{ color: S.muted, fontSize: 12, lineHeight: 1.6, margin: 0 }}>{t.items}</p>
            </Card>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <PrimaryButton onClick={() => navigate("home")} style={{ padding: "14px 26px", borderRadius: 999 }}>
            Back to Home →
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
