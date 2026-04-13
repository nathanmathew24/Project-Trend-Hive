import React, { useState } from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Logo, Card, PrimaryButton, TextField } from "../components/ui";
import { getUsers, saveUser, EMAIL_API } from "../lib/auth";

function SignUpPage({ navigate, setLoggedIn, setUserEmail, setUserName }) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSignUp = () => {
    if (!name || !email) { alert("Please fill in your name and email."); return; }
    setLoading(true);
    const existing = getUsers();
    if (existing[email.toLowerCase()]) {
      alert("Account already exists with this email. Please sign in instead.");
      setLoading(false);
      return;
    }
    saveUser(email, name, pass);
    fetch(EMAIL_API + "/email/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    })
      .then(() => {
        setSent(true);
        setLoading(false);
        if (setLoggedIn)  setLoggedIn(true);
        if (setUserEmail) setUserEmail(email);
        if (setUserName)  setUserName(name);
        setTimeout(() => navigate("dashboard"), 2000);
      })
      .catch(() => {
        setLoading(false);
        if (setLoggedIn)  setLoggedIn(true);
        if (setUserEmail) setUserEmail(email);
        if (setUserName)  setUserName(name);
        navigate("dashboard");
      });
  };

  if (sent) return (
    <div style={{ background: S.gradHero || S.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <HoneycombBg />
      <Card style={{ padding: 40, textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Welcome aboard!</h2>
        <p style={{ color: S.muted, fontSize: 14 }}>
          Welcome email sent to <strong style={{ color: "#fff" }}>{email}</strong>
        </p>
        <p style={{ color: S.dim, fontSize: 13, marginTop: 8 }}>Redirecting to dashboard...</p>
      </Card>
    </div>
  );

  return (
    <div style={{ background: S.gradHero || S.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <HoneycombBg />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
            <Logo size={36} />
            <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: 0 }}>Create Account</h1>
          </div>
          <p style={{ color: S.muted, fontSize: 14 }}>Join TrendHive for free market intelligence</p>
        </div>

        <Card style={{ padding: 32 }}>
          <label style={{ color: "#cbd5e0", fontSize: 13, display: "block", marginBottom: 6 }}>Full Name</label>
          <div style={{ marginBottom: 18 }}>
            <TextField value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </div>

          <label style={{ color: "#cbd5e0", fontSize: 13, display: "block", marginBottom: 6 }}>Email</label>
          <div style={{ marginBottom: 18 }}>
            <TextField value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
          </div>

          <label style={{ color: "#cbd5e0", fontSize: 13, display: "block", marginBottom: 6 }}>Password</label>
          <div style={{ marginBottom: 24 }}>
            <TextField value={pass} onChange={e => setPass(e.target.value)} placeholder="Create a password" type="password" />
          </div>

          <PrimaryButton
            onClick={handleSignUp}
            disabled={loading}
            style={{ width: "100%", padding: "14px", fontSize: 16, borderRadius: 14, marginBottom: 16, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </PrimaryButton>

          <p style={{ color: S.muted, fontSize: 13, textAlign: "center", margin: 0 }}>
            Already have an account?{" "}
            <span onClick={() => navigate("login")} style={{ color: S.accent, cursor: "pointer", fontWeight: 600 }}>
              Sign In
            </span>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default SignUpPage;