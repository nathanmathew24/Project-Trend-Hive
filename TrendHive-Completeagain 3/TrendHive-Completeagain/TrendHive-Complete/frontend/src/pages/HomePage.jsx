import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { S } from "../styles/theme";
import { HoneycombBg, Logo, Card, Loader, ScoreBadge, ChartTooltip, ConfidenceBadge, FadeIn, PublicNav, AppNav, PrimaryButton, SecondaryButton } from "../components/ui";

function HomePage({ navigate }) {
  return (
    <div style={{ background: S.gradHero || S.bg, minHeight: "100vh", position: "relative" }}>
      <HoneycombBg />
      <PublicNav navigate={navigate} />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: "72px 24px 88px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(233,238,249,0.04)", border: `1px solid ${S.cardB}`, borderRadius: 999, padding: "8px 14px", marginBottom: 22, backdropFilter: "blur(12px)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: S.accent }} />
              <span style={{ color: S.muted, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Market Intelligence</span>
            </div>
            <h1 style={{ color: "#fff", fontSize: 58, fontWeight: 800, lineHeight: 1.04, marginBottom: 22, letterSpacing: "-0.04em" }}>
              Invest in cafés,<br />with <span style={{ color: S.accent }}>clarity</span>.
            </h1>
            <p style={{ color: S.muted, fontSize: 18, lineHeight: 1.7, marginBottom: 40, maxWidth: 460 }}>
              Real-time area scoring, explainable AI insights, and demand forecasting for Dubai's F&B market built for investors and café owners.
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <PrimaryButton onClick={() => navigate("login")} style={{ padding: "14px 28px", fontSize: 16, borderRadius: 14 }}>
                Get Started →
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate("demo")} style={{ padding: "14px 28px", fontSize: 16, borderRadius: 14 }}>
                View Demo
              </SecondaryButton>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
  <img
    src="/src/assets/HOMEP.png"
    alt="AI Globe"
    style={{
      width: 620,
      height: 620,
      objectFit: "contain",
      filter: `drop-shadow(0 0 44px ${S.accent}18)`,
      animation: "th-float 8.5s ease-in-out infinite",
    }}
  />
</div>
        </section>

        {/* ── DIVIDER ───────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${S.cardB}, transparent)` }} />
        </div>

        {/* ── QUICK LINKS ──────────────────────────────────────────────────────── */}
        <FadeIn delay={0.1}>
          <section style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Card hoverable onClick={() => navigate("features")} style={{ padding: "40px 36px" }}>
                <div style={{ color: S.accent, fontSize: 28, marginBottom: 16 }}>✦</div>
                <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Platform Features</h2>
                <p style={{ color: S.muted, fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
                  Explore our 6 core AI capabilities — from XAI score breakdowns to the Agentic AI Copilot.
                </p>
                <span style={{ color: S.accent, fontWeight: 700, fontSize: 14 }}>View Features →</span>
              </Card>
              <Card hoverable onClick={() => navigate("how-it-works")} style={{ padding: "40px 36px" }}>
                <div style={{ color: S.accent, fontSize: 28, marginBottom: 16 }}>◎</div>
                <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, marginBottom: 10 }}>How It Works</h2>
                <p style={{ color: S.muted, fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
                  See the full 5-step AI pipeline — from raw data ingestion to insights delivered on your dashboard.
                </p>
                <span style={{ color: S.accent, fontWeight: 700, fontSize: 14 }}>View Pipeline →</span>
              </Card>
            </div>
          </section>
        </FadeIn>

        {/* ── DIVIDER ───────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${S.cardB}, transparent)` }} />
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <FadeIn delay={0.1}>
          <section style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 24px" }}>
            <Card glow style={{ padding: "56px 40px", textAlign: "center" }}>
              <h2 style={{ color: "#fff", fontSize: 38, fontWeight: 800, marginBottom: 16 }}>Ready to Make Smarter F&B Decisions?</h2>
              <p style={{ color: S.muted, fontSize: 17, marginBottom: 36 }}>
                24 Dubai areas. 349 tracked cafés. 5 investor profiles. All powered by explainable AI.
              </p>
              <PrimaryButton onClick={() => navigate("login")} style={{ padding: "16px 34px", fontSize: 17, borderRadius: 14 }}>
                Get Started Today →
              </PrimaryButton>
            </Card>
          </section>
        </FadeIn>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: `1px solid ${S.cardB}`, padding: "36px 24px", textAlign: "center" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>TrendHive</div>
          <div style={{ color: S.muted, fontSize: 13 }}>AI-Powered Market Intelligence for F&B • Dubai, UAE</div>
        </footer>

      </div>
    </div>
  );
}

export default HomePage;
