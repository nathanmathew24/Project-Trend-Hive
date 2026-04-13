"""
TrendHive Email Agent
======================
Agentic email system that autonomously sends:
  1. Welcome emails on sign-up
  2. Login alert emails (security notification)
  3. Market intelligence alerts (anomalies + top opportunities)

Uses Gmail SMTP. Requires an App Password (not your regular Gmail password).

Setup:
  1. Go to https://myaccount.google.com/apppasswords
  2. Generate an App Password for "Mail"
  3. Set environment variables:
     export GMAIL_USER="your.email@gmail.com"
     export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"

Run: uvicorn email_agent:email_app --reload --port 8002
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
import os
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("email_agent")

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
TRENDHIVE_API = os.getenv("TRENDHIVE_API", "http://localhost:8000")
AGENT_API = os.getenv("AGENT_API", "http://localhost:8001")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════════

def base_template(title, body_content):
    """Base HTML email template with TrendHive branding."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#080c14;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background-color:#0f1419;border:1px solid #1e293b;">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:32px 40px;text-align:center;border-bottom:2px solid #F5C518;">
                <div style="font-size:28px;margin-bottom:4px;">🐝</div>
                <h1 style="color:#F5C518;font-size:26px;font-weight:800;margin:0;letter-spacing:-0.5px;">TrendHive</h1>
                <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">AI-Powered Market Intelligence</p>
            </div>

            <!-- Title Bar -->
            <div style="background:#111827;padding:16px 40px;border-bottom:1px solid #1e293b;">
                <h2 style="color:#ffffff;font-size:18px;font-weight:700;margin:0;">{title}</h2>
            </div>

            <!-- Body -->
            <div style="padding:32px 40px;">
                {body_content}
            </div>

            <!-- Footer -->
            <div style="background:#080c14;padding:24px 40px;text-align:center;border-top:1px solid #1e293b;">
                <p style="color:#475569;font-size:11px;margin:0;">TrendHive AI-Powered Market Intelligence for F&B • Dubai, UAE</p>
                <p style="color:#334155;font-size:10px;margin:6px 0 0;">This is an automated message from TrendHive's Agentic AI system.</p>
            </div>
        </div>
    </body>
    </html>
    """


def welcome_email_html(user_name, user_email):
    """Welcome email sent on sign-up."""
    body = f"""
    <p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Hi <strong style="color:#ffffff;">{user_name}</strong>,
    </p>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.7;margin:0 0 20px;">
        Welcome to <strong style="color:#F5C518;">TrendHive</strong> — your AI-powered market intelligence platform for Dubai's café and F&B industry.
    </p>

    <div style="background:#1e293b;border-radius:12px;padding:24px;margin:20px 0;border-left:3px solid #F5C518;">
        <h3 style="color:#F5C518;font-size:15px;font-weight:700;margin:0 0 12px;">🚀 What you can do now:</h3>
        <table style="width:100%;">
            <tr><td style="color:#10b981;font-size:20px;padding:6px 12px 6px 0;vertical-align:top;">✦</td>
                <td style="color:#cbd5e0;font-size:13px;line-height:1.6;padding:6px 0;">
                    <strong style="color:#fff;">Explore 24 Dubai Areas</strong> — demand scores, competition analysis, growth trends
                </td></tr>
            <tr><td style="color:#10b981;font-size:20px;padding:6px 12px 6px 0;vertical-align:top;">✦</td>
                <td style="color:#cbd5e0;font-size:13px;line-height:1.6;padding:6px 0;">
                    <strong style="color:#fff;">AI-Powered Recommendations</strong> — personalized for 5 investor profiles
                </td></tr>
            <tr><td style="color:#10b981;font-size:20px;padding:6px 12px 6px 0;vertical-align:top;">✦</td>
                <td style="color:#cbd5e0;font-size:13px;line-height:1.6;padding:6px 0;">
                    <strong style="color:#fff;">Agentic AI Copilot</strong> — ask complex questions, get data-rich answers
                </td></tr>
            <tr><td style="color:#10b981;font-size:20px;padding:6px 12px 6px 0;vertical-align:top;">✦</td>
                <td style="color:#cbd5e0;font-size:13px;line-height:1.6;padding:6px 0;">
                    <strong style="color:#fff;">LSTM Demand Forecasting</strong> — predict market trends before they happen
                </td></tr>
        </table>
    </div>

    <div style="text-align:center;margin:28px 0;">
        <a href="http://localhost:5173" style="background:#F5C518;color:#0a0a0a;font-weight:700;font-size:14px;padding:14px 36px;border-radius:8px;text-decoration:none;display:inline-block;">
            Open Dashboard →
        </a>
    </div>

    <p style="color:#64748b;font-size:12px;line-height:1.6;margin:20px 0 0;">
        Account: {user_email}<br>
        Registered: {datetime.now().strftime("%B %d, %Y at %I:%M %p")}
    </p>
    """
    return base_template("Welcome to TrendHive! 🎉", body)


def login_alert_html(user_name, user_email, login_time, device_info="Web Browser"):
    """Security alert sent on login."""
    body = f"""
    <p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Hi <strong style="color:#ffffff;">{user_name}</strong>,
    </p>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.7;margin:0 0 20px;">
        We detected a new sign-in to your TrendHive account.
    </p>

    <div style="background:#1e293b;border-radius:12px;padding:24px;margin:20px 0;border-left:3px solid #3b82f6;">
        <h3 style="color:#3b82f6;font-size:14px;font-weight:700;margin:0 0 16px;">🔐 Login Details</h3>
        <table style="width:100%;">
            <tr>
                <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;width:120px;">Account</td>
                <td style="color:#ffffff;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;">{user_email}</td>
            </tr>
            <tr>
                <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;">Time</td>
                <td style="color:#ffffff;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;">{login_time}</td>
            </tr>
            <tr>
                <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;">Device</td>
                <td style="color:#ffffff;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;">{device_info}</td>
            </tr>
            <tr>
                <td style="color:#94a3b8;font-size:13px;padding:8px 0;">Status</td>
                <td style="padding:8px 0;"><span style="background:#10b98122;color:#10b981;font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;">SUCCESSFUL</span></td>
            </tr>
        </table>
    </div>

    <p style="color:#f59e0b;font-size:13px;line-height:1.6;margin:16px 0;">
        ⚠️ If this wasn't you, please secure your account immediately.
    </p>
    """
    return base_template("New Login Detected 🔐", body)


def market_alert_html(user_name, alerts_data):
    """Market intelligence alerts with anomalies and opportunities."""
    alerts_html = ""

    # Top Opportunities
    if alerts_data.get("opportunities"):
        alerts_html += """
        <div style="background:#1e293b;border-radius:12px;padding:24px;margin:20px 0;border-left:3px solid #10b981;">
            <h3 style="color:#10b981;font-size:14px;font-weight:700;margin:0 0 16px;">📈 Top Investment Opportunities</h3>
        """
        for opp in alerts_data["opportunities"][:3]:
            score_color = "#10b981" if opp.get("score", 0) >= 80 else "#f59e0b" if opp.get("score", 0) >= 60 else "#ef4444"
            alerts_html += f"""
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #334155;">
                <div>
                    <strong style="color:#ffffff;font-size:14px;">{opp.get('area', 'Unknown')}</strong>
                    <span style="color:#64748b;font-size:12px;margin-left:8px;">{opp.get('positioning', '')}</span>
                </div>
                <span style="background:{score_color}22;color:{score_color};font-size:13px;font-weight:800;padding:4px 12px;border-radius:6px;">
                    {opp.get('score', 0):.0f}
                </span>
            </div>
            """
        alerts_html += "</div>"

    # Anomalies
    if alerts_data.get("anomalies"):
        alerts_html += """
        <div style="background:#1e293b;border-radius:12px;padding:24px;margin:20px 0;border-left:3px solid #ef4444;">
            <h3 style="color:#ef4444;font-size:14px;font-weight:700;margin:0 0 16px;">⚠️ Market Anomalies Detected</h3>
        """
        for anomaly in alerts_data["anomalies"][:3]:
            severity_color = "#ef4444" if anomaly.get("severity") == "HIGH" else "#f59e0b" if anomaly.get("severity") == "MEDIUM" else "#3b82f6"
            alerts_html += f"""
            <div style="padding:10px 0;border-bottom:1px solid #334155;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <strong style="color:#ffffff;font-size:13px;">{anomaly.get('area', 'Unknown')}</strong>
                    <span style="background:{severity_color}22;color:{severity_color};font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;">
                        {anomaly.get('severity', 'UNKNOWN')}
                    </span>
                </div>
                <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">{anomaly.get('description', '')}</p>
            </div>
            """
        alerts_html += "</div>"

    # Market Summary
    if alerts_data.get("summary"):
        s = alerts_data["summary"]
        alerts_html += f"""
        <div style="background:#1e293b;border-radius:12px;padding:24px;margin:20px 0;border-left:3px solid #F5C518;">
            <h3 style="color:#F5C518;font-size:14px;font-weight:700;margin:0 0 12px;">📊 Market Summary</h3>
            <p style="color:#cbd5e0;font-size:13px;line-height:1.7;margin:0;">
                Monitoring <strong style="color:#fff;">{s.get('total_areas', 24)}</strong> areas with 
                <strong style="color:#fff;">{s.get('total_cafes', 349)}</strong> cafés. 
                Average demand score: <strong style="color:#F5C518;">{s.get('avg_demand', 0):.1%}</strong>.
                Top performing area: <strong style="color:#10b981;">{s.get('top_area', 'N/A')}</strong>.
            </p>
        </div>
        """

    if not alerts_html:
        alerts_html = '<p style="color:#94a3b8;font-size:14px;">No alerts at this time. Everything looks normal across all monitored areas.</p>'

    body = f"""
    <p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Hi <strong style="color:#ffffff;">{user_name}</strong>,
    </p>
    <p style="color:#cbd5e0;font-size:14px;line-height:1.7;margin:0 0 8px;">
        Here's your latest market intelligence briefing from TrendHive's Agentic AI:
    </p>
    {alerts_html}

    <div style="text-align:center;margin:28px 0;">
        <a href="http://localhost:5173" style="background:#F5C518;color:#0a0a0a;font-weight:700;font-size:14px;padding:14px 36px;border-radius:8px;text-decoration:none;display:inline-block;">
            View Full Dashboard →
        </a>
    </div>

    <p style="color:#475569;font-size:11px;margin:20px 0 0;">
        Generated: {datetime.now().strftime("%B %d, %Y at %I:%M %p")} • Powered by TrendHive Agentic AI
    </p>
    """
    return base_template("Market Intelligence Alert 📊", body)


# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL SENDER
# ═══════════════════════════════════════════════════════════════════════════════

def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """Send an HTML email via Gmail SMTP."""
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        logger.warning("Gmail credentials not set — logging email instead of sending")
        logger.info(f"📧 [SIMULATED] To: {to_email} | Subject: {subject}")
        return {"status": "simulated", "to": to_email, "subject": subject, "message": "Email logged (Gmail not configured)"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"TrendHive AI <{GMAIL_USER}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())

        logger.info(f"📧 Email sent to {to_email}: {subject}")
        return {"status": "sent", "to": to_email, "subject": subject}

    except Exception as e:
        logger.error(f"Email failed: {e}")
        return {"status": "error", "to": to_email, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# MARKET DATA GATHERER (Agentic — autonomously fetches data)
# ═══════════════════════════════════════════════════════════════════════════════

async def gather_market_alerts(profile: str = "balanced_investor") -> dict:
    """Autonomously gather market intelligence data from TrendHive API."""
    alerts_data = {"opportunities": [], "anomalies": [], "summary": {}}

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Get top opportunities
        try:
            resp = await client.get(f"{TRENDHIVE_API}/recommend?profile={profile}&top_n=3")
            if resp.status_code == 200:
                opps = resp.json()
                for o in opps:
                    alerts_data["opportunities"].append({
                        "area": o.get("area", ""),
                        "score": o.get("opportunity_score", 0),
                        "positioning": o.get("market_positioning", ""),
                    })
        except Exception as e:
            logger.error(f"Failed to fetch opportunities: {e}")

        # 2. Get market summary
        try:
            resp = await client.get(f"{TRENDHIVE_API}/areas")
            if resp.status_code == 200:
                areas = resp.json()
                if areas:
                    avg_demand = sum(a.get("demand_score", 0) for a in areas) / len(areas)
                    top = max(areas, key=lambda a: a.get("demand_score", 0))
                    total_cafes = sum(a.get("total_cafes", 0) for a in areas)
                    alerts_data["summary"] = {
                        "total_areas": len(areas),
                        "total_cafes": total_cafes,
                        "avg_demand": avg_demand,
                        "top_area": top.get("area", "N/A"),
                    }
        except Exception as e:
            logger.error(f"Failed to fetch areas: {e}")

        # 3. Check for anomalies on top 3 demand areas
        try:
            resp = await client.get(f"{TRENDHIVE_API}/areas")
            if resp.status_code == 200:
                areas = resp.json()
                top_areas = sorted(areas, key=lambda a: a.get("demand_score", 0), reverse=True)[:3]
                for area in top_areas:
                    try:
                        name = area.get("area", "")
                        aresp = await client.get(f"{TRENDHIVE_API}/forecast/anomaly/{name}")
                        if aresp.status_code == 200:
                            anom = aresp.json()
                            if anom.get("anomalies"):
                                for a in anom["anomalies"][:1]:
                                    alerts_data["anomalies"].append({
                                        "area": name,
                                        "severity": a.get("severity", "UNKNOWN"),
                                        "description": a.get("alert_narrative", a.get("description", "Anomaly detected")),
                                    })
                    except:
                        pass
        except Exception as e:
            logger.error(f"Failed to fetch anomalies: {e}")

    return alerts_data


# ═══════════════════════════════════════════════════════════════════════════════
# FASTAPI APP
# ═══════════════════════════════════════════════════════════════════════════════

email_app = FastAPI(title="TrendHive Email Agent", version="1.0.0")
email_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class SignupRequest(BaseModel):
    name: str
    email: str


class LoginAlertRequest(BaseModel):
    name: str
    email: str
    device: Optional[str] = "Web Browser"


class MarketAlertRequest(BaseModel):
    name: str
    email: str
    profile: Optional[str] = "balanced_investor"


@email_app.get("/health")
def health():
    return {
        "status": "ok",
        "agent": "TrendHive Email Agent v1.0",
        "gmail_configured": bool(GMAIL_USER and GMAIL_APP_PASSWORD),
        "gmail_user": GMAIL_USER[:3] + "***" if GMAIL_USER else "not set",
    }


@email_app.post("/email/welcome")
def send_welcome(req: SignupRequest):
    """Send welcome email on sign-up."""
    html = welcome_email_html(req.name, req.email)
    result = send_email(req.email, "Welcome to TrendHive! 🐝", html)
    return {"type": "welcome", **result}


@email_app.post("/email/login-alert")
def send_login_alert(req: LoginAlertRequest):
    """Send login security alert."""
    login_time = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    html = login_alert_html(req.name, req.email, login_time, req.device or "Web Browser")
    result = send_email(req.email, "New Login to TrendHive 🔐", html)
    return {"type": "login_alert", **result}


@email_app.post("/email/market-alert")
async def send_market_alert(req: MarketAlertRequest):
    """Autonomously gather market data and send intelligence alert."""
    logger.info(f"🤖 Agent gathering market intelligence for {req.name}...")
    alerts_data = await gather_market_alerts(req.profile or "balanced_investor")
    html = market_alert_html(req.name, alerts_data)
    result = send_email(req.email, "TrendHive Market Intelligence Alert 📊", html)
    return {"type": "market_alert", "data_gathered": bool(alerts_data), **result}


@email_app.on_event("startup")
async def startup():
    logger.info("📧 TrendHive Email Agent starting...")
    logger.info(f"   Gmail: {GMAIL_USER[:3] + '***' if GMAIL_USER else 'NOT SET'}")
    logger.info(f"   TrendHive API: {TRENDHIVE_API}")
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        logger.warning("   ⚠ Gmail not configured — emails will be simulated/logged")
        logger.warning("   Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables")
    logger.info("📧 Email Agent ready!")
