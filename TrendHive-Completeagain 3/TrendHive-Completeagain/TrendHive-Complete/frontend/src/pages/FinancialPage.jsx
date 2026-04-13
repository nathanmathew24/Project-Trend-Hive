import React, { useState, useRef } from "react";
import { S } from "../styles/theme";
import { HoneycombBg, Card, AppNav, FinancialNavButton } from "../components/ui";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ─── AREA_DATA — benchmarked from 4,223 real Dubai cafes ─────────────────────
// Rent:            REAL — dubai_cafes_AUTHENTIC_FULL_RENT.xlsx (AED/sqft/yr × 1,200 sqft ÷ 12)
// Cafe counts:     REAL — TrendHive dataset
// Footfall level:  REAL — dubai_cafes_FINAL_FOOTFALL.xlsx
// dailyCustomers:  DERIVED from footfall score
// avgSpend:        ESTIMATED based on area character and rent tier
const AREA_DATA = {
  "Downtown Dubai": { cafes:191, competition:"Very High", avgRating:4.5, rent:34000, footfall:"Very High", footfallScore:75.1, avgSpend:72,  dailyCustomers:150, startupMultiplier:1.3,  tag:"Premium",     color:S.accent },
  "Dubai Marina":   { cafes:143, competition:"Very High", avgRating:4.6, rent:24000, footfall:"High",      footfallScore:69.9, avgSpend:65,  dailyCustomers:140, startupMultiplier:1.2,  tag:"Tourist",     color:S.blue },
  "DIFC":           { cafes:84,  competition:"High",      avgRating:4.6, rent:31000, footfall:"Very High", footfallScore:78.2, avgSpend:80,  dailyCustomers:160, startupMultiplier:1.4,  tag:"Corporate",   color:S.purple },
  "Business Bay":   { cafes:111, competition:"Very High", avgRating:4.5, rent:21000, footfall:"High",      footfallScore:58.7, avgSpend:60,  dailyCustomers:110, startupMultiplier:1.1,  tag:"Corporate",   color:"rgba(233,238,249,0.55)" },
  "Al Barsha":      { cafes:122, competition:"Very High", avgRating:4.5, rent:13500, footfall:"Medium",    footfallScore:50.8, avgSpend:48,  dailyCustomers:100, startupMultiplier:0.9,  tag:"Residential", color:S.green },
  "Jumeirah":       { cafes:316, competition:"Very High", avgRating:4.5, rent:17000, footfall:"Medium",    footfallScore:51.0, avgSpend:62,  dailyCustomers:100, startupMultiplier:1.1,  tag:"Lifestyle",   color:S.amber },
  "Deira":          { cafes:301, competition:"Very High", avgRating:4.3, rent:10500, footfall:"Very High", footfallScore:74.4, avgSpend:38,  dailyCustomers:150, startupMultiplier:0.75, tag:"Budget",      color:S.red },
  "Al Quoz":        { cafes:73,  competition:"Medium",    avgRating:4.6, rent:11500, footfall:"High",      footfallScore:60.8, avgSpend:55,  dailyCustomers:120, startupMultiplier:0.85, tag:"Artsy",       color:"rgba(233,238,249,0.55)" },
  "Palm Jumeirah":  { cafes:8,   competition:"High",      avgRating:4.7, rent:28000, footfall:"Low",       footfallScore:36.6, avgSpend:90,  dailyCustomers:60,  startupMultiplier:1.5,  tag:"Luxury",      color:S.purple },
  "Mirdif":         { cafes:101, competition:"Medium",    avgRating:4.5, rent:12500, footfall:"High",      footfallScore:65.4, avgSpend:45,  dailyCustomers:130, startupMultiplier:0.8,  tag:"Family",      color:"rgba(74,222,128,0.75)" },
  "JLT":            { cafes:76,  competition:"Medium",    avgRating:4.6, rent:19000, footfall:"Medium",    footfallScore:49.0, avgSpend:55,  dailyCustomers:90,  startupMultiplier:1.0,  tag:"Corporate",   color:S.blue },
  "Silicon Oasis":  { cafes:80,  competition:"Low",       avgRating:4.4, rent:9500,  footfall:"Very High", footfallScore:72.6, avgSpend:40,  dailyCustomers:140, startupMultiplier:0.7,  tag:"Tech",        color:S.green },
};

const COMPETITION_COLOR = { "Very High": S.red, "High": S.amber, "Medium": S.green, "Low": S.blue };
const FOOTFALL_SCORE    = { "Very High":5, "High":4, "Medium":3, "Low":2 };

function computeFinancials(area, cafeType) {
  const d  = AREA_DATA[area];
  const tm = {
    "Specialty Coffee":  { rev:1.1,  cost:1.05 },
    "Dessert Cafe":      { rev:1.0,  cost:1.1  },
    "Brunch & All-Day":  { rev:1.15, cost:1.2  },
    "Shisha Cafe":       { rev:1.2,  cost:1.0  },
    "Healthy & Vegan":   { rev:1.05, cost:1.15 },
    "Standard Cafe":     { rev:1.0,  cost:1.0  },
  }[cafeType] || { rev:1.0, cost:1.0 };

  const secDeposit   = d.rent * 3;
  const baseSum      = (350000+120000+80000+35000+25000+15000+20000) * d.startupMultiplier;
  const contingency  = Math.round((baseSum + secDeposit) * 0.10);
  const totalStartup = Math.round(baseSum + secDeposit + contingency);
  const staffMonthly = Math.round(45000 * d.startupMultiplier);
  const fixedOther   = 6000 + 800 + 1500 + 3000 + 2000 + 1500 + 2000;
  const monthlyRev   = Math.round(d.avgSpend * d.dailyCustomers * tm.rev * (350/12));
  const monthlyCOGS  = Math.round(monthlyRev * 0.30 * tm.cost);
  const totalFixed   = d.rent + staffMonthly + fixedOther;
  const totalMonthly = totalFixed + monthlyCOGS;
  const grossProfit  = monthlyRev - monthlyCOGS;
  const netMonthly   = grossProfit - totalFixed;
  const breakEven    = netMonthly > 0 ? Math.ceil(totalStartup / netMonthly) : 999;
  const years = [1,2,3].map(y => {
    const gf      = y===1 ? 1 : y===2 ? 1.25 : 1.25*1.20;
    const annRev  = monthlyRev*12*gf;
    const annCOGS = annRev*0.30*tm.cost;
    const annFixed= totalFixed*12*(y===1 ? 1 : y===2 ? 1.05 : 1.1025);
    const net     = annRev - annCOGS - annFixed;
    return { year:`Year ${y}`, revenue:Math.round(annRev), cogs:Math.round(annCOGS), expenses:Math.round(annFixed), netProfit:Math.round(net), margin:Math.round((net/annRev)*100) };
  });
  const roi3yr = Math.round((years.reduce((s,y) => s+y.netProfit, 0) / totalStartup) * 100);
  return { totalStartup, totalMonthly, monthlyRev, monthlyCOGS, grossProfit, netMonthly, breakEven, years, roi3yr, area: d };
}

function CalcInput({ label, value, onChange, prefix="AED", suffix="", hint, min=0, max=1000000, step=1 }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom: 7 }}>
        <label style={{ color:"#AAA1A1", fontSize: 13 }}>{label}</label>
        <span style={{ color: S.accent, fontSize: 15, fontWeight: 700 }}>
          {prefix && prefix + " "}{Number(value).toLocaleString()}{suffix}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:"100%", accentColor: S.accent, cursor:"pointer", height: 4 }}
      />
      {hint && <p style={{ color:"#475569", fontSize: 11, marginTop: 5 }}>{hint}</p>}
    </div>
  );
}

function FinancialPage({ navigate }) {
  const [selectedArea, setSelectedArea] = useState("Downtown Dubai");
  const [cafeType,     setCafeType]     = useState("Specialty Coffee");
  const [activeTab,    setActiveTab]    = useState("overview");
  const [compareArea,  setCompareArea]  = useState("Al Barsha");
  const [animKey,      setAnimKey]      = useState(0);

  // Calculator inputs
  const [workers,   setWorkers]   = useState(5);
  const [avgSalary, setAvgSalary] = useState(4500);
  const [shopSize,  setShopSize]  = useState(1200);
  const [rent,      setRent]      = useState(40000);
  const [avgSpend,  setAvgSpend]  = useState(55);
  const [dailyCust, setDailyCust] = useState(80);
  const [startup,   setStartup]   = useState(765000);
  const [otherExp,  setOtherExp]  = useState(15800);
  const [cogsP,     setCogsP]     = useState(30);
  const [calcGenerated, setCalcGenerated] = useState(false);
  const [calcResult,    setCalcResult]    = useState({ staffCost:0, monthlyRev:0, monthlyCOGS:0, totalMonthly:0, grossProfit:0, netMonthly:0, breakEven:999, roi3yr:0 });
  const calcTopRef = useRef(null);

  const fin          = computeFinancials(selectedArea, cafeType);
  const finCmp       = computeFinancials(compareArea,  cafeType);
  const areaInfo     = AREA_DATA[selectedArea];
  const compColor    = COMPETITION_COLOR[areaInfo.competition];
  const tabs         = [
    { id:"overview",   label:"Overview"      },
    { id:"expenses",   label:"Expenses"      },
    { id:"projection", label:"3-Year P&L"    },
    { id:"compare",    label:"Compare Areas" },
    { id:"calculator", label:"My Calculator" },
  ];

  const KPI = ({ label, value, color, sub }) => (
    <div style={{ padding:20, borderRadius:12, background:"#111827", border:`1px solid ${color}25` }}>
      <div style={{ color, fontSize:20, fontWeight:800, marginBottom:3 }}>{value}</div>
      <div style={{ color:"#AAA1A1", fontSize:11 }}>{label}</div>
      {sub && <div style={{ color:"#475569", fontSize:10, marginTop:4 }}>{sub}</div>}
    </div>
  );

  const Row = ({ label, value, color, bold, sign="" }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #1e293b" }}>
      <span style={{ color:bold?"#fff":"#AAA1A1", fontSize:13, fontWeight:bold?700:400 }}>{label}</span>
      <span style={{ color:color||"#fff", fontSize:13, fontWeight:bold?800:600 }}>{sign}AED {Math.abs(value).toLocaleString()}</span>
    </div>
  );

  return (
    <div style={{ background:S.bg, minHeight:"100vh" }}>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
        .fin-in{animation:slideUp 0.35s ease-out both}
        .apill{transition:all 0.18s;cursor:pointer;border:none}
        .apill:hover{transform:translateY(-2px)}
        .tbtn{background:none;border:none;cursor:pointer;transition:color 0.15s}
        .calc-card-in{animation:fadeUp 0.4s ease-out both}
        .kpi-pop{animation:popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both}
        .res-card-in{animation:fadeUp 0.5s ease-out both}
        .insight-pop{animation:popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both}
        .gen-btn{transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1)}
        .gen-btn:hover{transform:scale(1.03);box-shadow:0 0 30px rgba(217,179,95,0.16)}
        .gen-btn:active{transform:scale(0.97)}
        .back-btn{transition:all 0.2s;cursor:pointer;border:none;background:none}
        .back-btn:hover{transform:translateX(-3px)}
      `}</style>
      <HoneycombBg />
      <AppNav navigate={navigate} currentPage="financial" />
      <FinancialNavButton navigate={navigate} currentPage="financial" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ color:"#fff", fontSize:26, fontWeight:800, margin:"0 0 6px" }}>Financial Analysis</h1>
          <p style={{ color:S.muted, fontSize:13, margin:0 }}>
            Benchmarked from <span style={{ color:S.accent, fontWeight:600 }}>4,223 real Dubai cafes</span>. Select an area and concept to explore projections, or use the calculator tab.
          </p>
        </div>

        {/* Selectors */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:22 }}>
          <Card style={{ padding:18 }}>
            <p style={{ color:S.muted, fontSize:11, fontWeight:600, letterSpacing:1, marginBottom:12, textTransform:"uppercase" }}>Target Area</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
              {Object.entries(AREA_DATA).map(([area, d]) => (
                <button key={area} className="apill"
                  onClick={() => { setSelectedArea(area); setAnimKey(k=>k+1); }}
                  style={{ padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:600,
                    background:selectedArea===area?d.color+"22":"#1e293b",
                    color:selectedArea===area?d.color:S.muted,
                    outline:selectedArea===area?`1px solid ${d.color}55`:"1px solid #334155" }}>
                  {area} <span style={{ opacity:0.5, fontSize:10 }}>{d.cafes}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card style={{ padding:18 }}>
            <p style={{ color:S.muted, fontSize:11, fontWeight:600, letterSpacing:1, marginBottom:12, textTransform:"uppercase" }}>Cafe Concept</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
              {["Specialty Coffee","Dessert Cafe","Brunch & All-Day","Shisha Cafe","Healthy & Vegan","Standard Cafe"].map(t => (
                <button key={t} className="apill"
                  onClick={() => setCafeType(t)}
                  style={{ padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:600,
                    background:cafeType===t?S.accent+"22":"#1e293b",
                    color:cafeType===t?S.accent:S.muted,
                    outline:cafeType===t?`1px solid ${S.accent}55`:"1px solid #334155" }}>
                  {t}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Area badge */}
        <div key={animKey} style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, padding:"12px 18px", borderRadius:10, background:areaInfo.color+"10", border:`1px solid ${areaInfo.color}28`, animation:"slideUp 0.3s ease-out" }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:areaInfo.color, boxShadow:`0 0 10px ${areaInfo.color}` }} />
          <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>{selectedArea}</span>
          <span style={{ background:areaInfo.color+"22", color:areaInfo.color, fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:10 }}>{areaInfo.tag}</span>
          <span style={{ background:compColor+"22", color:compColor, fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:10 }}>{areaInfo.competition} Competition</span>
          <span style={{ color:S.muted, fontSize:12 }}>{areaInfo.cafes} cafes</span>
          <span style={{ color:S.muted, fontSize:12 }}>{areaInfo.avgRating} avg rating</span>
          <span style={{ marginLeft:"auto", color:S.muted, fontSize:12 }}>{cafeType}</span>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:2, marginBottom:22, borderBottom:`1px solid ${S.cardB}` }}>
          {tabs.map(t => (
            <button key={t.id} className="tbtn" onClick={() => setActiveTab(t.id)}
              style={{ padding:"9px 18px", fontSize:13, fontWeight:600,
                color:activeTab===t.id?"#fff":S.muted,
                borderBottom:`2px solid ${activeTab===t.id?S.accent:"transparent"}`,
                marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab==="overview" && (
          <div className="fin-in" key={`ov${animKey}`}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 }}>
              <KPI label="Total Startup Cost" value={`AED ${(fin.totalStartup/1000).toFixed(0)}K`}  color={S.accent} sub="One-time investment" />
              <KPI label="Monthly Expenses"   value={`AED ${(fin.totalMonthly/1000).toFixed(0)}K`}  color={S.blue}   sub="Fixed + variable" />
              <KPI label="Monthly Revenue"    value={`AED ${(fin.monthlyRev/1000).toFixed(0)}K`}    color={S.green}  sub={`${areaInfo.dailyCustomers} customers/day`} />
              <KPI label="Break-Even"
                value={fin.breakEven<100?`${fin.breakEven} months`:"36+ mo"}
                color={fin.breakEven<24?S.green:fin.breakEven<36?S.amber:S.red}
                sub={fin.breakEven<30?"Within benchmark":"Long timeline"} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Card style={{ padding:22 }}>
                <h3 style={{ color:"#fff", fontSize:14, fontWeight:700, marginBottom:14 }}>Monthly Snapshot</h3>
                <Row label="Gross Revenue"     value={fin.monthlyRev}   color={S.green}  bold />
                <Row label="Cost of Goods"      value={fin.monthlyCOGS}  color={S.red}    sign="- " />
                <Row label="Gross Profit"       value={fin.grossProfit}  color={S.accent} bold />
                <Row label="Operating Expenses" value={fin.totalMonthly-fin.monthlyCOGS} color={S.red} sign="- " />
                <Row label="Net Monthly Profit" value={fin.netMonthly}   color={fin.netMonthly>0?S.green:S.red} bold />
                <div style={{ marginTop:14, padding:"10px 14px", borderRadius:8, background:fin.netMonthly>0?"#0a1f12":"#1a0a0a", border:`1px solid ${fin.netMonthly>0?S.green:S.red}30` }}>
                  <span style={{ color:fin.netMonthly>0?S.green:S.red, fontSize:14, fontWeight:800 }}>
                    {fin.netMonthly>0?"+ ":"- "}AED {Math.abs(fin.netMonthly).toLocaleString()}/month
                  </span>
                  <span style={{ color:S.dim, fontSize:11, marginLeft:10 }}>{fin.netMonthly>0?"Positive cash flow":"Operating at a loss"}</span>
                </div>
              </Card>
              <Card style={{ padding:22 }}>
                <h3 style={{ color:"#fff", fontSize:14, fontWeight:700, marginBottom:14 }}>Area Intelligence</h3>
                {[
                  ["Cafes in Area",        `${areaInfo.cafes} cafes`],
                  ["Competition Level",    areaInfo.competition,   compColor],
                  ["Average Rating",       `${areaInfo.avgRating} / 5.0`],
                  ["Monthly Rent",         `AED ${areaInfo.rent.toLocaleString()}`],
                  ["Avg Customer Spend",   `AED ${areaInfo.avgSpend}`],
                  ["Est. Daily Customers", `${areaInfo.dailyCustomers}/day`],
                  ["Footfall Level",       areaInfo.footfall, areaInfo.footfall==="Very High"?S.green:areaInfo.footfall==="High"?S.accent:S.muted],
                  ["Area Type",            areaInfo.tag, areaInfo.color],
                ].map(([lbl,val,col],i) => (
                  <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:i<7?`1px solid ${S.cardB}`:"none" }}>
                    <span style={{ color:S.muted, fontSize:12 }}>{lbl}</span>
                    <span style={{ color:col||"#fff", fontSize:12, fontWeight:600 }}>{val}</span>
                  </div>
                ))}
                <div style={{ marginTop:14, padding:"10px 14px", borderRadius:8, background:fin.roi3yr>0?"#0a1f12":"#1a0a0a", border:`1px solid ${fin.roi3yr>0?S.green:S.red}28`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color:S.muted, fontSize:12 }}>3-Year ROI</span>
                  <span style={{ color:fin.roi3yr>0?S.green:S.red, fontSize:20, fontWeight:800 }}>{fin.roi3yr>0?"+":""}{fin.roi3yr}%</span>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── EXPENSES ── */}
        {activeTab==="expenses" && (
          <div className="fin-in" key={`ex${animKey}`} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <Card style={{ padding:22 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                <h3 style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>Startup Investment</h3>
                <span style={{ color:S.accent, fontSize:16, fontWeight:800 }}>AED {(fin.totalStartup/1000).toFixed(0)}K</span>
              </div>
              {[
                ["Fit-Out & Interior",          Math.round(350000*areaInfo.startupMultiplier)],
                ["Kitchen Equipment",           Math.round(120000*areaInfo.startupMultiplier)],
                ["Furniture & Fixtures",        Math.round(80000*areaInfo.startupMultiplier)],
                ["Licenses & Permits",          35000],
                ["Initial Inventory",           25000],
                ["POS & Tech Systems",          15000],
                ["Marketing Launch",            20000],
                ["Security Deposit (3 months)", areaInfo.rent*3],
                ["Contingency (10%)",           Math.round(fin.totalStartup*0.09)],
              ].map(([lbl,val],i) => (
                <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<8?`1px solid ${S.cardB}`:"none" }}>
                  <span style={{ color:S.muted, fontSize:12 }}>{lbl}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:50, height:3, background:"#1e293b", borderRadius:2 }}>
                      <div style={{ height:"100%", width:`${Math.min((val/fin.totalStartup)*250,100)}%`, background:S.accent, borderRadius:2, opacity:0.7 }} />
                    </div>
                    <span style={{ color:"#fff", fontSize:12, fontWeight:600, width:80, textAlign:"right" }}>AED {val.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </Card>
            <Card style={{ padding:22 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                <h3 style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>Monthly Expenses</h3>
                <span style={{ color:S.blue, fontSize:16, fontWeight:800 }}>AED {fin.totalMonthly.toLocaleString()}</span>
              </div>
              {[
                ["Rent",                 areaInfo.rent,                                S.red],
                ["Staff Salaries",       Math.round(45000*areaInfo.startupMultiplier), S.amber],
                ["Cost of Goods (30%)",  fin.monthlyCOGS,                              S.blue],
                ["DEWA (Utilities)",     6000,                                          S.muted],
                ["Marketing & Ads",      3000,                                          S.muted],
                ["Internet & Insurance", 2300,                                          S.muted],
                ["Maintenance",          2000,                                          S.muted],
                ["Accounting & Misc",    3500,                                          S.muted],
              ].map(([lbl,val,color],i) => (
                <div key={lbl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<7?`1px solid ${S.cardB}`:"none" }}>
                  <span style={{ color:S.muted, fontSize:12 }}>{lbl}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:50, height:3, background:"#1e293b", borderRadius:2 }}>
                      <div style={{ height:"100%", width:`${Math.min((val/fin.totalMonthly)*200,100)}%`, background:color, borderRadius:2, opacity:0.7 }} />
                    </div>
                    <span style={{ color:"#fff", fontSize:12, fontWeight:600, width:80, textAlign:"right" }}>AED {val.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── 3-YEAR P&L ── */}
        {activeTab==="projection" && (
          <div className="fin-in" key={`pl${animKey}`}>
            <Card style={{ padding:22, marginBottom:14 }}>
              <h3 style={{ color:"#fff", fontSize:14, fontWeight:700, marginBottom:18 }}>3-Year Revenue vs Profit</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={fin.years} margin={{ top:0, right:10, left:20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" tick={{ fill:S.muted, fontSize:12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}K`} tick={{ fill:S.muted, fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background:"#111827", border:`1px solid ${S.cardB}`, borderRadius:8 }} formatter={(v,n)=>[`AED ${v.toLocaleString()}`,n]} />
                  <Legend wrapperStyle={{ color:S.muted, fontSize:12 }} />
                  <Bar dataKey="revenue"   name="Revenue"    fill={S.green}  radius={[4,4,0,0]} opacity={0.85} />
                  <Bar dataKey="expenses"  name="OpEx"       fill={S.red}    radius={[4,4,0,0]} opacity={0.7}  />
                  <Bar dataKey="netProfit" name="Net Profit" fill={S.accent} radius={[4,4,0,0]} opacity={0.9}  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>
              {fin.years.map((yr,i) => (
                <Card key={yr.year} style={{ padding:18, border:i===0?`1px solid ${S.accent}30`:`1px solid ${S.cardB}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
                    <span style={{ color:S.muted, fontSize:12, fontWeight:600 }}>{yr.year}</span>
                    <span style={{ color:yr.margin>0?S.green:S.red, fontSize:11, fontWeight:700, background:(yr.margin>0?S.green:S.red)+"15", padding:"2px 8px", borderRadius:8 }}>
                      {yr.margin>0?"+":""}{yr.margin}% margin
                    </span>
                  </div>
                  {[["Revenue",yr.revenue,S.green],["COGS",yr.cogs,S.red],["OpEx",yr.expenses,S.amber],["Net Profit",yr.netProfit,yr.netProfit>0?S.accent:S.red]].map(([lbl,val,col]) => (
                    <div key={lbl} style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                      <span style={{ color:S.muted, fontSize:11 }}>{lbl}</span>
                      <span style={{ color:lbl==="Net Profit"?col:"#fff", fontSize:12, fontWeight:lbl==="Net Profit"?700:400 }}>AED {Math.abs(val).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${S.cardB}`, textAlign:"center" }}>
                    <div style={{ color:yr.netProfit>0?S.green:S.red, fontSize:16, fontWeight:800 }}>{yr.netProfit>0?"+ ":"- "}AED {Math.abs(yr.netProfit).toLocaleString()}</div>
                    <div style={{ color:S.muted, fontSize:10 }}>Net Profit</div>
                  </div>
                </Card>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Card style={{ padding:18, background:fin.breakEven<36?"#0a1f12":"#1a0a0a", border:`1px solid ${fin.breakEven<36?S.green:S.red}30` }}>
                <p style={{ color:S.muted, fontSize:12, marginBottom:6 }}>Break-Even Timeline</p>
                <div style={{ color:fin.breakEven<24?S.green:fin.breakEven<36?S.amber:S.red, fontSize:32, fontWeight:800 }}>
                  {fin.breakEven<100?fin.breakEven:"36+"} <span style={{ fontSize:14, fontWeight:400 }}>months</span>
                </div>
                <p style={{ color:S.dim, fontSize:11, marginTop:6 }}>{fin.breakEven<18?"Excellent":"Within Dubai cafe benchmark (18–30 months)"}</p>
              </Card>
              <Card style={{ padding:18, background:fin.roi3yr>0?"#0a1f12":"#1a0a0a", border:`1px solid ${fin.roi3yr>0?S.accent:S.red}30` }}>
                <p style={{ color:S.muted, fontSize:12, marginBottom:6 }}>3-Year ROI</p>
                <div style={{ color:fin.roi3yr>0?S.accent:S.red, fontSize:32, fontWeight:800 }}>{fin.roi3yr>0?"+":""}{fin.roi3yr}%</div>
                <p style={{ color:S.dim, fontSize:11, marginTop:6 }}>Annualized: ~{Math.round(fin.roi3yr/3)}% per year</p>
              </Card>
            </div>
          </div>
        )}

        {/* ── COMPARE AREAS ── */}
        {activeTab==="compare" && (
          <div className="fin-in" key={`cmp${animKey}`}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <span style={{ color:S.muted, fontSize:13 }}>Compare <strong style={{ color:S.accent }}>{selectedArea}</strong> vs:</span>
              {Object.keys(AREA_DATA).filter(a=>a!==selectedArea).map(a => (
                <button key={a} className="apill"
                  onClick={() => setCompareArea(a)}
                  style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:600,
                    background:compareArea===a?AREA_DATA[a].color+"22":"#1e293b",
                    color:compareArea===a?AREA_DATA[a].color:S.muted,
                    outline:compareArea===a?`1px solid ${AREA_DATA[a].color}55`:"1px solid #334155" }}>
                  {a}
                </button>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              {[{ label:selectedArea, f:fin, color:areaInfo.color },{ label:compareArea, f:finCmp, color:AREA_DATA[compareArea].color }].map(({ label, f, color }) => (
                <Card key={label} style={{ padding:22, border:`1px solid ${color}30` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:color }} />
                    <h3 style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>{label}</h3>
                    <span style={{ color, fontSize:10, fontWeight:700, background:color+"20", padding:"2px 8px", borderRadius:8 }}>{AREA_DATA[label].tag}</span>
                  </div>
                  {[
                    ["Startup Cost",     `AED ${(f.totalStartup/1000).toFixed(0)}K`,                            color],
                    ["Monthly Revenue",  `AED ${f.monthlyRev.toLocaleString()}`,                                 S.green],
                    ["Monthly Expenses", `AED ${f.totalMonthly.toLocaleString()}`,                               S.red],
                    ["Net Monthly",      `${f.netMonthly>=0?"+ ":"- "}AED ${Math.abs(f.netMonthly).toLocaleString()}`, f.netMonthly>0?S.green:S.red],
                    ["Break-Even",       `${f.breakEven<100?f.breakEven:"36+"} months`,                         f.breakEven<30?S.green:S.red],
                    ["3-Year ROI",       `${f.roi3yr>0?"+":""}${f.roi3yr}%`,                                    f.roi3yr>50?S.green:f.roi3yr>0?S.amber:S.red],
                    ["Competition",      AREA_DATA[label].competition,                                           COMPETITION_COLOR[AREA_DATA[label].competition]],
                    ["Avg Spend/Visit",  `AED ${AREA_DATA[label].avgSpend}`,                                    S.muted],
                  ].map(([lbl,val,c]) => (
                    <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${S.cardB}` }}>
                      <span style={{ color:S.muted, fontSize:12 }}>{lbl}</span>
                      <span style={{ color:c, fontSize:12, fontWeight:700 }}>{val}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
            <Card style={{ padding:20 }}>
              <h3 style={{ color:"#fff", fontSize:13, fontWeight:700, marginBottom:14 }}>Head-to-Head Verdict</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {[
                  { label:"Lower Startup Cost", winner:fin.totalStartup<=finCmp.totalStartup?selectedArea:compareArea, metric:`AED ${Math.abs(fin.totalStartup-finCmp.totalStartup).toLocaleString()} diff` },
                  { label:"Higher Revenue",     winner:fin.monthlyRev>=finCmp.monthlyRev?selectedArea:compareArea,      metric:`AED ${Math.abs(fin.monthlyRev-finCmp.monthlyRev).toLocaleString()}/mo gap` },
                  { label:"Better 3yr ROI",     winner:fin.roi3yr>=finCmp.roi3yr?selectedArea:compareArea,             metric:`${Math.abs(fin.roi3yr-finCmp.roi3yr)}% difference` },
                  { label:"Faster Break-Even",  winner:fin.breakEven<=finCmp.breakEven?selectedArea:compareArea,       metric:`${Math.abs(fin.breakEven-finCmp.breakEven)} months faster` },
                  { label:"Lower Competition",  winner:FOOTFALL_SCORE[areaInfo.footfall]<=FOOTFALL_SCORE[AREA_DATA[compareArea].footfall]?selectedArea:compareArea, metric:`${areaInfo.competition} vs ${AREA_DATA[compareArea].competition}` },
                  { label:"Higher Avg Rating",  winner:areaInfo.avgRating>=AREA_DATA[compareArea].avgRating?selectedArea:compareArea, metric:`${areaInfo.avgRating} vs ${AREA_DATA[compareArea].avgRating}` },
                ].map(({ label, winner, metric }) => {
                  const wc = winner===selectedArea ? areaInfo.color : AREA_DATA[compareArea].color;
                  return (
                    <div key={label} style={{ padding:14, borderRadius:10, background:wc+"10", border:`1px solid ${wc}28` }}>
                      <p style={{ color:S.muted, fontSize:10, marginBottom:5 }}>{label}</p>
                      <p style={{ color:wc, fontSize:13, fontWeight:700, marginBottom:3 }}>{winner}</p>
                      <p style={{ color:S.dim, fontSize:10 }}>{metric}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── MY CALCULATOR ── */}
        {activeTab==="calculator" && (
          <div className="fin-in" key={`calc-${calcGenerated}`} ref={calcTopRef}>
            {!calcGenerated ? (
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
                  <div>
                    <h2 style={{ color:"#fff", fontSize:18, fontWeight:800, margin:"0 0 4px" }}>Build Your Projection</h2>
                    <p style={{ color:S.muted, fontSize:13, margin:0 }}>Adjust the sliders, then generate your full financial report.</p>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ width:28, height:6, borderRadius:3, background:S.accent }}/>
                    <div style={{ width:10, height:6, borderRadius:3, background:"#1e293b" }}/>
                    <span style={{ color:S.muted, fontSize:11, marginLeft:4 }}>Step 1 of 2</span>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    <div className="calc-card-in" style={{ animationDelay:"0s" }}>
                      <Card style={{ padding:24 }}>
                        <h3 style={{ color:"#fff", fontSize:13, fontWeight:700, marginBottom:16 }}>Your Shop</h3>
                        <CalcInput label="Shop Size" value={shopSize} onChange={setShopSize} prefix="" suffix=" sqft" hint="Typical Dubai cafe: 800–2,000 sqft" min={200} max={5000} step={50} />
                        <CalcInput label="Monthly Rent" value={rent} onChange={setRent} hint="Dubai range: AED 9,500–34,000/month" min={8000} max={150000} step={1000} />
                        <CalcInput label="Total Startup Budget" value={startup} onChange={setStartup} hint="Fit-out, equipment, licenses, deposits" min={100000} max={3000000} step={10000} />
                      </Card>
                    </div>
                    <div className="calc-card-in" style={{ animationDelay:"0.1s" }}>
                      <Card style={{ padding:24 }}>
                        <h3 style={{ color:"#fff", fontSize:13, fontWeight:700, marginBottom:16 }}>Your Team</h3>
                        <CalcInput label="Number of Staff" value={workers} onChange={setWorkers} prefix="" suffix=" people" hint="Baristas, managers, cashiers, etc." min={1} max={30} step={1} />
                        <CalcInput label="Avg Monthly Salary per Person" value={avgSalary} onChange={setAvgSalary} hint="Dubai range: AED 3,500–8,000/person" min={2000} max={20000} step={500} />
                        <div style={{ padding:"12px 16px", borderRadius:10, background:"#0f172a", border:`1px solid ${S.amber}22`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ color:S.muted, fontSize:12 }}>Total Monthly Payroll</span>
                          <span style={{ color:S.amber, fontSize:15, fontWeight:800 }}>AED {(workers*avgSalary).toLocaleString()}</span>
                        </div>
                      </Card>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    <div className="calc-card-in" style={{ animationDelay:"0.15s" }}>
                      <Card style={{ padding:24 }}>
                        <h3 style={{ color:"#fff", fontSize:13, fontWeight:700, marginBottom:16 }}>Revenue</h3>
                        <CalcInput label="Avg Spend per Customer" value={avgSpend} onChange={setAvgSpend} hint="Dubai cafe average: AED 45–80/visit" min={20} max={200} step={5} />
                        <CalcInput label="Expected Daily Customers" value={dailyCust} onChange={setDailyCust} prefix="" suffix=" customers/day" hint="New cafes: 40–80/day to start" min={10} max={400} step={5} />
                        <CalcInput label="Food & Beverage Cost" value={cogsP} onChange={setCogsP} prefix="" suffix="% of revenue" hint="Industry standard: 28–35%" min={15} max={55} step={1} />
                        <div style={{ padding:"12px 16px", borderRadius:10, background:"#0a1f12", border:`1px solid ${S.green}22`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ color:S.muted, fontSize:12 }}>Est. Monthly Revenue</span>
                          <span style={{ color:S.green, fontSize:15, fontWeight:800 }}>AED {Math.round(avgSpend * dailyCust * (350/12)).toLocaleString()}</span>
                        </div>
                      </Card>
                    </div>
                    <div className="calc-card-in" style={{ animationDelay:"0.2s" }}>
                      <Card style={{ padding:24 }}>
                        <h3 style={{ color:"#fff", fontSize:13, fontWeight:700, marginBottom:16 }}>Other Monthly Costs</h3>
                        <CalcInput label="Other Monthly Expenses" value={otherExp} onChange={setOtherExp} hint="Typical range: AED 12,000–25,000/month" min={3000} max={80000} step={500} />
                        <div style={{ marginTop:8, padding:"14px 16px", borderRadius:10, background:"#0f172a", border:`1px solid #1e293b` }}>
                          <p style={{ color:S.muted, fontSize:11, marginBottom:10, fontWeight:600, letterSpacing:0.5, textTransform:"uppercase" }}>Quick Preview</p>
                          {[
                            ["Total Expenses/mo", `AED ${(rent + workers*avgSalary + Math.round(Math.round(avgSpend*dailyCust*(350/12))*(cogsP/100)) + otherExp).toLocaleString()}`, S.red],
                            ["Est. Revenue/mo",   `AED ${Math.round(avgSpend * dailyCust * (350/12)).toLocaleString()}`, S.green],
                          ].map(([l,v,c]) => (
                            <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                              <span style={{ color:S.muted, fontSize:11 }}>{l}</span>
                              <span style={{ color:c, fontSize:12, fontWeight:700 }}>{v}</span>
                            </div>
                          ))}
                          <div style={{ height:1, background:"#1e293b", margin:"8px 0" }}/>
                          {(() => {
                            const rev = Math.round(avgSpend * dailyCust * (350/12));
                            const exp = rent + workers*avgSalary + Math.round(rev*(cogsP/100)) + otherExp;
                            const net = rev - exp;
                            return (
                              <div style={{ display:"flex", justifyContent:"space-between" }}>
                                <span style={{ color:S.muted, fontSize:11, fontWeight:700 }}>Est. Net/mo</span>
                                <span style={{ color:net>=0?S.green:S.red, fontSize:13, fontWeight:800 }}>{net>=0?"+ ":"- "}AED {Math.abs(net).toLocaleString()}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop:20, display:"flex", justifyContent:"center" }}>
                  <button className="gen-btn"
                    onClick={() => {
                      const sc   = workers * avgSalary;
                      const rev  = Math.round(avgSpend * dailyCust * (350/12));
                      const cogs = Math.round(rev * (cogsP/100));
                      const tot  = rent + sc + cogs + otherExp;
                      const gp   = rev - cogs;
                      const net  = rev - tot;
                      const be   = net > 0 ? Math.ceil(startup / net) : 999;
                      const roi  = startup > 0 ? Math.round(((net*12 + net*12*1.25 + net*12*1.5) / startup)*100) : 0;
                      setCalcResult({ staffCost:sc, monthlyRev:rev, monthlyCOGS:cogs, totalMonthly:tot, grossProfit:gp, netMonthly:net, breakEven:be, roi3yr:roi });
                      setCalcGenerated(true);
                      setTimeout(() => calcTopRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
                    }}
                    style={{ padding:"16px 56px", borderRadius:14, border:"none", cursor:"pointer", background:S.accent, color:"#000", fontSize:15, fontWeight:800, letterSpacing:0.3 }}>
                    Generate My Financial Report
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:26 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <button className="back-btn" onClick={() => setCalcGenerated(false)}
                      style={{ display:"flex", alignItems:"center", gap:6, color:S.muted, fontSize:13, padding:"6px 12px", borderRadius:8, border:`1px solid #1e293b` }}>
                      ← Edit Inputs
                    </button>
                    <div>
                      <h2 style={{ color:"#fff", fontSize:18, fontWeight:800, margin:"0 0 2px" }}>Your Financial Report</h2>
                      <p style={{ color:S.muted, fontSize:12, margin:0 }}>AED {startup.toLocaleString()} startup · {workers} staff · {dailyCust} customers/day</p>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ width:10, height:6, borderRadius:3, background:"#1e293b" }}/>
                    <div style={{ width:28, height:6, borderRadius:3, background:S.accent }}/>
                    <span style={{ color:S.muted, fontSize:11, marginLeft:4 }}>Step 2 of 2</span>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                  {[
                    { label:"Monthly Revenue",  val:`AED ${calcResult.monthlyRev.toLocaleString()}`,                                                color:S.green,  delay:"0s"    },
                    { label:"Monthly Expenses", val:`AED ${calcResult.totalMonthly.toLocaleString()}`,                                              color:S.red,    delay:"0.07s" },
                    { label:"Net Monthly",      val:`${calcResult.netMonthly>=0?"+ ":"- "}AED ${Math.abs(calcResult.netMonthly).toLocaleString()}`, color:calcResult.netMonthly>=0?S.green:S.red, delay:"0.14s" },
                    { label:"Total Startup",    val:`AED ${(startup/1000).toFixed(0)}K`,                                                           color:S.accent, delay:"0.21s" },
                  ].map(k => (
                    <div key={k.label} className="kpi-pop"
                      style={{ animationDelay:k.delay, padding:"18px 16px", borderRadius:14, background:"#111827", border:`1px solid ${k.color}22`, position:"relative", overflow:"hidden" }}>
                      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:k.color, borderRadius:"14px 14px 0 0", opacity:0.6 }}/>
                      <div style={{ color:k.color, fontSize:17, fontWeight:800, marginBottom:4 }}>{k.val}</div>
                      <div style={{ color:S.muted, fontSize:11 }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:18 }}>
                  <div className="res-card-in" style={{ animationDelay:"0.25s", padding:"14px 18px", borderRadius:12, background:calcResult.breakEven<36?"#0a1f1290":"#1a0a0a90", border:`1px solid ${calcResult.breakEven<36?S.green:S.red}28` }}>
                    <p style={{ color:S.muted, fontSize:10, fontWeight:600, letterSpacing:0.8, textTransform:"uppercase", marginBottom:6 }}>Break-Even Timeline</p>
                    <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:6 }}>
                      <span style={{ color:calcResult.breakEven<24?S.green:calcResult.breakEven<36?S.amber:S.red, fontSize:34, fontWeight:900, lineHeight:1 }}>
                        {calcResult.breakEven<100?calcResult.breakEven:"36+"}
                      </span>
                      <span style={{ color:S.muted, fontSize:13 }}>months</span>
                    </div>
                    <div style={{ height:3, borderRadius:2, background:"#1e293b", marginBottom:6 }}>
                      <div style={{ height:"100%", borderRadius:2, width:`${Math.min((calcResult.breakEven/36)*100,100)}%`, background:calcResult.breakEven<24?S.green:calcResult.breakEven<36?S.amber:S.red, opacity:0.7 }}/>
                    </div>
                    <p style={{ color:S.dim, fontSize:11 }}>
                      {calcResult.breakEven<18?"Excellent — below 18-month target":calcResult.breakEven<30?"Good — within Dubai benchmark":calcResult.breakEven<42?"Moderate — review costs":"Long — reduce startup or boost revenue"}
                    </p>
                  </div>
                  <div className="res-card-in" style={{ animationDelay:"0.3s", padding:"14px 18px", borderRadius:12, background:calcResult.roi3yr>0?"#0a1f1290":"#1a0a0a90", border:`1px solid ${calcResult.roi3yr>0?S.accent:S.red}28` }}>
                    <p style={{ color:S.muted, fontSize:10, fontWeight:600, letterSpacing:0.8, textTransform:"uppercase", marginBottom:6 }}>3-Year ROI</p>
                    <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:6 }}>
                      <span style={{ color:calcResult.roi3yr>0?S.accent:S.red, fontSize:34, fontWeight:900, lineHeight:1 }}>{calcResult.roi3yr>0?"+":""}{calcResult.roi3yr}</span>
                      <span style={{ color:S.muted, fontSize:18 }}>%</span>
                    </div>
                    <div style={{ height:3, borderRadius:2, background:"#1e293b", marginBottom:6 }}>
                      <div style={{ height:"100%", borderRadius:2, width:`${Math.min(Math.abs(calcResult.roi3yr)/200*100,100)}%`, background:calcResult.roi3yr>0?S.accent:S.red, opacity:0.7 }}/>
                    </div>
                    <p style={{ color:S.dim, fontSize:11 }}>~{Math.round(calcResult.roi3yr/3)}% annualized per year</p>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
                  <div className="res-card-in" style={{ animationDelay:"0.35s" }}>
                    <Card style={{ padding:22 }}>
                      <h3 style={{ color:"#fff", fontSize:13, fontWeight:700, marginBottom:14 }}>Monthly Cash Flow</h3>
                      {[
                        { label:"Gross Revenue",           val:calcResult.monthlyRev,  color:S.green,  sign:"+ ", bold:false },
                        { label:`Food & Bev (${cogsP}%)`, val:calcResult.monthlyCOGS, color:S.red,    sign:"- ", bold:false },
                        { label:"Gross Profit",            val:calcResult.grossProfit, color:S.accent, sign:"= ", bold:true  },
                        { label:`Staff (${workers}×)`,     val:calcResult.staffCost,   color:S.amber,  sign:"- ", bold:false },
                        { label:"Rent",                    val:rent,                   color:S.red,    sign:"- ", bold:false },
                        { label:"Other",                   val:otherExp,               color:S.muted,  sign:"- ", bold:false },
                        { label:"Net Profit",              val:calcResult.netMonthly,  color:calcResult.netMonthly>=0?S.green:S.red, sign:"= ", bold:true },
                      ].map((row,i) => (
                        <div key={row.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<6?`1px solid #0f172a`:"none" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ color:row.color, fontSize:11, width:16, fontWeight:800, opacity:0.9 }}>{row.sign}</span>
                            <span style={{ color:row.bold?"#fff":S.muted, fontSize:12, fontWeight:row.bold?700:400 }}>{row.label}</span>
                          </div>
                          <span style={{ color:row.color, fontSize:12, fontWeight:row.bold?800:600 }}>AED {Math.abs(row.val).toLocaleString()}</span>
                        </div>
                      ))}
                    </Card>
                  </div>
                  <div className="res-card-in" style={{ animationDelay:"0.4s" }}>
                    <Card style={{ padding:22 }}>
                      <h3 style={{ color:"#fff", fontSize:13, fontWeight:700, marginBottom:14 }}>3-Year Outlook</h3>
                      {[1,2,3].map((y,i) => {
                        const gf     = y===1?1:y===2?1.25:1.5;
                        const rev    = calcResult.monthlyRev*12*gf;
                        const exp    = calcResult.totalMonthly*12*(y===1?1:y===2?1.05:1.1025);
                        const net    = rev - exp;
                        const margin = Math.round((net/rev)*100);
                        return (
                          <div key={y} style={{ padding:"12px 14px", borderRadius:10, marginBottom:i<2?10:0, background:net>0?"#0a1f1280":"#1a0a0a80", border:`1px solid ${net>0?S.green:S.red}20` }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                              <span style={{ color:"#fff", fontSize:12, fontWeight:700 }}>Year {y}</span>
                              <span style={{ color:margin>0?S.green:S.red, fontSize:11, fontWeight:700, background:(margin>0?S.green:S.red)+"18", padding:"2px 8px", borderRadius:8 }}>
                                {margin>0?"+":""}{margin}% margin
                              </span>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between" }}>
                              <span style={{ color:S.muted, fontSize:11 }}>Revenue</span>
                              <span style={{ color:"#fff", fontSize:11 }}>AED {Math.round(rev).toLocaleString()}</span>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                              <span style={{ color:S.muted, fontSize:11, fontWeight:700 }}>Net Profit</span>
                              <span style={{ color:net>0?S.accent:S.red, fontSize:12, fontWeight:800 }}>{net>0?"+ ":"- "}AED {Math.abs(Math.round(net)).toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  </div>
                </div>

                <div style={{ display:"flex", justifyContent:"center", marginTop:24 }}>
                  <button className="back-btn gen-btn" onClick={() => setCalcGenerated(false)}
                    style={{ padding:"12px 36px", borderRadius:12, border:`1px solid #334155`, color:S.muted, fontSize:13, fontWeight:600, background:"#111827" }}>
                    Edit My Inputs
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ marginTop:24, padding:"12px 16px", borderRadius:10, background:"#0f172a", border:`1px solid ${S.cardB}` }}>
          <p style={{ color:S.dim, fontSize:11, margin:0 }}>
            <strong style={{ color:S.muted }}>Data Note:</strong> Benchmarks derived from 4,223 real Dubai cafes. Revenue estimates use average spend × daily customer projections per area. All figures in AED. Use as a planning guide — actual results will vary.
          </p>
        </div>
      </div>
    </div>
  );
}

export default FinancialPage;
