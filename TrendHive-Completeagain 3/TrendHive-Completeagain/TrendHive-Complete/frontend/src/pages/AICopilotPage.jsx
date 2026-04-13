import React, { useState, useEffect, useRef } from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Card, AppNav, FinancialNavButton, PrimaryButton, TextField } from "../components/ui";

const AGENT_API = "http://localhost:8001";

function AICopilotPage({ navigate }) {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hi! I’m here to help you explore Dubai’s cafe market. Ask me about the best areas, demand, competition, or where you might want to start.",
      steps: [],
      tools: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [expandedSteps, setExpandedSteps] = useState({});
  const endRef = useRef(null);

  const suggested = [
    "What are the top 3 areas for a premium cafe?",
    "Compare DIFC and Downtown Dubai",
    "Which area has the lowest barrier to entry?",
    "Forecast demand for JBR",
    "Why is Bur Dubai ranked #1 for budget investors?",
    "What cuisine types have the highest sentiment?",
  ];

  const send = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;

    setMessages((p) => [...p, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);
    setAgentStatus("Thinking...");

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "ai")
        .slice(-6)
        .map((m) => ({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.text,
        }));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);

      setAgentStatus("Working on it...");

      const res = await fetch(AGENT_API + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: msg,
          conversation_history: history,
        }),
      });

      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.text();
        setMessages((p) => [
          ...p,
          {
            role: "ai",
            text: "Agent error (" + res.status + "): " + err,
            steps: [],
            tools: [],
          },
        ]);
        setLoading(false);
        setAgentStatus("");
        return;
      }

      const data = await res.json();

      setMessages((p) => [
        ...p,
        {
          role: "ai",
          text: data.answer || "No answer generated.",
          steps: data.steps || [],
          tools: data.tools_used || [],
          confidence: data.confidence || "unknown",
          time: data.total_time || 0,
        },
      ]);
    } catch (e) {
      setMessages((p) => [
        ...p,
        {
          role: "ai",
          text:
            e.name === "AbortError"
              ? "That took too long. Please try again."
              : "I couldn’t connect right now. Please make sure the AI service is running on port 8001.",
          steps: [],
          tools: [],
        },
      ]);
    }

    setLoading(false);
    setAgentStatus("");
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const renderMd = (text) => {
    if (!text) return null;

    return String(text).split("\n").map((line, i) => {
      if (line.startsWith("### ")) {
        return (
          <h4
            key={i}
            style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "12px 0 6px" }}
          >
            {line.slice(4)}
          </h4>
        );
      }

      if (line.startsWith("## ")) {
        return (
          <h3
            key={i}
            style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: "14px 0 8px" }}
          >
            {line.slice(3)}
          </h3>
        );
      }

      if (line.startsWith("# ")) {
        return (
          <h2
            key={i}
            style={{ color: S.accent, fontWeight: 800, fontSize: 19, margin: "16px 0 10px" }}
          >
            {line.slice(2)}
          </h2>
        );
      }

      let html = line.replace(
        /\*\*([^*]+)\*\*/g,
        '<strong style="color:#fff;font-weight:700">$1</strong>'
      );

      if (line.match(/^\s*[-]\s/)) {
        html = "• " + html.replace(/^\s*[-]\s/, "");
      }

      if (!line.trim()) return <div key={i} style={{ height: 8 }} />;

      return (
        <p
          key={i}
          style={{ color: "#cbd5e0", fontSize: 14, lineHeight: 1.7, margin: "3px 0" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    });
  };

  const toggleSteps = (idx) => {
    setExpandedSteps((p) => ({ ...p, [idx]: !p[idx] }));
  };

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <HoneycombBg />
      <AppNav navigate={navigate} currentPage="ai-copilot" />
      <FinancialNavButton
        navigate={navigate}
        currentPage="ai-copilot"
        style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }}
      />

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 32,
          position: "relative",
          width: "100%",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div
            style={{
              background: "rgba(233,238,249,0.03)",
              borderRadius: 14,
              padding: 12,
              fontSize: 22,
              color: S.accent,
              border: "1px solid " + S.cardB,
              backdropFilter: "blur(12px)",
            }}
          >
            ✦
          </div>

          <div>
            <h1
              style={{
                color: "#fff",
                fontSize: 34,
                fontWeight: 800,
                margin: 0,
                letterSpacing: "-0.03em",
              }}
            >
              AI Copilot
            </h1>
            <p style={{ color: S.muted, fontSize: 13, margin: 0 }}>
              Ask questions and get simple, useful insights about Dubai’s cafe market.
            </p>
          </div>
        </div>

        <Card style={{ padding: 20, marginBottom: 14, minHeight: 440, maxHeight: 560, overflowY: "auto" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              {m.role === "ai" ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ color: S.accent, fontSize: 14 }}>✦</span>
                    <span style={{ color: S.accent, fontWeight: 600, fontSize: 13 }}>AI Copilot</span>

                    {m.confidence && m.confidence !== "unknown" && (
                      <span
                        style={{
                          background: (m.confidence === "high" ? S.green : S.amber) + "22",
                          color: m.confidence === "high" ? S.green : S.amber,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 4,
                          marginLeft: 4,
                        }}
                      >
                        {m.confidence.toUpperCase()}
                      </span>
                    )}

                    {m.time > 0 && (
                      <span style={{ color: S.dim, fontSize: 11, marginLeft: 4 }}>{m.time}s</span>
                    )}
                  </div>

                  {m.steps && m.steps.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <button
                        onClick={() => toggleSteps(i)}
                        style={{
                          background: "#0f172a",
                          border: "1px solid " + S.cardB,
                          borderRadius: 8,
                          padding: "8px 14px",
                          color: S.muted,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ color: S.accent }}>⚡</span>
                        <span>{m.steps.filter((s) => s.action === "tool_call").length} step(s)</span>
                        <span style={{ marginLeft: "auto", color: S.dim }}>
                          {expandedSteps[i] ? "▼" : "▶"}
                        </span>
                      </button>

                      {expandedSteps[i] && (
                        <div
                          style={{
                            background: "#0a0f1a",
                            border: "1px solid " + S.cardB,
                            borderTop: "none",
                            borderRadius: "0 0 8px 8px",
                            padding: 12,
                          }}
                        >
                          {m.steps
                            .filter((s) => s.action === "tool_call")
                            .map((step, j) => {
                              const toolSteps = m.steps.filter((s) => s.action === "tool_call");

                              return (
                                <div
                                  key={j}
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    marginBottom: 10,
                                    paddingBottom: 10,
                                    borderBottom:
                                      j < toolSteps.length - 1 ? "1px solid " + S.cardB : "none",
                                  }}
                                >
                                  <div
                                    style={{
                                      background: S.accent + "22",
                                      color: S.accent,
                                      fontSize: 11,
                                      fontWeight: 800,
                                      width: 24,
                                      height: 24,
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {step.step}
                                  </div>

                                  <div style={{ flex: 1 }}>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        marginBottom: 4,
                                      }}
                                    >
                                      <span style={{ color: S.blue, fontSize: 12, fontWeight: 700 }}>
                                        {step.tool}
                                      </span>
                                    </div>

                                    <p
                                      style={{
                                        color: S.muted,
                                        fontSize: 12,
                                        margin: 0,
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      {step.reasoning}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  <div>{renderMd(m.text)}</div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      background: "rgba(233,238,249,0.04)",
                      border: "1px solid " + S.cardB,
                      borderRadius: 14,
                      padding: "10px 14px",
                      maxWidth: "75%",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <p style={{ color: "#fff", fontSize: 14, margin: 0 }}>{m.text}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: "2px solid rgba(233,238,249,0.14)",
                  borderTop: "2px solid " + S.accent,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span style={{ color: S.accent, fontSize: 13, fontWeight: 600 }}>{agentStatus}</span>
              <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
            </div>
          )}

          <div ref={endRef} />
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {suggested.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              style={{
                background: "rgba(233,238,249,0.03)",
                border: "1px solid " + S.cardB,
                borderRadius: 14,
                padding: "10px 12px",
                color: S.muted,
                fontSize: 12,
                textAlign: "left",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {q}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 10,
            width: "100%",
          }}
        >
          <TextField
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => {}}
            placeholder="Ask anything about Dubai’s cafe market..."
            style={{
              width: "100%",
              minWidth: 0,
              opacity: loading ? 0.6 : 1,
            }}
          />

          <PrimaryButton
            onClick={() => send()}
            disabled={loading}
            style={{
              padding: "14px 22px",
              borderRadius: 999,
              fontSize: 14,
              whiteSpace: "nowrap",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "⏳" : "Send →"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default AICopilotPage;