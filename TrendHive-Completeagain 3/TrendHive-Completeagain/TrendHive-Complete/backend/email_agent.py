
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import smtplib, ssl, httpx, os, logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("email_agent")

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
TRENDHIVE_API = os.getenv("TRENDHIVE_API", "http://localhost:8000")

def base_html(title, body):
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="padding:32px 40px 24px;border-bottom:1px solid #eef0f3;">
    <h1 style="color:#1a1a2e;font-size:20px;font-weight:700;margin:0 0 2px;letter-spacing:-0.3px;">TrendHive</h1>
    <p style="color:#9ca3af;font-size:12px;margin:0;">Market Intelligence Platform</p></div>
    <div style="padding:32px 40px;">
    <h2 style="color:#1a1a2e;font-size:17px;font-weight:700;margin:0 0 20px;">{title}</h2>
    {body}</div>
    <div style="padding:20px 40px;background:#fafbfc;border-top:1px solid #eef0f3;text-align:center;">
    <p style="color:#b0b7c3;font-size:11px;margin:0;">TrendHive &middot; AI-Powered F&B Intelligence &middot; Dubai, UAE</p></div></div></body></html>"""

def send_email(to, subject, html):
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        logger.info(f"[SIMULATED] To: {to} | Subject: {subject}")
        return {"status":"simulated","to":to,"subject":subject}
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"], msg["From"], msg["To"] = subject, f"TrendHive <{GMAIL_USER}>", to
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.starttls(context=ctx)
            s.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            s.sendmail(GMAIL_USER, to, msg.as_string())
        logger.info(f"Email sent to {to}")
        return {"status":"sent","to":to,"subject":subject}
    except Exception as e:
        logger.error(f"Email failed: {e}")
        return {"status":"error","error":str(e)}

async def gather_alerts(profile="balanced_investor"):
    data = {"opportunities":[],"anomalies":[],"summary":{}}
    async with httpx.AsyncClient(timeout=15) as c:
        try:
            r = await c.get(f"{TRENDHIVE_API}/recommend?profile={profile}&top_n=3")
            if r.status_code==200:
                for o in r.json(): data["opportunities"].append({"area":o.get("area",""),"score":o.get("opportunity_score",0),"positioning":o.get("market_positioning","")})
        except: pass
        try:
            r = await c.get(f"{TRENDHIVE_API}/areas")
            if r.status_code==200:
                areas=r.json()
                if areas:
                    avg=sum(a.get("demand_score",0) for a in areas)/len(areas)
                    top=max(areas,key=lambda a:a.get("demand_score",0))
                    data["summary"]={"total_areas":len(areas),"total_cafes":sum(a.get("total_cafes",0) for a in areas),"avg_demand":avg,"top_area":top.get("area","N/A")}
        except: pass
    return data

email_app = FastAPI(title="TrendHive Email Agent")
email_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class SignupReq(BaseModel):
    name: str
    email: str

class LoginReq(BaseModel):
    name: str
    email: str
    device: Optional[str] = "Web Browser"

class AlertReq(BaseModel):
    name: str
    email: str
    profile: Optional[str] = "balanced_investor"

@email_app.get("/health")
def health():
    return {"status":"ok","gmail_configured":bool(GMAIL_USER and GMAIL_APP_PASSWORD)}

@email_app.post("/email/welcome")
def welcome(req: SignupReq):
    body = f"""<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi <strong style="color:#1a1a2e;">{req.name}</strong>,</p>
    <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 24px;">Welcome to TrendHive. Your account has been created and you now have access to AI-powered market intelligence for Dubai's F&B sector.</p>
    <div style="background:#f8f9fb;border-radius:8px;padding:20px 24px;margin:0 0 24px;border:1px solid #eef0f3;">
    <p style="color:#374151;font-size:13px;line-height:2;margin:0;">
    <span style="color:#d4a017;margin-right:8px;">&#9670;</span> Area analysis across 24 Dubai zones<br>
    <span style="color:#d4a017;margin-right:8px;">&#9670;</span> Investment recommendations for 5 profiles<br>
    <span style="color:#d4a017;margin-right:8px;">&#9670;</span> Agentic AI copilot for complex queries<br>
    <span style="color:#d4a017;margin-right:8px;">&#9670;</span> LSTM-powered demand forecasting</p></div>
    <div style="text-align:center;margin:0 0 24px;">
    <a href="http://localhost:5173" style="background:#1a1a2e;color:#ffffff;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;display:inline-block;">Open Dashboard</a></div>
    <p style="color:#b0b7c3;font-size:12px;margin:0;">Account: {req.email}<br>Created: {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</p>"""
    return {"type":"welcome", **send_email(req.email, "Welcome to TrendHive", base_html("Welcome to TrendHive", body))}

@email_app.post("/email/login-alert")
def login_alert(req: LoginReq):
    t = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    body = f"""<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi <strong style="color:#1a1a2e;">{req.name}</strong>,</p>
    <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 24px;">A new sign-in was detected on your TrendHive account.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
    <tr><td style="color:#9ca3af;font-size:13px;padding:12px 0;border-bottom:1px solid #eef0f3;width:100px;">Account</td><td style="color:#1a1a2e;font-size:13px;padding:12px 0;border-bottom:1px solid #eef0f3;">{req.email}</td></tr>
    <tr><td style="color:#9ca3af;font-size:13px;padding:12px 0;border-bottom:1px solid #eef0f3;">Time</td><td style="color:#1a1a2e;font-size:13px;padding:12px 0;border-bottom:1px solid #eef0f3;">{t}</td></tr>
    <tr><td style="color:#9ca3af;font-size:13px;padding:12px 0;border-bottom:1px solid #eef0f3;">Device</td><td style="color:#1a1a2e;font-size:13px;padding:12px 0;border-bottom:1px solid #eef0f3;">{req.device}</td></tr>
    <tr><td style="color:#9ca3af;font-size:13px;padding:12px 0;">Status</td><td style="padding:12px 0;"><span style="background:#ecfdf5;color:#059669;font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;">Successful</span></td></tr></table>
    <p style="color:#d97706;font-size:13px;line-height:1.6;margin:0 0 20px;">If this wasn't you, please secure your account immediately.</p>
    <div style="text-align:center;">
    <a href="http://localhost:5173" style="background:#1a1a2e;color:#ffffff;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;display:inline-block;">View Dashboard</a></div>"""
    return {"type":"login_alert", **send_email(req.email, "New Login — TrendHive", base_html("New Login Detected", body))}

@email_app.post("/email/market-alert")
async def market_alert(req: AlertReq):
    logger.info(f"Gathering market data for {req.name}...")
    data = await gather_alerts(req.profile)
    opps_html = ""
    for o in data.get("opportunities",[]):
        c = "#059669" if o["score"]>=80 else "#d97706"
        opps_html += f'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #eef0f3;"><div><strong style="color:#1a1e;font-size:14px;">{o["area"]}</strong><span style="color:#9ca3af;font-size:12px;margin-left:8px;">{o["positioning"]}</span></div><span style="background:{c}11;color:{c};font-size:12px;font-weight:700;padding:4px 12px;border-radius:6px;">{o["score"]:.0f}</span></div>'
    s = data.get("summary",{})
    body = f"""<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi <strong style="color:#1a1a2e;">{req.name}</strong>,</p>
    <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 24px;">Here is your latest market intelligence briefing.</p>
    <div style="margin:0 0 24px;">
    <h3 style="color:#1a1a2e;font-size:14px;font-weight:700;margin:0 0 12px;">Top Opportunities</h3>
    {opps_html}</div>
    <div style="background:#f8f9fb;border-radius:8px;padding:20px 24px;margin:0 0 24px;border:1px solid #eef0f3;">
    <h3 style="color:#1a1a2e;font-size:14px;font-weight:700;margin:0 0 10px;">Market Overview</h3>
    <p style="color:#6b7280;font-size:13px;line-height:1.7;margin:0;">Monitoring <strong style="color:#1a1a2e;">{s.get("total_areas",24)}</strong> areas and <strong style="color:#1a1a2e;">{s.get("total_cafes",349)}</strong> cafes. Average demand: <strong style="color:#1a1a2e;">{s.get("avg_demand",0):.1%}</strong>. Top area: <strong style="color:#059669;">{s.get("top_area","N/A")}</strong>.</p></div>
    <div style="text-align:center;">
    <a href="http://localhost:5173" style="background:#1a1a2e;color:#ffffff;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;display:inline-block;">View Dashboard</a></div>"""
    return {"type":"market_alert", **send_email(req.email, "Market Alert — TrendHive", base_html("Market Intelligence Alert", body))}

@email_app.on_event("startup")
async def startup():
    logger.info("Email Agent starting...")
    logger.info(f"  Gmail: {GMAIL_USER[:3]+'***' if GMAIL_USER else 'NOT SET'}")
    logger.info("Email Agent ready!")
