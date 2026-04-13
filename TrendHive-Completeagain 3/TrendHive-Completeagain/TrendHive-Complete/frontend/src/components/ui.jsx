import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { S } from "../styles/theme";

// ─── HONEYCOMB BG ────────────────────────────────────────────────────────────
function HoneycombBg() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      {/* Minimal editorial gradient */}
      <div style={{ position: "absolute", inset: 0, background: S.gradHero }} />

      {/* Very subtle floating tint (kept minimal) */}
      <div style={{ position: "absolute", left: "-18%", top: "12%", width: 640, height: 640, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${S.accent}12 0%, transparent 62%)`, opacity: 0.45, animation: "th-float 14s ease-in-out infinite" }} />

      {/* Subtle noise (premium grain) */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.055, mixBlendMode: "soft-light" }}>
        <filter id="th-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            0 0 0 0.20 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#th-noise)" />
      </svg>

      <svg width="100%" height="100%" style={{ opacity: 0.025, position: "relative" }}>
        <defs>
          <pattern id="hx" x="0" y="0" width="56" height="49" patternUnits="userSpaceOnUse">
            <polygon points="14,0 42,0 56,24.5 42,49 14,49 0,24.5" fill="none" stroke={S.accent} strokeWidth="0.55" opacity="0.16" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hx)"/>
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(900px 480px at 85% 0%, rgba(255,255,255,0.05) 0%, transparent 60%)" }} />
    </div>
  );
}

// ─── LOGO ────────────────────────────────────────────────────────────────────

function Logo({ size = 32 }) {
  return (
    <img src="/logo.png" alt="TrendHive logo" style={{ width: size, height: size, objectFit: "contain" }} />
  );
}

// ─── REUSABLE: Card ──────────────────────────────────────────────────────────

function Card({ children, style = {}, onClick, hoverable = false, glow = false, title }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} title={title}
      onMouseEnter={() => hoverable && setH(true)}
      onMouseLeave={() => hoverable && setH(false)}
      style={{
        background: "rgba(11,16,24,0.62)",
        border: `1px solid ${h ? "rgba(255,255,255,0.16)" : S.cardB}`,
        borderRadius: 22,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        transition: "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease, background 220ms ease",
        transform: h ? "translateY(-2px)" : "none",
        boxShadow: h ? S.shadowMd : glow ? S.shadowSm : "none",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}>
      {/* Hairline highlight */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(120% 140% at 12% 0%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.00) 55%)", opacity: h ? 0.9 : 0.65, transition: "opacity 220ms ease" }} />
      <div style={{ position: "relative", width: "100%", flex: 1 }}>
      {children}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled = false, style = {}, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(233,238,249,0.10)" : S.accent,
        color: disabled ? "rgba(233,238,249,0.55)" : "#0B1018",
        fontWeight: 800,
        fontSize: 15,
        padding: "12px 18px",
        borderRadius: 12,
        border: disabled ? `1px solid ${S.cardB}` : `1px solid rgba(255,255,255,0.10)`,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease, background 160ms ease",
        boxShadow: disabled ? "none" : S.shadowSm,
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.03)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.filter = "none"; }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, style = {}, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: "rgba(233,238,249,0.03)",
        color: "#fff",
        fontWeight: 700,
        fontSize: 15,
        padding: "12px 18px",
        borderRadius: 12,
        border: `1px solid ${S.cardB}`,
        cursor: "pointer",
        transition: "transform 160ms ease, border-color 160ms ease, background 160ms ease",
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = S.accent + "55"; e.currentTarget.style.background = "rgba(233,238,249,0.05)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = S.cardB; e.currentTarget.style.background = "rgba(233,238,249,0.03)"; }}
    >
      {children}
    </button>
  );
}

function TextField({ value, onChange, onBlur, placeholder, type = "text", hasError = false, leftIcon, style = {} }) {
  return (
    <div style={{ position: "relative", width: "100%", flex: 1 }}>
      {leftIcon && (
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.9 }}>
          {leftIcon}
        </div>
      )}
      <input
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        type={type}
        style={{
          width: "100%",
          background: S.card2,
          border: `1px solid ${hasError ? "#FB7185" : S.cardB}`,
          borderRadius: 12,
          padding: leftIcon ? "14px 16px 14px 44px" : "14px 16px",
          color: "#fff",
          fontSize: 15,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
          ...style,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = S.accent + "88"; e.currentTarget.style.boxShadow = S.ring; }}
        onBlurCapture={(e) => { e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

// ─── REUSABLE: Loading Spinner ───────────────────────────────────────────────

function Loader({ label = "Loading..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 16 }}>
      <div style={{ width: 36, height: 36, border: "3px solid rgba(233,238,249,0.14)", borderTop: `3px solid ${S.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
      <span style={{ color: S.muted, fontSize: 14 }}>{label}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── REUSABLE: Score Badge ───────────────────────────────────────────────────

function ScoreBadge({ value, size = "md", title }) {
  const v = parseFloat(value) || 0;
  const color = v >= 70 ? S.green : v >= 40 ? S.amber : S.red;
  const sz = size === "lg" ? { w: 56, h: 56, fs: 20 } : { w: 40, h: 40, fs: 14 };
  const rating = v >= 70 ? "Strong" : v >= 40 ? "Moderate" : "Weak";
  return (
    <div title={title || `Score: ${Math.round(v)}/100 (${rating}). Green = 70+, Yellow = 40-69, Red = below 40.`} style={{ width: sz.w, height: sz.h, borderRadius: "50%", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ color, fontWeight: 800, fontSize: sz.fs }}>{Math.round(v)}</span>
    </div>
  );
}

// ─── REUSABLE: Custom Tooltip ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 16px" }}>
      <p style={{ color: S.muted, fontSize: 12, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || S.accent, fontSize: 13, fontWeight: 600, margin: "2px 0" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── REUSABLE: Confidence Badge ──────────────────────────────────────────────

function ConfidenceBadge({ level }) {
  const colors = { HIGH: S.green, "MEDIUM-HIGH": "#22d3ee", MEDIUM: S.amber, "LOW-MEDIUM": "#fb923c", LOW: S.red };
  return (
    <span style={{ background: (colors[level] || S.dim) + "22", color: colors[level] || S.dim, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>
      {level || "N/A"} CONFIDENCE
    </span>
  );
}

// ─── REUSABLE: FadeIn ────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0 }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(24px)", transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s` }}>
      {children}
    </div>
  );
}

// ─── NAVBAR: Public ──────────────────────────────────────────────────────────

function PublicNav({ navigate }) {
  const handleNav = (l) => {
    if (l === "Contact")      { navigate("contact");       return; }
    if (l === "About")        { navigate("about");         return; }
    if (l === "Features")     { navigate("features");      return; }
    if (l === "How It Works") { navigate("how-it-works");  return; }
  };
  return (
    <nav style={{ background: S.bg + "ee", backdropFilter: "blur(12px)", borderBottom: `1px solid ${S.cardB}`, position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => window.location.href = "/"}>
          <Logo /><span style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>TrendHive</span>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {["Features", "How It Works", "About", "Contact"].map(l => (
            <a key={l} onClick={() => handleNav(l)} style={{ color: S.muted, fontSize: 15, cursor: "pointer", transition: "color 0.2s" }}
              onMouseEnter={e => e.target.style.color = "#fff"} onMouseLeave={e => e.target.style.color = S.muted}>{l}</a>
          ))}
        </div>
        <button
          onClick={() => navigate("login")}
          style={{
            background: "rgba(233,238,249,0.04)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            padding: "10px 16px",
            borderRadius: 999,
            border: `1px solid ${S.cardB}`,
            cursor: "pointer",
            transition: "transform 160ms ease, border-color 160ms ease, background 160ms ease",
            backdropFilter: "blur(12px)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.background = "rgba(233,238,249,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = S.cardB; e.currentTarget.style.background = "rgba(233,238,249,0.04)"; }}
        >
          Login
        </button>
      </div>
    </nav>
  );
}

// ─── NAVBAR: App ─────────────────────────────────────────────────────────────
function AppNav({ navigate, currentPage }) {
  const items = [
    { key: "dashboard",     label: "Dashboard"    },
    { key: "opportunities", label: "Opportunities" },
    { key: "alerts",        label: "Alerts"        },
    { key: "categories",    label: "Categories"    },
    { key: "map",           label: "Map"           },
    { key: "financial",     label: "Financial"     },
    { key: "ai-copilot",    label: "AI Copilot"    },
  ];
  return (
    <nav style={{ background: S.bg + "ee", backdropFilter: "blur(12px)", borderBottom: `1px solid ${S.cardB}`, position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "stretch", justifyContent: "space-between", height: 64 }}>
        
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("dashboard")}>
          <Logo size={28} /><span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>TrendHive</span>
        </div>

        {/* Nav items */}
        <div style={{ display: "flex", alignSelf: "stretch" }}>
          {items.map(i => (
            <button key={i.key} onClick={() => navigate(i.key)}
              style={{
                background: "none",
                border: "none",
                borderBottom: currentPage === i.key ? `2px solid ${S.accent}` : "2px solid transparent",
                cursor: "pointer",
                color: currentPage === i.key ? "#fff" : S.muted,
                fontWeight: currentPage === i.key ? 700 : 400,
                fontSize: 14,
                padding: "0 18px",
                borderRadius: 0,
                transition: "color 0.18s, border-color 0.18s",
              }}
              onMouseEnter={e => { if (currentPage !== i.key) e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { if (currentPage !== i.key) e.currentTarget.style.color = S.muted; }}
            >
              {i.label}
            </button>
          ))}
        </div>

        {/* Profile */}
        <button onClick={() => navigate("profile")}
          style={{ background: "none", border: "none", borderBottom: currentPage === "profile" ? `2px solid ${S.accent}` : "2px solid transparent", cursor: "pointer", color: currentPage === "profile" ? "#fff" : S.muted, fontWeight: currentPage === "profile" ? 700 : 400, fontSize: 14, padding: "0 14px", alignSelf: "stretch", transition: "color 0.18s, border-color 0.18s" }}
          onMouseEnter={e => { if (currentPage !== "profile") e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { if (currentPage !== "profile") e.currentTarget.style.color = S.muted; }}
        >
          Profile
        </button>

      </div>
    </nav>
  );
}

function FinancialNavButton({ navigate, currentPage, style = {} }) {
  const active = currentPage === "financial";
  return (
    <button
      onClick={() => navigate("financial")}
      style={{
        background: active ? "rgba(233,238,249,0.04)" : "transparent",
        borderTop: "none",
        borderRight: "none",
        borderBottom: active ? `2px solid ${S.accent}` : "2px solid transparent",
        borderLeft: "none",
        cursor: "pointer",
        color: active ? "#fff" : "rgba(233,238,249,0.68)",
        fontWeight: active ? 600 : 400,
        fontSize: 14,
        padding: "8px 14px",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "0.2s",
        ...style,
      }}
    >
      Financial
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: HOME (Landing)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  HoneycombBg,
  Logo,
  Card,
  PrimaryButton,
  SecondaryButton,
  TextField,
  Loader,
  ScoreBadge,
  ChartTooltip,
  ConfidenceBadge,
  FadeIn,
  PublicNav,
  AppNav,
  FinancialNavButton,
};