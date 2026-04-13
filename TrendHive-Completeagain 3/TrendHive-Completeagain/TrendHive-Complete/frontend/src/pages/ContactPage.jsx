import React, { useState } from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Card, PublicNav, PrimaryButton, TextField } from "../components/ui";
import { EMAIL_API } from "../lib/auth";

function ContactPage({ navigate }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.message) return;
    // Fire welcome/contact email
    fetch(EMAIL_API + "/email/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, email: form.email }),
    })
      .then(() => alert("Welcome email sent to " + form.email + "! Check your inbox."))
      .catch(() => {});
    setSent(true);
  };

  return (
    <div style={{ background: S.bg, minHeight: "100vh", position: "relative" }}>
      <HoneycombBg />
      <PublicNav navigate={navigate} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 24px", position: "relative", zIndex: 1 }}>
        <h1 style={{ color: "#fff", fontSize: 46, fontWeight: 800, textAlign: "center", marginBottom: 10, letterSpacing: "-0.03em" }}>
          Get in Touch
        </h1>
        <p style={{ color: S.muted, textAlign: "center", fontSize: 16, marginBottom: 40 }}>
          Ready to transform your F&B business with AI-powered insights?
        </p>

        <Card style={{ padding: 40 }}>
          {[
            { l: "Name",    k: "name",    ph: "Your name"       },
            { l: "Email",   k: "email",   ph: "your@email.com"  },
            { l: "Company", k: "company", ph: "Company name"    },
          ].map(f => (
            <div key={f.k} style={{ marginBottom: 18 }}>
              <label style={{ color: "#cbd5e0", fontSize: 13, display: "block", marginBottom: 6 }}>{f.l}</label>
              <TextField
                value={form[f.k]}
                onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                placeholder={f.ph}
              />
            </div>
          ))}

          <div style={{ marginBottom: 24 }}>
            <label style={{ color: "#cbd5e0", fontSize: 13, display: "block", marginBottom: 6 }}>Message</label>
            <textarea
              value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Tell us about your needs..."
              rows={4}
              style={{
                width: "100%",
                background: "rgba(11,16,24,0.62)",
                border: `1px solid ${S.cardB}`,
                borderRadius: 14,
                padding: "14px 16px",
                color: "#fff",
                fontSize: 15,
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {sent ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ color: S.green, fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Message sent successfully!</p>
              <p style={{ color: S.muted, fontSize: 13 }}>We'll get back to you shortly.</p>
            </div>
          ) : (
            <PrimaryButton onClick={handleSubmit} style={{ width: "100%", padding: 14, fontSize: 16, borderRadius: 14 }}>
              Send Message →
            </PrimaryButton>
          )}
        </Card>
      </div>
    </div>
  );
}

export default ContactPage;
