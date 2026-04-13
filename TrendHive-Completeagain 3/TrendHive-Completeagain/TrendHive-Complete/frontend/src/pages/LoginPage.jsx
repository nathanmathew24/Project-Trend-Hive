import React, { useState } from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Logo, Card, PrimaryButton, SecondaryButton, TextField } from "../components/ui";
import { checkUser } from "../lib/auth";

function LoginPage({ navigate, setLoggedIn, setUserEmail, setUserName }) {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError("");
    if (!email || !pass) { setError("Please enter your email and password."); return; }
    setLoading(true);

    const result = checkUser(email, pass);
    setLoading(false);

    if (result === "no_account") {
      setError("No account found with this email. Please sign up first.");
      return;
    }
    if (result === "wrong_pass") {
      setError("Incorrect password. Please try again.");
      return;
    }

    // result === "ok"
    if (setLoggedIn)  setLoggedIn(true);
    if (setUserEmail) setUserEmail(email);
    navigate("dashboard");
  };

  return (
    <div style={{ background: S.gradHero || S.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <HoneycombBg />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, padding: "0 24px" }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
            <Logo size={36} />
            <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: 0 }}>Welcome Back</h1>
          </div>
          <p style={{ color: S.muted, fontSize: 14 }}>Sign in to your TrendHive account</p>
        </div>

        <Card style={{ padding: 32 }}>
          <label style={{ color: "#cbd5e0", fontSize: 13, display: "block", marginBottom: 6 }}>Email</label>
          <div style={{ marginBottom: 18 }}>
            <TextField
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
            />
          </div>

          <label style={{ color: "#cbd5e0", fontSize: 13, display: "block", marginBottom: 6 }}>Password</label>
          <div style={{ marginBottom: 24 }}>
            <TextField
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="Your password"
              type="password"
            />
          </div>

          {error && (
            <p style={{ color: "#FB7185", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</p>
          )}

          <PrimaryButton
            onClick={handleLogin}
            disabled={loading}
            style={{ width: "100%", padding: "14px", fontSize: 16, borderRadius: 14, marginBottom: 16 }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </PrimaryButton>

          <p style={{ color: S.muted, fontSize: 13, textAlign: "center", margin: 0 }}>
            Don't have an account?{" "}
            <span onClick={() => navigate("signup")} style={{ color: S.accent, cursor: "pointer", fontWeight: 600 }}>
              Sign Up
            </span>
          </p>
        </Card>

      </div>
    </div>
  );
}

export default LoginPage;