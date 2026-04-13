import React, { useState, useMemo } from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Card, AppNav, FinancialNavButton, SecondaryButton, PrimaryButton } from "../components/ui";

function getStoredEmail() {
  const keys = ["userEmail", "email", "loggedInEmail", "authEmail", "user_email"];
  for (const key of keys) {
    const v = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (v) return v;
  }
  return "user@example.com";
}

function Toggle({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 48, height: 26, borderRadius: 999, flexShrink: 0, cursor: "pointer",
        background: on ? S.accent : "rgba(233,238,249,0.12)",
        border: `1px solid ${on ? S.accent + "88" : S.cardB}`,
        position: "relative", transition: "background 0.25s, border-color 0.25s",
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: on ? 25 : 3,
        width: 18, height: 18, borderRadius: "50%",
        background: on ? "#0B1018" : "rgba(233,238,249,0.55)",
        transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }} />
    </div>
  );
}

function ProfilePage({ navigate, setLoggedIn, setUserEmail, setUserName }) {
  const [notifs, setNotifs] = useState({ email: true, weekly: true, alerts: true });

  const email = useMemo(() => getStoredEmail(), []);
  const shortName = useMemo(() => (email?.[0] || "U").toUpperCase(), [email]);
  const companyName = useMemo(() => {
    if (!email?.includes("@")) return "My Company";
    const d = email.split("@")[1]?.split(".")[0] || "company";
    return d.charAt(0).toUpperCase() + d.slice(1);
  }, [email]);

  const handleLogout = () => {
    ["userEmail","userName","loggedIn"].forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    if (setLoggedIn)  setLoggedIn(false);
    if (setUserEmail) setUserEmail("");
    if (setUserName)  setUserName("");
    navigate("login");
  };

  const notifItems = [
    { k: "email",  icon: "◎", l: "Email Notifications",  d: "Important updates delivered to your inbox" },
    { k: "weekly", icon: "▦", l: "Weekly Reports",       d: "Market activity summary every week" },
    { k: "alerts", icon: "◈", l: "Opportunity Alerts",   d: "Notified when promising areas emerge" },
  ];

  const summaryItems = [
    { label: "Role",   value: "Business Owner", color: S.accent,  icon: "◈" },
    { label: "Region", value: "Dubai, UAE",     color: S.green,   icon: "◎" },
    { label: "Status", value: "Active",         color: "#4ADE80", icon: "●" },
    { label: "Plan",   value: "Standard",       color: S.blue,    icon: "✦" },
  ];

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <HoneycombBg />
      <AppNav navigate={navigate} currentPage="profile" />
      <FinancialNavButton navigate={navigate} currentPage="profile"
        style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 64px", position: "relative", zIndex: 1 }}>

        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
          <div>
            <p style={{ color: S.accent, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
              Account
            </p>
            <h1 style={{ color: "#fff", fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
              Profile Settings
            </h1>
          </div>
          <SecondaryButton onClick={handleLogout} style={{ borderRadius: 999, padding: "11px 20px", fontSize: 14 }}>
            Log Out
          </SecondaryButton>
        </div>

        {/* ── PROFILE HERO BANNER ─────────────────────────────────────── */}
        <Card style={{ padding: "32px 36px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {/* Avatar */}
            <div style={{
              width: 88, height: 88, borderRadius: "50%", flexShrink: 0,
              background: `linear-gradient(135deg, ${S.accent}33, ${S.accent}11)`,
              border: `2px solid ${S.accent}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, fontWeight: 800, color: S.accent,
              boxShadow: `0 0 32px ${S.accent}22`,
            }}>
              {shortName}
            </div>

            {/* Name + email + badge */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
                <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0, wordBreak: "break-word" }}>
                  {email}
                </h2>
                <span style={{
                  background: S.accent + "18", color: S.accent,
                  fontSize: 11, fontWeight: 700, padding: "3px 10px",
                  borderRadius: 999, border: `1px solid ${S.accent}33`,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}>
                  Business Owner
                </span>
              </div>
              <p style={{ color: S.muted, fontSize: 14, margin: 0 }}>
                {companyName} · Dubai, UAE
              </p>
            </div>

            {/* Quick stats */}
            <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
              {[
                { label: "Areas Tracked", value: "24" },
                { label: "Cafés Monitored", value: "349" },
                { label: "Alerts Active", value: notifItems.filter(n => notifs[n.k]).length.toString() },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{s.value}</div>
                  <div style={{ color: S.dim, fontSize: 11, marginTop: 2, whiteSpace: "nowrap" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── MAIN GRID ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* LEFT: Account Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Card style={{ padding: 28 }}>
              <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: S.accent }}>◈</span> Account Details
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Email Address", value: email,        icon: "◎" },
                  { label: "Company",       value: companyName,  icon: "◇" },
                  { label: "Location",      value: "Dubai, UAE", icon: "△" },
                ].map(f => (
                  <div key={f.label} style={{
                    display: "flex", alignItems: "center", gap: 14,
                    background: "rgba(233,238,249,0.03)",
                    border: `1px solid ${S.cardB}`,
                    borderRadius: 14, padding: "14px 16px",
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: S.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>{f.label}</p>
                      <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0, wordBreak: "break-word" }}>{f.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Account Summary */}
            <Card style={{ padding: 28 }}>
              <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: S.accent }}>✦</span> Account Summary
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {summaryItems.map(item => (
                  <div key={item.label} style={{
                    background: "rgba(233,238,249,0.03)",
                    border: `1px solid ${S.cardB}`,
                    borderRadius: 14, padding: "16px 18px",
                  }}>
                    <p style={{ color: S.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>{item.label}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: item.color, fontSize: 12 }}>{item.icon}</span>
                      <p style={{ color: item.color, fontSize: 15, fontWeight: 700, margin: 0 }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* RIGHT: Notifications + Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Card style={{ padding: 28 }}>
              <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: S.accent }}>◉</span> Notification Preferences
              </h3>
              <p style={{ color: S.dim, fontSize: 12, margin: "0 0 20px" }}>Choose how you want to be informed</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {notifItems.map(n => (
                  <div key={n.k} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                    background: notifs[n.k] ? `${S.accent}08` : "rgba(233,238,249,0.02)",
                    border: `1px solid ${notifs[n.k] ? S.accent + "33" : S.cardB}`,
                    borderRadius: 14, padding: "16px 18px",
                    transition: "background 0.25s, border-color 0.25s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 18 }}>{n.icon}</span>
                      <div>
                        <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: "0 0 3px" }}>{n.l}</p>
                        <p style={{ color: S.dim, fontSize: 12, margin: 0 }}>{n.d}</p>
                      </div>
                    </div>
                    <Toggle on={notifs[n.k]} onToggle={() => setNotifs(p => ({ ...p, [n.k]: !p[n.k] }))} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Danger zone / logout */}
            <Card style={{ padding: 28 }}>
              <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: S.accent }}>⚙</span> Session
              </h3>
              <p style={{ color: S.dim, fontSize: 12, margin: "0 0 20px" }}>Manage your active session</p>
              <div style={{
                background: "rgba(251,113,133,0.04)", border: "1px solid rgba(251,113,133,0.15)",
                borderRadius: 14, padding: "18px 20px", marginBottom: 14,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              }}>
                <div>
                  <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: "0 0 3px" }}>Sign out of TrendHive</p>
                  <p style={{ color: S.dim, fontSize: 12, margin: 0 }}>You'll need to log in again to access your dashboard</p>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    background: "rgba(251,113,133,0.12)", color: "#FB7185",
                    border: "1px solid rgba(251,113,133,0.25)", borderRadius: 999,
                    padding: "10px 18px", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(251,113,133,0.22)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(251,113,133,0.12)"}
                >
                  Log Out
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;